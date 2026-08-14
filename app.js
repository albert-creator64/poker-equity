const SUITS=[{s:'♠',c:'black'},{s:'♥',c:'red'},{s:'♦',c:'red'},{s:'♣',c:'black'}];
const RANKS=[14,13,12,11,10,9,8,7,6,5,4,3,2];
const RANK_LABEL={14:'A',13:'K',12:'Q',11:'J',10:'10',9:'9',8:'8',7:'7',6:'6',5:'5',4:'4',3:'3',2:'2'};

let slots={hole0:null,hole1:null,flop0:null,flop1:null,flop2:null};
let activeSlot=null;
let calculating=false;
let mode='flop';

function setMode(m){
  mode=m;
  qq('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
  q('#flopCard').style.display=m==='preflop'?'none':'block';
  if(m==='preflop'){
    slots.flop0=slots.flop1=slots.flop2=null;
    renderSlots();
  }
}

function q(s){return document.querySelector(s)}
function qq(s){return document.querySelectorAll(s)}

function toast(m,t){
  const e=q('#toast');
  e.textContent=m;e.className='toast '+(t||'ok')+' show';
  clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800);
}

function cardStr(card){
  if(!card)return'';
  return RANK_LABEL[card.r]+SUITS[card.s].s;
}

function renderSlots(){
  Object.keys(slots).forEach(key=>{
    const el=document.querySelector('[data-slot="'+key+'"]');
    const c=slots[key];
    if(c){
      el.classList.add('filled');
      el.classList.remove('red');
      if(SUITS[c.s].c==='red')el.classList.add('red');
      el.innerHTML='<span>'+RANK_LABEL[c.r]+'</span><span class="suite">'+SUITS[c.s].s+'</span>';
    }else{
      el.classList.remove('filled','red');
      el.innerHTML='';
    }
  });
}

function buildPicker(){
  const grid=q('#pickerGrid');
  grid.innerHTML='';
  RANKS.forEach(r=>{
    SUITS.forEach((s,sIdx)=>{
      const d=document.createElement('div');
      d.className='pcard'+(s.c==='red'?' red':'');
      d.innerHTML='<span class="pr">'+RANK_LABEL[r]+'</span><span class="ps">'+s.s+'</span>';
      d.addEventListener('click',()=>{
        const card={r,s:sIdx};
        const used=Object.values(slots).filter(Boolean).map(x=>x.r+'_'+x.s);
        if(used.includes(r+'_'+sIdx)){toast('Карта уже используется','err');return}
        slots[activeSlot]=card;
        renderSlots();
        closePicker();
      });
      grid.appendChild(d);
    });
  });
}

function openPicker(slotName){
  activeSlot=slotName;
  const used=Object.values(slots).filter(Boolean).map(x=>x.r+'_'+x.s);
  qq('.pcard').forEach(el=>{
    const rnum=Object.keys(RANK_LABEL).find(k=>RANK_LABEL[k]===el.querySelector('.pr').textContent);
    const snum=SUITS.findIndex(x=>x.s===el.querySelector('.ps').textContent);
    el.classList.toggle('picked',used.includes(rnum+'_'+snum));
  });
  q('#picker').style.display='block';
}

function closePicker(){
  q('#picker').style.display='none';
  activeSlot=null;
}

// --- Hand evaluation ---
function evalBest(cards7){
  let best=-1;
  const n=cards7.length;
  for(let a=0;a<n-4;a++)
  for(let b=a+1;b<n-3;b++)
  for(let c=b+1;c<n-2;c++)
  for(let d=c+1;d<n-1;d++)
  for(let e=d+1;e<n;e++){
    const v=eval5([cards7[a],cards7[b],cards7[c],cards7[d],cards7[e]]);
    if(v>best)best=v;
  }
  return best;
}

function eval5(cards){
  const rs=cards.map(c=>c.r),ss=cards.map(c=>c.s);
  const cnt={};rs.forEach(r=>cnt[r]=(cnt[r]||0)+1);
  const grouped=Object.entries(cnt).map(([r,n])=>({r:+r,n})).sort((a,b)=>b.n-a.n||b.r-a.r);
  const isFlush=ss.every(s=>s===ss[0]);
  const sorted=rs.slice().sort((a,b)=>a-b);
  const uniq=[...new Set(sorted)];
  let isStraight=false,hiStraight=0;
  if(uniq.length===5){
    if(uniq[4]-uniq[0]===4){isStraight=true;hiStraight=uniq[4]}
    else if(uniq[0]===2&&uniq[4]===14&&uniq[1]===3&&uniq[2]===4&&uniq[3]===5){isStraight=true;hiStraight=5}
  }
  let cat;
  if(isFlush&&isStraight)cat=9;
  else if(grouped[0].n===4)cat=8;
  else if(grouped[0].n===3&&grouped[1]&&grouped[1].n===2)cat=7;
  else if(isFlush)cat=6;
  else if(isStraight)cat=5;
  else if(grouped[0].n===3)cat=4;
  else if(grouped[0].n===2&&grouped[1]&&grouped[1].n===2)cat=3;
  else if(grouped[0].n===2)cat=2;
  else cat=1;

  if(isStraight)return cat*1000000+hiStraight;

  let score=cat*1000000;
  for(let i=0;i<grouped.length;i++){
    score+=grouped[i].r<<((grouped.length-1-i)*4);
  }
  return score;
}

function makeDeck(exclude){
  const deck=[];
  for(let r=14;r>=2;r--)
    for(let s=0;s<4;s++){
      if(exclude.some(e=>e.r===r&&e.s===s))continue;
      deck.push({r,s});
    }
  return deck;
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const t=a[i];a[i]=a[j];a[j]=t;
  }
  return a;
}

function calcEquity(hole,boardFix,oppCount,iter,preflop){
  const own=hole.concat(boardFix);
  const deck=makeDeck(own);
  let w=0,t=0,l=0;
  for(let i=0;i<iter;i++){
    const d=shuffle(deck.slice());
    const fixLen=preflop?0:boardFix.length;
    let board=[];
    if(!preflop)board=boardFix.slice();
    for(let k=0;k<5-fixLen;k++)board.push(d[oppCount*2+k]);
    const myScore=evalBest(hole.concat(board));
    let oppBest=-1;
    for(let o=0;o<oppCount;o++){
      const od=[d[o*2],d[o*2+1]];
      const os=evalBest(od.concat(board));
      if(os>oppBest)oppBest=os;
    }
    if(myScore>oppBest)w++;
    else if(myScore===oppBest)t++;
    else l++;
  }
  return {winPct:w/iter*100,tiePct:t/iter*100,lossPct:l/iter*100};
}

document.addEventListener('DOMContentLoaded',()=>{
  buildPicker();
  renderSlots();

  qq('.slot').forEach(el=>el.addEventListener('click',()=>openPicker(el.dataset.slot)));
  q('#pickerClose').addEventListener('click',closePicker);
  q('#picker').addEventListener('click',e=>{if(e.target===q('#picker'))closePicker()});

  qq('.mode-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));

  q('#calcBtn').addEventListener('click',()=>{
    if(calculating)return;
    const hole=[slots.hole0,slots.hole1];
    const flop=[slots.flop0,slots.flop1,slots.flop2];
    if(!hole[0]||!hole[1])return toast('Введите 2 свои карты','err');
    const preflop=mode==='preflop';
    if(!preflop&&(!flop[0]||!flop[1]||!flop[2]))return toast('Введите 3 карты флопа','err');
    const oppCount=+q('#opponents').value;
    const iter=+q('#iterations').value;

    calculating=true;
    const btn=q('#calcBtn');
    btn.textContent='Считаем...';
    btn.style.opacity=.6;

    setTimeout(()=>{
      const res=calcEquity(hole,flop,oppCount,iter,preflop);
      const win=res.winPct.toFixed(1),tie=res.tiePct.toFixed(1),loss=(100-res.winPct-res.tiePct).toFixed(1);
      q('#winPct').textContent=win+'%';
      q('#tiePct').textContent=tie+'%';
      q('#lossPct').textContent=loss+'%';
      q('#eqWin').style.width=res.winPct+'%';
      q('#eqTie').style.width=res.tiePct+'%';
      q('#eqLoss').style.width=loss+'%';
      const handNames=hole.map(cardStr).join(' ');
      const flopStr=preflop?'(все карты разыграны)':'флоп '+flop.map(cardStr).join(' ');
      const verdict=res.winPct>=50?'Вы фаворит!':'Шансы ниже 50%';
      q('#equityNote').textContent=handNames+' против '+oppCount+' соперника(ов) · '+(preflop?'до флопа':'на флопе, '+flopStr)+'. '+verdict+' Эквити рассчитано '+(iter/1000)+'k симуляций.';
      q('#resultCard').style.display='block';
      q('#resultCard').scrollIntoView({behavior:'smooth',block:'nearest'});
      calculating=false;
      btn.textContent='Рассчитать эквити';
      btn.style.opacity=1;
    },30);
  });
});