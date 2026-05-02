import { useState, useRef, useCallback, useEffect } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { QUE_SUMMARY } from "./que-summary.js";

const LINE_NAMES = ['Sơ','Nhị','Tam','Tứ','Ngũ','Thượng'];
const CHI_NAMES = ['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];
const CHI_HOURS = ['23-1','1-3','3-5','5-7','7-9','9-11','11-13','13-15','15-17','17-19','19-21','21-23'];
const MH_NUM = {1:'111',2:'011',3:'101',4:'001',5:'110',6:'010',7:'100',8:'000'};
const VIET = {'111':'Thiên','000':'Địa','001':'Lôi','110':'Phong','010':'Thủy','101':'Hỏa','100':'Sơn','011':'Trạch'};

// ======== CORE (unchanged) ========
function lv2hex(lv){const l=[lv[2],lv[1],lv[0]].join(''),u=[lv[5],lv[4],lv[3]].join('');const i=HEXAGRAM_LOOKUP[u+l];return i!==undefined?HEXAGRAMS[i]:null}
function lv2ho(lv){const ha=[lv[3],lv[2],lv[1]].join(''),th=[lv[4],lv[3],lv[2]].join('');const i=HEXAGRAM_LOOKUP[th+ha];return i!==undefined?HEXAGRAMS[i]:null}
function lv2bien(lv,mv){const nv=lv.map((v,i)=>mv.includes(i)?(1-v):v);return lv2hex(nv)}
function bienLv(lv,mv){return lv.map((v,i)=>mv.includes(i)?(1-v):v)}
function hoLv(lv){return[lv[1],lv[2],lv[3],lv[2],lv[3],lv[4]]}
function jdn(d,m,y){let a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;let jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;if(jd<2299161)jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;return jd}
function nmJD(k){let T=k/1236.85,T2=T*T,r=Math.PI/180;let J=2415020.75933+29.53058868*k+.0001178*T2+.00033*Math.sin((166.56+132.87*T)*r);let M=359.2242+29.10535608*k,Mp=306.0253+385.81691806*k+.0107306*T2,F=21.2964+390.67050646*k-.0016528*T2;let C=(.1734-.000393*T)*Math.sin(M*r)+.0021*Math.sin(2*r*M)-.4068*Math.sin(Mp*r)+.0161*Math.sin(2*r*Mp)+.0104*Math.sin(2*r*F)-.0051*Math.sin(r*(M+Mp))-.0074*Math.sin(r*(M-Mp))+.0004*Math.sin(r*(2*F+M))-.0004*Math.sin(r*(2*F-M))-.0006*Math.sin(r*(2*F+Mp))+.001*Math.sin(r*(2*F-Mp))+.0005*Math.sin(r*(2*Mp+M));let dt=T<-11?.001+.000839*T+.0002261*T2:-.000278+.000265*T+.000262*T2;return J+C-dt}
function sL(jd){let T=(jd-2451545)/36525,r=Math.PI/180,M=357.5291+35999.0503*T,L=(280.46645+36000.76983*T+(1.9146-.004817*T)*Math.sin(r*M)+.019993*Math.sin(2*r*M)+.00029*Math.sin(3*r*M))*r;L-=Math.PI*2*Math.floor(L/(Math.PI*2));return Math.floor(L/Math.PI*6)}
function gLM11(y){let o=jdn(31,12,y)-2415021,k=Math.floor(o/29.530588853),n=nmJD(k);if(sL(n+7/24)>=9)n=nmJD(k-1);return Math.floor(n+.5)}
function gLMO(a){let k=Math.floor((a-2415021.076998695)/29.530588853+.5),l=0,i=1,cc=sL(nmJD(k+i)+7/24);do{l=cc;i++;cc=sL(nmJD(k+i)+7/24)}while(cc!==l&&i<14);return i-1}
function s2l(d,m,y){let n=jdn(d,m,y),k=Math.floor((n-2415021.076998695)/29.530588853),ms=Math.floor(nmJD(k)+.5);if(ms>n)ms=Math.floor(nmJD(k-1)+.5);
  // Also check k+1: if next new moon is on or before n, use it
  const ms2=Math.floor(nmJD(k+1)+.5);if(ms2<=n)ms=ms2;
  let a=gLM11(y),b=a,ly;if(a>=ms){ly=y;a=gLM11(y-1)}else{ly=y+1;b=gLM11(y+1)}let ld=n-ms+1,df=Math.floor((ms-a)/29),ll=0,lm=df+11;if(b-a>365){let lo=gLMO(a);if(df>=lo){lm=df+10;if(df===lo)ll=1}}if(lm>12)lm-=12;if(lm>=11&&df<4)ly-=1;return{day:ld,month:lm,year:ly}}
function hIdx(h){return h>=23||h<1?0:Math.floor((h-1)/2)+1}
function mhCalc(u,l,t){const uu=((u-1)%8)+1,ll=((l-1)%8)+1,mv=((t-1)%6);const uK=MH_NUM[uu],lK=MH_NUM[ll];const lv=[...lK.split('').reverse().map(Number),...uK.split('').reverse().map(Number)];const moving=[mv];const lines=lv.map((v,i)=>({value:moving.includes(i)?(v===1?9:6):(v===1?7:8)}));return{chinh:lv2hex(lv),bien:lv2bien(lv,moving),queHo:lv2ho(lv),lines,lineValues:lv,moving}}
function nowTS(){const d=new Date();return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`}
function shortQ(hex){if(!hex)return'';const p=hex[1].split(' ');return p.length>2?p.slice(2).join(' '):hex[1]}
// Calendar short name: strip "Thuần " prefix
function calQ(hex){if(!hex)return'';const n=shortQ(hex);return n.replace('Thuần ','')}

// SVG Icons (utility)
const Icon=({d,size=20,color='currentColor'})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
const ICONS={
  back:'M15 18l-6-6 6-6',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1',
  share:'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13',
  save:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2 M17 21v-8H7v8 M7 3v5h8',
  list:'M8 6h13 M8 12h13 M8 18h13 M3 6h0 M3 12h0 M3 18h0',
};

// Rich menu icons (v1 design)
const MI=({type,size=48})=>{
  const s=size,g='#c8a45c',g2='#8b6b3a';
  const sv=(children)=><svg width={s} height={s} viewBox="-30 -30 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">{children}</svg>;
  if(type==='thoi') return sv(<g>
    <circle cx="0" cy="0" r="24" stroke={g} strokeWidth="1.6"/>
    {/* Prominent hour markers at 12,3,6,9 */}
    <line x1="0" y1="-20" x2="0" y2="-24" stroke={g} strokeWidth="2" strokeLinecap="round"/>
    <line x1="20" y1="0" x2="24" y2="0" stroke={g} strokeWidth="2" strokeLinecap="round"/>
    <line x1="0" y1="20" x2="0" y2="24" stroke={g} strokeWidth="2" strokeLinecap="round"/>
    <line x1="-20" y1="0" x2="-24" y2="0" stroke={g} strokeWidth="2" strokeLinecap="round"/>
    {/* Small dots for other hours */}
    {[30,60,120,150,210,240,300,330].map(a=><circle key={a} cx={21*Math.cos((a-90)*Math.PI/180)} cy={21*Math.sin((a-90)*Math.PI/180)} r=".8" fill={g} opacity=".4"/>)}
    {/* Hour hand pointing at ~10 */}
    <line x1="0" y1="0" x2="-8" y2="-12" stroke={g} strokeWidth="2.5" strokeLinecap="round"/>
    {/* Minute hand pointing at ~2 */}
    <line x1="0" y1="0" x2="10" y2="-6" stroke={g2} strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="0" cy="0" r="2.5" fill={g}/>
  </g>);
  if(type==='khac') return sv(<g>
    {/* Hourglass shape — completely different silhouette */}
    <line x1="-16" y1="-22" x2="16" y2="-22" stroke={g} strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="-16" y1="22" x2="16" y2="22" stroke={g} strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M-14 -22 L-14 -10 Q-14 0 0 0 Q14 0 14 -10 L14 -22" fill="none" stroke={g} strokeWidth="1.4"/>
    <path d="M-14 22 L-14 10 Q-14 0 0 0 Q14 0 14 10 L14 22" fill="none" stroke={g} strokeWidth="1.4"/>
    {/* Sand top */}
    <path d="M-8 -16 L-8 -10 Q-8 -4 0 -2 Q8 -4 8 -10 L8 -16" fill={g} opacity=".1"/>
    {/* Sand bottom */}
    <path d="M-10 18 Q-10 12 0 10 Q10 12 10 18 L10 20 L-10 20Z" fill={g} opacity=".15"/>
    {/* Sand stream */}
    <line x1="0" y1="-2" x2="0" y2="8" stroke={g} strokeWidth=".8" opacity=".4"/>
    <circle cx="0" cy="4" r=".8" fill={g} opacity=".5"/>
  </g>);
  if(type==='giay') return sv(<g>
    {/* Water drop — khoảnh khắc */}
    <path d="M0 -24 Q-8 -10 -8 -2 A8 8 0 0 0 8 -2 Q8 -10 0 -24Z" fill={g} opacity=".12" stroke={g} strokeWidth="1.3"/>
    {/* Highlight on drop */}
    <path d="M-3 -8 Q-1 -12 0 -14" fill="none" stroke={g} strokeWidth=".8" opacity=".5" strokeLinecap="round"/>
    {/* Ripple rings */}
    <ellipse cx="0" cy="10" rx="10" ry="3.5" fill="none" stroke={g} strokeWidth="1" opacity=".5"/>
    <ellipse cx="0" cy="13" rx="18" ry="5.5" fill="none" stroke={g} strokeWidth=".7" opacity=".3"/>
    <ellipse cx="0" cy="16" rx="24" ry="7" fill="none" stroke={g} strokeWidth=".4" opacity=".15"/>
    {/* Impact dot */}
    <circle cx="0" cy="8" r="1.5" fill={g} opacity=".6"/>
  </g>);
  if(type==='ngaunhien') return sv(<g>
    <circle cx="-10" cy="6" r="15" stroke={g2} strokeWidth="1" opacity=".45"/>
    <rect x="-14" y="3" width="8" height="6" rx=".8" fill="none" stroke={g2} strokeWidth=".7" opacity=".45"/>
    <circle cx="10" cy="6" r="15" stroke={g2} strokeWidth="1" opacity=".55"/>
    <rect x="6" y="3" width="8" height="6" rx=".8" fill="none" stroke={g2} strokeWidth=".7" opacity=".55"/>
    <circle cx="0" cy="-8" r="16" stroke={g} strokeWidth="1.5"/>
    <circle cx="0" cy="-8" r="12" stroke={g} strokeWidth=".4" opacity=".3"/>
    <rect x="-4.5" y="-11.5" width="9" height="7" rx=".8" fill="none" stroke={g} strokeWidth="1"/>
    <circle cx="0" cy="-20" r="1" fill={g} opacity=".4"/>
    <circle cx="0" cy="4" r="1" fill={g} opacity=".4"/>
    <circle cx="-12" cy="-8" r="1" fill={g} opacity=".4"/>
    <circle cx="12" cy="-8" r="1" fill={g} opacity=".4"/>
  </g>);
  if(type==='nhap') return sv(<g strokeLinecap="round">
    <line x1="-20" y1="-20" x2="20" y2="-20" stroke={g} strokeWidth="3"/>
    <line x1="-20" y1="-10" x2="-3" y2="-10" stroke={g} strokeWidth="2.5" opacity=".85"/>
    <line x1="3" y1="-10" x2="20" y2="-10" stroke={g} strokeWidth="2.5" opacity=".85"/>
    <line x1="-20" y1="0" x2="20" y2="0" stroke={g} strokeWidth="3"/>
    <line x1="-20" y1="10" x2="-3" y2="10" stroke={g} strokeWidth="2.5" opacity=".85"/>
    <line x1="3" y1="10" x2="20" y2="10" stroke={g} strokeWidth="2.5" opacity=".85"/>
    <line x1="-20" y1="20" x2="20" y2="20" stroke={g} strokeWidth="3"/>
    <path d="M24-6l3 4-3 4" fill="none" stroke={g2} strokeWidth="1" opacity=".6"/>
  </g>);
  if(type==='dacbiet') return sv(<g>
    <circle cx="0" cy="-18" r="3" fill={g} opacity=".7"/>
    <circle cx="16" cy="0" r="2.5" fill={g} opacity=".5"/>
    <circle cx="0" cy="18" r="3" fill={g} opacity=".7"/>
    <circle cx="-16" cy="0" r="2.5" fill={g} opacity=".5"/>
    <circle cx="0" cy="0" r="3.5" fill={g} opacity=".9"/>
    <line x1="0" y1="-14" x2="14" y2="0" stroke={g} strokeWidth=".5" opacity=".25"/>
    <line x1="14" y1="0" x2="0" y2="14" stroke={g} strokeWidth=".5" opacity=".25"/>
    <line x1="0" y1="14" x2="-14" y2="0" stroke={g} strokeWidth=".5" opacity=".25"/>
    <line x1="-14" y1="0" x2="0" y2="-14" stroke={g} strokeWidth=".5" opacity=".25"/>
    <circle cx="10" cy="-12" r="1.5" fill={g2} opacity=".35"/>
    <circle cx="-10" cy="12" r="1.5" fill={g2} opacity=".35"/>
    <circle cx="10" cy="12" r="1.5" fill={g2} opacity=".35"/>
    <circle cx="-10" cy="-12" r="1.5" fill={g2} opacity=".35"/>
  </g>);
  if(type==='lichviet') return sv(<g>
    {/* Calendar page */}
    <rect x="-20" y="-18" width="40" height="38" rx="4" fill="none" stroke={g} strokeWidth="1.4"/>
    <line x1="-20" y1="-8" x2="20" y2="-8" stroke={g} strokeWidth="1"/>
    {/* Calendar rings */}
    <line x1="-10" y1="-22" x2="-10" y2="-16" stroke={g} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="10" y1="-22" x2="10" y2="-16" stroke={g} strokeWidth="1.5" strokeLinecap="round"/>
    {/* Moon crescent inside */}
    <path d="M2 2 A6 6 0 1 0 2 14 A4.5 4.5 0 1 1 2 2" fill={g} opacity=".3" stroke={g} strokeWidth=".6"/>
    {/* Date dots */}
    <circle cx="-12" cy="-2" r="1" fill={g} opacity=".3"/>
    <circle cx="-4" cy="-2" r="1" fill={g} opacity=".3"/>
    <circle cx="12" cy="-2" r="1" fill={g} opacity=".3"/>
    <circle cx="-12" cy="14" r="1" fill={g} opacity=".3"/>
    <circle cx="12" cy="14" r="1" fill={g} opacity=".3"/>
  </g>);
  if(type==='tracuu') return sv(<g>
    <circle cx="-4" cy="-4" r="14" fill="none" stroke={g} strokeWidth="1.6"/>
    <line x1="6" y1="6" x2="20" y2="20" stroke={g} strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="-12" y1="-8" x2="4" y2="-8" stroke={g} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="-12" y1="-3" x2="-6" y2="-3" stroke={g} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="-2" y1="-3" x2="4" y2="-3" stroke={g} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="-12" y1="2" x2="4" y2="2" stroke={g} strokeWidth="1.5" strokeLinecap="round"/>
  </g>);
  return null;
};

// Yin-Yang SVG component
const YinYang=({size=140,spinning=false})=>(
  <div className={spinning?'spin-active':''} style={{width:size,height:size,filter:spinning?'':'drop-shadow(0 8px 24px rgba(139,115,70,.25))'}}>
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs><linearGradient id="yy1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c8a45c"/><stop offset="100%" stopColor="#8b7346"/></linearGradient></defs>
      <circle cx="50" cy="50" r="48" fill="url(#yy1)"/>
      <path d="M50 2A48 48 0 0 1 50 98A24 24 0 0 1 50 50A24 24 0 0 0 50 2" fill="#fff" opacity=".95"/>
      <circle cx="50" cy="26" r="6" fill="#8b7346"/>
      <circle cx="50" cy="74" r="6" fill="#fff" opacity=".9"/>
    </svg>
  </div>
);

// ======== APP ========
export default function App(){
  const[view,setView]=useState('home');
  const[result,setResult]=useState(null);
  const[popup,setPopup]=useState(null);
  const[dark,setDark]=useState(()=>localStorage.getItem('kd_dark')==='1');
  const[kbSecret,setKbSecret]=useState(()=>localStorage.getItem('kd_kb_secret')||'');
  const[userName,setUserName]=useState(()=>localStorage.getItem('kd_username')||'');
  const[aiModel,setAiModel]=useState(()=>localStorage.getItem('kd_model')||'claude-sonnet-4-20250514');
  const[luanResult,setLuanResult]=useState('');
  const[luanLoading,setLuanLoading]=useState(false);
  const[showSettings,setShowSettings]=useState(false);
  const[history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('kd_history')||'[]')}catch{return[]}});
  const[saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem('kd_saved')||'[]')}catch{return[]}});
  const[showSaved,setShowSaved]=useState(false);
  const[chatHistory,setChatHistory]=useState([]);
  const[followUp,setFollowUp]=useState('');
  const[phamVi,setPhamVi]=useState('');
  const[specialNum,setSpecialNum]=useState('');
  const[dacBietResult,setDacBietResult]=useState(null);
  const[manualUpper,setManualUpper]=useState('111');
  const[manualLower,setManualLower]=useState('000');
  const[manualMoving,setManualMoving]=useState([]);
  const[qName,setQName]=useState('');
  const[qText,setQText]=useState('');
  const[qResult,setQResult]=useState(null);
  const[spinning,setSpinning]=useState(false);
  // Calendar
  const[calYear,setCalYear]=useState(()=>new Date().getFullYear());
  const[calMonth,setCalMonth]=useState(()=>new Date().getMonth()+1);
  const[calDay,setCalDay]=useState(null);
  const[calHour,setCalHour]=useState(null);
  const[calFrom,setCalFrom]=useState('lichviet'); // tracks where lichday was opened from
  const[showMonthPicker,setShowMonthPicker]=useState(false);
  // Tra cứu
  const[tcChinh,setTcChinh]=useState('');
  const[tcBien,setTcBien]=useState('');
  const[tcYear,setTcYear]=useState(()=>new Date().getFullYear());
  const[tcResults,setTcResults]=useState(null);
  const[tcLoading,setTcLoading]=useState(false); // selected day for 12-hour view

  const toggleDark=()=>{const n=!dark;setDark(n);localStorage.setItem('kd_dark',n?'1':'0')};
  const goHome=()=>{setView('home');setResult(null);setLuanResult('');setChatHistory([]);setDacBietResult(null)};
  const goBack=()=>{if(view==='lichhour')setView('lichday');else if(view==='lichday')setView(calFrom);else if(view==='tracuu')goHome();else goHome()};

  // Swipe - iOS style
  const swipeRef=useRef({x:0,y:0,t:0,active:false});
  const[swipeX,setSwipeX]=useState(0);
  const skipTransRef=useRef(false); // skip transition after goBack

  const onTS=useCallback(e=>{const t=e.touches[0];swipeRef.current={x:t.clientX,y:t.clientY,t:Date.now(),active:t.clientX<60}},[]);
  const onTM=useCallback(e=>{if(!swipeRef.current.active)return;const dx=e.touches[0].clientX-swipeRef.current.x;const dy=Math.abs(e.touches[0].clientY-swipeRef.current.y);if(dy>Math.abs(dx)&&dx<15){swipeRef.current.active=false;return}if(dx>0)setSwipeX(dx)},[]);
  const onTE=useCallback(e=>{
    if(!swipeRef.current.active){setSwipeX(0);return}
    const dx=e.changedTouches[0].clientX-swipeRef.current.x;
    const dt=Date.now()-swipeRef.current.t;
    const v=dx/Math.max(dt,1);
    const W=window.innerWidth;
    if(dx>W*.35||v>.5){
      // Animate current page off right edge
      setSwipeX(W);
      setTimeout(()=>{
        // Switch view with NO transition — new page appears instantly at x=0
        skipTransRef.current=true;
        goBack();
        setSwipeX(0);
        // Re-enable transition after paint
        requestAnimationFrame(()=>{requestAnimationFrame(()=>{skipTransRef.current=false})});
      },280);
    }else{
      setSwipeX(0); // spring back
    }
  },[view]);
  const pullRef=useRef(0);const[pullY,setPullY]=useState(0);

  // KB
  const[kbBooks,setKbBooks]=useState([]);const[kbNotes,setKbNotes]=useState([]);
  useEffect(()=>{fetch('/api/knowledge').then(r=>r.json()).then(d=>{if(d.ok){setKbBooks(d.books||[]);setKbNotes(d.notes||[])}}).catch(()=>{})},[]);
  const findKB=(qn)=>{if(!qn)return'';const kw=qn.toLowerCase().split(' ').filter(w=>w.length>1);const all=[...kbBooks,...kbNotes];const scored=all.map(c=>{const t=((c.name||'')+' '+(c.text||'')).toLowerCase();let s=0;kw.forEach(k=>{if(t.includes(k))s++});if((c.name||'').toLowerCase().includes(qn.toLowerCase()))s+=10;return{c,s}}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,5);const notes=kbNotes.map(n=>`[ghi chú/${n.author||'user'}/${n.name||''}]\n${n.text}`).join('\n---\n');const books=scored.filter(x=>x.c.source!=='user').map(({c})=>`[${c.source||'sách'}/${c.name||''}]\n${c.text}`).join('\n---\n');return[notes,books].filter(Boolean).join('\n---\n')};

  // Theme
  const T={
    bg:dark?'#111113':'#faf9f6', fg:dark?'#d4d0c8':'#1a1a1f', card:dark?'#1c1c22':'#ffffff',
    muted:dark?'#6b6860':'#9a958c', border:dark?'#2a2a30':'#e8e4dd',
    accent:dark?'#c8a45c':'#8b7346', accentSoft:dark?'#2a2218':'#f5efe4',
    red:dark?'#c06060':'#a04040', calRed:dark?'#ef5350':'#e53935', green:dark?'#6a9c79':'#4a7c59',
    blue:dark?'#6a8baa':'#4a6b8a', purple:dark?'#8b7baa':'#6b5b8a',
    amber:dark?'#c8a45c':'#8b7346', teal:dark?'#6a9a9a':'#4a7a7a',
    shadow:dark?'none':'0 2px 12px rgba(0,0,0,.05)',
  };

  // Wrap styles
  const isSwiping=swipeRef.current.active&&swipeX>0;
  const isFlying=!swipeRef.current.active&&swipeX>0;
  const noTrans=skipTransRef.current;
  const wrap={
    position:'absolute',inset:0,background:T.bg,color:T.fg,overflow:'hidden',
    paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)',
    paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)',
    transform:swipeX>0?`translateX(${swipeX}px)`:'none',
    transition:noTrans?'none':(!isSwiping?'transform .3s cubic-bezier(.2,.9,.3,1)':'none'),
    boxShadow:swipeX>10?`-6px 0 24px rgba(0,0,0,${Math.min(swipeX/400,.3)})`:undefined,
  };
  const wrapScroll={...wrap,overflow:'auto',WebkitOverflowScrolling:'touch'};

  // ======== CAST ========
  const addHist=(r)=>{setHistory(prev=>{const u=[r,...prev].slice(0,50);localStorage.setItem('kd_history',JSON.stringify(u));return u})};
  const buildR=(r,method,question='',name='')=>{const lu=s2l(new Date().getDate(),new Date().getMonth()+1,new Date().getFullYear());return{id:Date.now(),...r,method,question,name,lunar:lu,ts:nowTS()}};
  const castMH=(method)=>{const now=new Date(),lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear()),hi=hIdx(now.getHours())+1;let us,ls;if(method==='thoi'){us=lu.year+lu.month+lu.day;ls=us+hi}else if(method==='khac'){us=lu.year+lu.month+lu.day+hi;ls=us+(now.getMinutes()+1)}else{const sec=now.getSeconds()+1;us=lu.year+lu.month+lu.day+hi;ls=us+sec}const r=buildR(mhCalc(us,ls,ls),method==='thoi'?'Thời':method==='khac'?'Khắc':'Giây');setResult(r);addHist(r);setLuanResult('');setChatHistory([]);setPhamVi('');setView('result')};
  const castNgauNhien=()=>{const now=Date.now();const s1=now%100000,s2=Math.floor(now/7)%100000;const r=buildR(mhCalc(s1||1,s2||1,(s1+s2)||1),'Ngẫu Nhiên');setResult(r);addHist(r);setLuanResult('');setChatHistory([]);setPhamVi('');setView('ngaunhien')};
  const castDacBiet=()=>{const nums=specialNum.replace(/\D/g,'');if(!nums){alert('Nhập số');return}const total=nums.split('').reduce((a,b)=>a+parseInt(b),0),mid=Math.floor(nums.length/2)||1;const u=nums.slice(0,mid).split('').reduce((a,b)=>a+parseInt(b),0)||1,l=nums.slice(mid).split('').reduce((a,b)=>a+parseInt(b),0)||1;const r=buildR(mhCalc(u,l,total||1),'Đặc Biệt');setResult(r);addHist(r);setDacBietResult(r);setLuanResult('');setChatHistory([]);setPhamVi('')};
  const castNhap=()=>{const lo=manualLower.split('').reverse().map(Number),up=manualUpper.split('').reverse().map(Number);const lv=[...lo,...up];const moving=[...manualMoving];const lines=lv.map((v,i)=>({value:moving.includes(i)?(v===1?9:6):(v===1?7:8)}));const r=buildR({chinh:lv2hex(lv),bien:moving.length>0?lv2bien(lv,moving):null,queHo:lv2ho(lv),lines,lineValues:lv,moving},'Nhập Quẻ');setResult(r);addHist(r);setLuanResult('');setChatHistory([]);setPhamVi('');setView('result')};
  const castQuestion=()=>{setSpinning(true);setTimeout(()=>{const now=new Date(),lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear()),hi=hIdx(now.getHours())+1;const sec=now.getSeconds()+1,ms=now.getMilliseconds()+1;const us=lu.year+lu.month+lu.day+hi,ls=us+sec;const r=buildR(mhCalc(us,ls,ls+ms),'Gieo Quẻ',qText,qName);setQResult(r);addHist(r);setSpinning(false)},1400)};
  const saveQ=()=>{if(!qResult)return;setSaved(prev=>{const u=[{...qResult,savedAt:new Date().toLocaleString('vi-VN')},...prev];localStorage.setItem('kd_saved',JSON.stringify(u));return u});alert('✓ Đã lưu')};
  const shareResult=async(r)=>{if(!r?.chinh)return;
    const uTr=TRIGRAMS[r.chinh[3]],lTr=TRIGRAMS[r.chinh[4]];
    const mv0=r.moving?.[0];const isUp=mv0>=3;
    const the=isUp?lTr:uTr,dung=isUp?uTr:lTr;
    // Draw on canvas
    const cv=document.createElement('canvas');cv.width=600;cv.height=480;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#faf9f6';ctx.fillRect(0,0,600,480);
    ctx.fillStyle='#8b7346';ctx.font='bold 22px serif';ctx.textAlign='center';
    ctx.fillText('☯ KINH DỊCH',300,36);
    ctx.fillStyle='#333';ctx.font='14px sans-serif';
    if(r.name)ctx.fillText(r.name,300,60);
    if(r.question)ctx.fillText(r.question,300,80);
    ctx.fillStyle='#888';ctx.font='12px sans-serif';
    ctx.fillText(r.method+' • '+r.ts,300,100);
    // Draw 3 hexagrams
    const drawHex=(lv,x,y,label)=>{
      ctx.fillStyle='#8b7346';ctx.font='bold 11px sans-serif';ctx.fillText(label,x,y-55);
      for(let i=5;i>=0;i--){
        const ly=y-i*14;ctx.fillStyle='#1a1a1f';
        if(lv[5-i]===1){ctx.fillRect(x-25,ly,50,7)}
        else{ctx.fillRect(x-25,ly,22,7);ctx.fillRect(x+3,ly,22,7)}
      }
    };
    const lv=r.lineValues;
    drawHex(lv,150,190,'CHÁNH');
    if(r.queHo)drawHex(hoLv(lv),300,190,'HỘ');
    if(r.bien)drawHex(bienLv(lv,r.moving),450,190,'BIẾN');
    // Names
    ctx.fillStyle='#8b7346';ctx.font='bold 16px serif';
    ctx.fillText(shortQ(r.chinh),150,260);
    if(r.queHo)ctx.fillText(shortQ(r.queHo),300,260);
    if(r.bien)ctx.fillText(shortQ(r.bien),450,260);
    // Thể Dụng
    ctx.fillStyle='#333';ctx.font='13px sans-serif';
    if(r.moving?.length){ctx.fillText('Thể: '+the.name+' ('+the.element+')  —  Dụng: '+dung.name+' ('+dung.element+')',300,300)}
    // Watermark
    ctx.fillStyle='#ccc';ctx.font='11px sans-serif';ctx.fillText('kinhdich-ten.vercel.app',300,460);
    // Share
    try{
      const blob=await new Promise(res=>cv.toBlob(res,'image/png'));
      const file=new File([blob],'kinhdich.png',{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:'Kinh Dịch'});
      }else{
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kinhdich.png';a.click();URL.revokeObjectURL(url);
      }
    }catch{
      let text=`☯ KINH DỊCH\n`;if(r.name)text+=r.name+'\n';if(r.question)text+=r.question+'\n';text+=r.method+' • '+r.ts+'\n\n▸ Chánh: '+r.chinh[1]+'\n';if(r.queHo)text+='▸ Hộ: '+r.queHo[1]+'\n';if(r.bien)text+='▸ Biến: '+r.bien[1]+'\n';
      navigator.clipboard?.writeText(text).then(()=>alert('✓ Đã copy text'));
    }
  };

  // AI
  const buildPrompt=()=>{if(!result?.chinh)return'';const ch=result.chinh,uTr=TRIGRAMS[ch[3]],lTr=TRIGRAMS[ch[4]];let p=`# Gieo Quẻ Kinh Dịch\n`;if(result.question)p+=`**Câu hỏi:** ${result.question}\n`;if(result.name)p+=`**Sự việc:** ${result.name}\n`;if(phamVi)p+=`**Phạm vi:** ${phamVi}\n`;p+=`**${result.method}** • ${result.ts}`;if(result.lunar)p+=` • ÂL ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}`;p+=`\n\n## Quẻ Chánh: ${ch[1]}\n- Thượng: ${uTr.name} (${uTr.nature}, ${uTr.element})\n- Hạ: ${lTr.name} (${lTr.nature}, ${lTr.element})\n`;if(result.moving?.length>0){const mv0=result.moving[0],isUp=mv0>=3;p+=`- **Thể**: ${isUp?lTr.name:uTr.name} (${isUp?lTr.element:uTr.element})\n- **Dụng**: ${isUp?uTr.name:lTr.name} (${isUp?uTr.element:lTr.element})\n`}p+=`\n## 6 Hào:\n`;result.lines.forEach((l,i)=>{const isM=result.moving.includes(i);p+=`- ${LINE_NAMES[i]}: ${l.value===9?'Lão Dương':l.value===6?'Lão Âm':l.value===7?'Thiếu Dương':'Thiếu Âm'}${isM?' ★ĐỘNG':''}\n`});if(result.queHo)p+=`\n## Quẻ Hộ: ${result.queHo[1]} — ${result.queHo[5]}\n`;if(result.bien)p+=`\n## Quẻ Biến: ${result.bien[1]} — ${result.bien[5]}\n`;const refs=[findKB(ch[1]),result.queHo?findKB(result.queHo[1]):'',result.bien?findKB(result.bien[1]):''].filter(Boolean).join('\n---\n');if(refs)p+=`\n[REFERENCE]\n${refs}\n[/REFERENCE]\n`;p+=`\n---\nLuận giải. Thể/Dụng, Hộ, Biến. Lời khuyên cụ thể.`;return p};
  const callAI=async(msgs,onS)=>{const res=await fetch('/api/luan-giai',{method:'POST',headers:{'Content-Type':'application/json','x-kb-secret':kbSecret,'x-user':userName||'anon'},body:JSON.stringify({model:aiModel,max_tokens:4096,system:SYSTEM_PROMPT,messages:msgs})});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'API error')}const reader=res.body.getReader(),dec=new TextDecoder();let full='',buf='';while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop()||'';for(const l of ls){if(!l.startsWith('data: '))continue;try{const o=JSON.parse(l.slice(6));if(o.type==='content_block_delta'&&o.delta?.text){full+=o.delta.text;onS?.(full)}}catch{}}}return full};
  const luanQue=async()=>{if(!kbSecret){setShowSettings(true);return}setLuanResult('');setLuanLoading(true);setChatHistory([]);try{const p=buildPrompt();const t=await callAI([{role:'user',content:p}],setLuanResult);setChatHistory([{role:'user',content:p},{role:'assistant',content:t}])}catch(e){setLuanResult('❌ '+e.message)}finally{setLuanLoading(false)}};
  const sendFU=async()=>{if(!followUp.trim()||luanLoading)return;const m={role:'user',content:followUp},h=[...chatHistory,m];setChatHistory(h);setFollowUp('');setLuanLoading(true);try{const t=await callAI(h,p=>setChatHistory([...h,{role:'assistant',content:p}]));setChatHistory([...h,{role:'assistant',content:t}])}catch(e){setChatHistory([...h,{role:'assistant',content:'❌ '+e.message}])}finally{setLuanLoading(false)}};

  // ======== UI COMPONENTS ========
  const RHex=({lv,hl=[],w=90})=>{
    const h=Math.max(7,w/10);const gap=Math.max(7,w/8);const half=(w-w*.1)/2;
    return<div style={{display:'flex',flexDirection:'column-reverse',alignItems:'center',gap}}>{lv.map((v,i)=>{const isH=hl.includes(i);const cl=isH?T.red:T.fg;return<div key={i} style={{width:w,display:'flex',justifyContent:v===1?'center':'space-between'}}>{v===1?<div style={{width:w,height:h,background:cl,borderRadius:3}}/>:<><div style={{width:half,height:h,background:cl,borderRadius:3}}/><div style={{width:half,height:h,background:cl,borderRadius:3}}/></>}</div>})}</div>
  };

  const QB=({hex,lv,label,w=90,hl=[]})=>{if(!hex)return null;return<div style={{textAlign:'center',cursor:'pointer',flex:1}} onClick={()=>setPopup(hex)}><div style={{fontSize:10,color:T.muted,marginBottom:8,fontWeight:600,letterSpacing:2,textTransform:'uppercase'}}>{label}</div><RHex lv={lv} w={w} hl={hl}/><div style={{marginTop:10,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:14,color:T.muted,lineHeight:1.2}}>{VIET[hex[3]]||''}<br/>{VIET[hex[4]]||''}</div><div style={{fontSize:18,fontWeight:700,color:T.accent,marginTop:4,fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{shortQ(hex)}</div></div>};

  // Thể Dụng
  const SINH={'Kim':'Thủy','Thủy':'Mộc','Mộc':'Hỏa','Hỏa':'Thổ','Thổ':'Kim'};
  const KHAC={'Kim':'Mộc','Mộc':'Thổ','Thổ':'Thủy','Thủy':'Hỏa','Hỏa':'Kim'};
  const EC={'Hỏa':'#a04040','Kim':'#8b7346','Mộc':'#4a7c59','Thủy':'#4a6b8a','Thổ':'#6d5c41'};
  const TheDung=({r})=>{if(!r?.chinh||!r.moving?.length)return null;const mv0=r.moving[0],isUp=mv0>=3;const uTr=TRIGRAMS[r.chinh[3]],lTr=TRIGRAMS[r.chinh[4]];const the=isUp?lTr:uTr,dung=isUp?uTr:lTr;const theEl=the.element,dungEl=dung.element;let rel='',relClr=T.muted;if(SINH[dungEl]===theEl){rel='Dụng sinh Thể → Cát';relClr=T.green}else if(SINH[theEl]===dungEl){rel='Thể sinh Dụng → Hao';relClr=T.amber}else if(KHAC[dungEl]===theEl){rel='Dụng khắc Thể → Hung';relClr=T.red}else if(KHAC[theEl]===dungEl){rel='Thể khắc Dụng → Tài';relClr=T.blue}else{rel='Tỷ hòa → Bình';relClr=T.accent}return<div style={{display:'flex',justifyContent:'center',gap:16,padding:'12px 16px',marginBottom:10,background:T.card,borderRadius:12,boxShadow:T.shadow,fontSize:13}}><div style={{textAlign:'center'}}><div style={{fontSize:10,color:T.muted,fontWeight:600,marginBottom:2}}>THỂ</div><div style={{fontWeight:700,color:EC[theEl]||T.fg}}>{the.name} · {theEl}</div></div><div style={{textAlign:'center',alignSelf:'center',padding:'4px 10px',background:relClr+'15',borderRadius:8}}><div style={{fontSize:12,fontWeight:700,color:relClr}}>{rel}</div></div><div style={{textAlign:'center'}}><div style={{fontSize:10,color:T.muted,fontWeight:600,marginBottom:2}}>DỤNG</div><div style={{fontWeight:700,color:EC[dungEl]||T.fg}}>{dung.name} · {dungEl}</div></div></div>};

  // Popup
  const Pop=()=>{if(!popup)return null;const sumKey=popup[1].toUpperCase();const sum=QUE_SUMMARY[sumKey];
    // Extract first keyword for bold red display
    const firstKW=sum?sum[1].split(',')[0].trim().toUpperCase():'';
    return<div onClick={()=>setPopup(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
    <div onClick={e=>e.stopPropagation()} style={{background:dark?'#1c1c20':'#fff',borderRadius:20,maxWidth:400,width:'100%',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'80vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'20px 24px',textAlign:'center',borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:22,fontWeight:700,color:T.fg}}>{popup[1]}</div>
      </div>
      <div style={{padding:'20px 24px',overflowY:'auto',flex:1}}>
        {sum&&<div style={{marginBottom:14}}>
          <span style={{fontSize:15,color:T.fg}}>{sum[0]}. </span>
          <span style={{fontSize:16,fontWeight:700,color:'#c62828'}}>{firstKW}.</span>
        </div>}
        {sum&&sum[1]&&<div style={{fontSize:14,lineHeight:1.8,color:T.fg,marginBottom:12}}>- {sum[1]}</div>}
        {sum&&sum[2]&&<div style={{fontSize:13,lineHeight:1.7,color:T.muted,fontStyle:'italic',marginBottom:12}}>{sum[2]}</div>}
        {!sum&&<div style={{fontSize:14,lineHeight:1.8,color:T.fg,marginBottom:14}}>{popup[5]}</div>}
      </div>
      <button onClick={()=>setPopup(null)} style={{width:'100%',padding:16,background:T.accent,color:'#fff',border:'none',fontSize:15,fontWeight:600,flexShrink:0}}>OK</button>
    </div></div>};

  // Settings
  const Sett=()=>showSettings&&<div onClick={()=>setShowSettings(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:T.card,borderRadius:20,padding:24,maxWidth:400,width:'100%',color:T.fg}}><h3 style={{margin:'0 0 20px',color:T.accent,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:22}}>Cài Đặt</h3>{[['Tên',userName,v=>{setUserName(v);localStorage.setItem('kd_username',v)},'text'],['KB Secret',kbSecret,v=>{setKbSecret(v);localStorage.setItem('kd_kb_secret',v)},'password']].map(([l,val,fn,t])=><div key={l} style={{marginBottom:14}}><label style={{fontSize:12,display:'block',marginBottom:4,color:T.muted,fontWeight:500}}>{l}</label><input type={t} value={val} onChange={e=>fn(e.target.value)} style={{width:'100%',padding:12,border:`1px solid ${T.border}`,borderRadius:10,boxSizing:'border-box',fontSize:14,background:T.bg,color:T.fg}}/></div>)}<div style={{marginBottom:14}}><label style={{fontSize:12,display:'block',marginBottom:4,color:T.muted,fontWeight:500}}>Model</label><select value={aiModel} onChange={e=>{setAiModel(e.target.value);localStorage.setItem('kd_model',e.target.value)}} style={{width:'100%',padding:12,border:`1px solid ${T.border}`,borderRadius:10,fontSize:14,background:T.bg,color:T.fg}}><option value="claude-sonnet-4-20250514">Sonnet 4</option><option value="claude-opus-4-20250514">Opus 4</option></select></div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><span style={{fontSize:14}}>Giao diện tối</span><button onClick={toggleDark} style={{padding:'8px 20px',border:`1px solid ${T.border}`,borderRadius:8,background:dark?'#333':'#f0f0f0',color:dark?'#fff':'#333',fontSize:13}}>{dark?'🌙 Bật':'☀️ Tắt'}</button></div><button onClick={()=>setShowSettings(false)} style={{width:'100%',padding:12,background:T.accent,color:'#fff',border:'none',borderRadius:10,fontWeight:600}}>Đóng</button></div></div>;

  const ListModal=({show,items,title,onClose,onSelect,onRemove,empty})=>show&&<div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:T.card,borderRadius:20,padding:20,maxWidth:500,width:'100%',maxHeight:'80vh',color:T.fg}}><h3 style={{margin:'0 0 14px',color:T.accent,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:20}}>{title}</h3><div style={{maxHeight:'60vh',overflowY:'auto'}}>{items.length===0&&<div style={{textAlign:'center',padding:24,color:T.muted}}>{empty}</div>}{items.map(h=><div key={h.id} style={{display:'flex',alignItems:'center',gap:8,padding:12,marginBottom:6,borderRadius:12,background:T.bg,cursor:'pointer'}} onClick={()=>{onSelect(h);onClose()}}><div style={{flex:1}}><div style={{fontWeight:600,color:T.accent,fontSize:14}}>{h.chinh?shortQ(h.chinh):''}{h.queHo?' → '+shortQ(h.queHo):''}{h.bien?' → '+shortQ(h.bien):''}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{h.method||''} • {h.question||h.name||'—'} • {h.ts||''}</div></div>{onRemove&&<button onClick={e=>{e.stopPropagation();onRemove(h.id)}} style={{background:'none',border:'none',color:T.muted,fontSize:16,padding:4}}>✕</button>}</div>)}</div><button onClick={onClose} style={{width:'100%',marginTop:12,padding:12,background:T.accent,color:'#fff',border:'none',borderRadius:10,fontWeight:600}}>Đóng</button></div></div>;

  // Icon button
  const IB=({icon,onClick,size=36})=><button onClick={onClick} style={{width:size,height:size,borderRadius:10,border:`1px solid ${T.border}`,background:T.card,display:'flex',alignItems:'center',justifyContent:'center',color:T.muted,boxShadow:T.shadow}}><Icon d={ICONS[icon]||icon} size={16} color={T.muted}/></button>;

  // ======== HOME ========
  if(view==='home'){
    const grid=[
      ['thoi','Thời',T.red],['khac','Khắc',T.amber],['giay','Giây',T.teal],
      ['ngaunhien','Ngẫu Nhiên',T.green],['nhap','Nhập Quẻ',T.purple],['dacbiet','Đặc Biệt',T.blue],
    ];
    return<div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'24px 20px'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:32}}>
        <div/><div style={{textAlign:'center'}}><div style={{fontSize:24,fontWeight:700,color:T.fg,fontFamily:"'Cormorant Garamond',Georgia,serif",letterSpacing:3}}>KINH DỊCH</div><div style={{fontSize:11,color:T.muted,marginTop:2,letterSpacing:1}}>Gieo Quẻ & Luận Giải</div></div>
        <IB icon="settings" onClick={()=>setShowSettings(true)}/>
      </div>

      {/* Question CTA */}
      <button onClick={()=>{setQName('');setQText('');setQResult(null);setView('question')}} style={{width:'100%',padding:'18px 20px',background:T.card,border:`1.5px solid ${T.accent}40`,borderRadius:16,marginBottom:24,display:'flex',alignItems:'center',gap:14,textAlign:'left',boxShadow:`0 4px 20px ${T.accent}15`}}>
        <YinYang size={44}/>
        <div><div style={{fontSize:16,fontWeight:600,color:T.accent,fontFamily:"'Cormorant Garamond',Georgia,serif"}}>Đặt câu hỏi gieo quẻ</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>Nhập sự việc → gieo → lưu → luận giải AI</div></div>
      </button>

      {/* Grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {grid.map(([icon,label,color])=>(
          <button key={icon} onClick={()=>icon==='nhap'?setView('nhap'):icon==='dacbiet'?(() =>{setSpecialNum('');setDacBietResult(null);setView('dacbiet')})():icon==='ngaunhien'?castNgauNhien():castMH(icon)}
            style={{padding:'22px 8px',background:T.card,border:'none',borderRadius:14,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:T.shadow}}>
            <MI type={icon} size={48}/>
            <div style={{fontSize:12,fontWeight:600,color}}>{label}</div>
          </button>
        ))}
      </div>

      {/* Lịch Việt */}
      <button onClick={()=>{const d=new Date();setCalYear(d.getFullYear());setCalMonth(d.getMonth()+1);setCalDay(null);setView('lichviet')}}
        style={{width:'100%',marginTop:16,padding:'14px 20px',background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:'flex',alignItems:'center',gap:14,textAlign:'left',boxShadow:T.shadow}}>
        <MI type="lichviet" size={40}/>
        <div><div style={{fontSize:14,fontWeight:600,color:T.fg}}>Lịch Việt</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>Âm lịch • 12 quẻ theo giờ mỗi ngày</div></div>
      </button>

      {/* Tra cứu */}
      <button onClick={()=>{setTcChinh('');setTcBien('');setTcResults(null);setView('tracuu')}}
        style={{width:'100%',marginTop:8,padding:'14px 20px',background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:'flex',alignItems:'center',gap:14,textAlign:'left',boxShadow:T.shadow}}>
        <MI type="tracuu" size={40}/>
        <div><div style={{fontSize:14,fontWeight:600,color:T.fg}}>Tra cứu ngày theo quẻ</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>Tìm ngày giờ ứng quẻ Chánh & Biến</div></div>
      </button>
    </div>{Sett()}{Pop()}</div>;
  }

  // ======== QUESTION ========
  if(view==='question'){const r=qResult;return<div style={wrapScroll} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'16px 20px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
      <button onClick={goHome} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.back} size={16} color={T.accent}/> Quay lại</button>
      <span style={{fontWeight:700,color:T.accent,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:18}}>Gieo Quẻ</span>
      <IB icon="list" onClick={()=>setShowSaved(true)} size={32}/>
    </div>
    <input type="text" value={qName} onChange={e=>setQName(e.target.value)} placeholder="Tên sự việc" style={{width:'100%',padding:14,border:`1px solid ${T.border}`,borderRadius:12,boxSizing:'border-box',fontSize:14,background:T.card,color:T.fg,marginBottom:10}}/>
    <textarea value={qText} onChange={e=>setQText(e.target.value)} rows={5} placeholder="Sự việc và câu hỏi..." style={{width:'100%',padding:14,border:`1px solid ${T.border}`,borderRadius:12,boxSizing:'border-box',fontSize:14,fontFamily:'inherit',resize:'none',background:T.card,color:T.fg,marginBottom:20}}/>
    {!r&&<div style={{textAlign:'center',padding:'16px 0'}}><div style={{fontSize:13,color:T.muted,marginBottom:16}}>{spinning?'Đang gieo quẻ...':'Tap để gieo quẻ'}</div><div onClick={spinning?undefined:castQuestion} style={{display:'inline-block',cursor:spinning?'default':'pointer',opacity:spinning?.7:1}}><YinYang size={150} spinning={spinning}/></div></div>}
    {r&&<div className="result-enter">
      <div style={{fontSize:11,color:T.muted,textAlign:'center',marginBottom:8}}>{r.ts}{r.lunar?` · ÂL ${r.lunar.day}/${r.lunar.month}/${r.lunar.year}`:''}</div>
      <div style={{display:'flex',justifyContent:'space-evenly',padding:'20px 10px',background:T.card,borderRadius:16,boxShadow:T.shadow,marginBottom:10}}><QB hex={r.chinh} lv={r.lineValues} hl={r.moving} label="Chánh" w={68}/>{r.queHo&&<QB hex={r.queHo} lv={hoLv(r.lineValues)} label="Hộ" w={68}/>}{r.bien&&<QB hex={r.bien} lv={bienLv(r.lineValues,r.moving)} label="Biến" w={68}/>}</div>
      <TheDung r={r}/>
      <div style={{display:'flex',gap:8,marginBottom:10}}>
        <button onClick={saveQ} style={{flex:1,padding:11,background:T.card,border:'none',borderRadius:10,fontWeight:600,color:T.accent,boxShadow:T.shadow,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><Icon d={ICONS.save} size={14} color={T.accent}/> Lưu</button>
        <button onClick={()=>shareResult(r)} style={{flex:1,padding:11,background:T.card,border:'none',borderRadius:10,fontWeight:600,color:T.teal,boxShadow:T.shadow,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><Icon d={ICONS.share} size={14} color={T.teal}/> Chia sẻ</button>
        <button onClick={()=>{setSpinning(false);setQResult(null)}} style={{flex:1,padding:11,background:T.card,border:'none',borderRadius:10,fontWeight:600,color:T.muted,boxShadow:T.shadow}}>Gieo lại</button>
      </div>
      <button onClick={()=>{setResult(r);setView('result')}} style={{width:'100%',padding:14,background:`linear-gradient(135deg, ${T.accent}, ${dark?'#a08050':'#6b5530'})`,color:'#fff',border:'none',borderRadius:12,fontWeight:600,fontSize:15,boxShadow:`0 4px 16px ${T.accent}30`}}>Luận Giải AI</button>
    </div>}
    <ListModal show={showSaved} items={saved} title="Quẻ Đã Lưu" onClose={()=>setShowSaved(false)} empty="Chưa lưu" onSelect={h=>{setQResult(h);setQName(h.name||'');setQText(h.question||'')}} onRemove={id=>{const u=saved.filter(s=>s.id!==id);setSaved(u);localStorage.setItem('kd_saved',JSON.stringify(u))}}/>
    {Pop()}
  </div></div>}

  // ======== NGẪU NHIÊN ========
  if(view==='ngaunhien'&&result?.chinh){const doPull=()=>{setPullY(0);setTimeout(castNgauNhien,50)};return<div style={{...wrap,transform:`translateX(${swipeX}px) translateY(${pullY}px)`,transition:(swipeX===0&&pullY===0)?'transform .25s ease-out':'none'}} onTouchStart={e=>{onTS(e);pullRef.current=e.touches[0].clientY}} onTouchMove={e=>{const dx=e.touches[0].clientX-swipeRef.current.x;const dy=e.touches[0].clientY-pullRef.current;if(Math.abs(dx)>Math.abs(dy)&&swipeRef.current.x<50&&dx>0)setSwipeX(Math.min(dx*.3,60));else if(dy>0&&Math.abs(dy)>Math.abs(dx))setPullY(Math.min(dy*.4,80))}} onTouchEnd={e=>{const dx=e.changedTouches[0].clientX-swipeRef.current.x;const dt=Date.now()-swipeRef.current.t;if(swipeX>30||(dx>80&&swipeRef.current.x<50&&dt<500)){setSwipeX(0);goHome()}else if(pullY>50){setSwipeX(0);doPull()}else{setSwipeX(0);setPullY(0)}}}>
    {pullY>10&&<div style={{textAlign:'center',padding:8,fontSize:12,color:T.accent,fontWeight:600}}>{pullY>50?'↓ Thả để gieo lại':'↓ Kéo xuống gieo lại'}</div>}
    <div style={{maxWidth:600,margin:'0 auto',padding:'16px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><button onClick={goHome} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.back} size={16} color={T.accent}/> Quay lại</button><span style={{fontSize:12,color:T.muted}}>{result.ts}</span><IB icon="share" onClick={()=>shareResult(result)} size={32}/></div>
      <div style={{display:'flex',justifyContent:'space-evenly',padding:'20px 10px',background:T.card,borderRadius:16,boxShadow:T.shadow,marginBottom:10}}><QB hex={result.chinh} lv={result.lineValues} hl={result.moving} label="Chánh" w={68}/>{result.queHo&&<QB hex={result.queHo} lv={hoLv(result.lineValues)} label="Hộ" w={68}/>}{result.bien&&<QB hex={result.bien} lv={bienLv(result.lineValues,result.moving)} label="Biến" w={68}/>}</div>
      <TheDung r={result}/>
      <div style={{textAlign:'center',color:T.muted,fontSize:12,padding:8}}>↓ Kéo xuống để gieo lại</div>
      <button onClick={castNgauNhien} style={{width:'100%',padding:12,background:T.card,border:'none',borderRadius:10,color:T.green,fontWeight:600,boxShadow:T.shadow}}>Gieo lại</button>
    </div>{Sett()}{Pop()}</div>}

  // ======== ĐẶC BIỆT ========
  if(view==='dacbiet'){const r=dacBietResult;return<div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'20px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}><button onClick={goHome} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.back} size={16} color={T.accent}/> Quay lại</button><span style={{fontWeight:700,color:T.blue,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:18}}>Đặc Biệt</span><div style={{width:40}}/></div>
    <p style={{fontSize:13,color:T.muted,textAlign:'center',marginBottom:16}}>Nhập dãy số ngẫu nhiên</p>
    <input type="text" inputMode="numeric" value={specialNum} onChange={e=>setSpecialNum(e.target.value)} placeholder="12345" style={{width:'100%',padding:18,border:`2px solid ${T.blue}40`,borderRadius:14,fontSize:26,textAlign:'center',background:T.card,color:T.fg,boxSizing:'border-box',marginBottom:14,fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:600}}/>
    <button onClick={castDacBiet} style={{width:'100%',padding:14,background:T.blue,color:'#fff',border:'none',borderRadius:12,fontWeight:600,fontSize:15,marginBottom:16}}>Xem Quẻ</button>
    {r&&<div className="result-enter" style={{background:T.card,borderRadius:16,boxShadow:T.shadow,padding:16,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-evenly',marginBottom:12}}><QB hex={r.chinh} lv={r.lineValues} hl={r.moving} label="Chánh" w={55}/>{r.queHo&&<QB hex={r.queHo} lv={hoLv(r.lineValues)} label="Hộ" w={55}/>}{r.bien&&<QB hex={r.bien} lv={bienLv(r.lineValues,r.moving)} label="Biến" w={55}/>}</div>
      <TheDung r={r}/>
      <button onClick={()=>{setSpecialNum('');setDacBietResult(null)}} style={{width:'100%',padding:10,background:T.bg,border:'none',borderRadius:8,color:T.blue,fontWeight:600}}>Gieo tiếp số khác</button>
    </div>}
  </div>{Pop()}</div>}

  // ======== NHẬP QUẺ ========
  if(view==='nhap'){return<div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'16px 20px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><button onClick={()=>{goHome();setManualMoving([])}} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.back} size={16} color={T.accent}/> Quay lại</button><span style={{fontWeight:700,color:T.purple,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:18}}>Nhập Quẻ</span><div style={{width:40}}/></div>
    <div style={{display:'flex',gap:10,marginBottom:14}}>{[['Thượng Quái',manualUpper,setManualUpper],['Hạ Quái',manualLower,setManualLower]].map(([label,val,fn])=><div key={label} style={{flex:1}}><div style={{fontSize:11,marginBottom:6,color:T.muted,textAlign:'center',fontWeight:600}}>{label}</div>{Object.entries(TRIGRAMS).map(([k,t])=><button key={k} onClick={()=>fn(k)} style={{width:'100%',padding:7,marginBottom:3,background:val===k?T.purple:T.card,color:val===k?'#fff':T.fg,border:'none',borderRadius:8,fontSize:12,fontWeight:val===k?600:400,boxShadow:val===k?'none':T.shadow}}>{t.symbol} {t.name}</button>)}</div>)}</div>
    <div style={{marginBottom:18}}><div style={{fontSize:11,marginBottom:6,color:T.muted,textAlign:'center',fontWeight:600}}>Hào Động</div><div style={{display:'flex',gap:4,justifyContent:'center'}}>{LINE_NAMES.map((n,i)=><button key={i} onClick={()=>setManualMoving(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])} style={{padding:'8px 12px',background:manualMoving.includes(i)?T.red:T.card,color:manualMoving.includes(i)?'#fff':T.fg,border:'none',borderRadius:8,fontSize:12,fontWeight:600,boxShadow:manualMoving.includes(i)?'none':T.shadow}}>{n}</button>)}</div></div>
    <button onClick={castNhap} style={{width:'100%',padding:14,background:T.purple,color:'#fff',border:'none',borderRadius:12,fontWeight:600,fontSize:15}}>Xem Quẻ</button>
  </div></div>}

  // ======== RESULT + AI ========
  if(view==='result'&&result?.chinh){const done=!luanLoading&&(luanResult||chatHistory.length>0);return<div style={wrapScroll} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:600,margin:'0 auto',padding:'16px 20px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
      <button onClick={goHome} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.back} size={16} color={T.accent}/> Quay lại</button>
      <span style={{fontSize:12,color:T.muted}}>{result.method} · {result.ts}</span>
      <div style={{display:'flex',gap:4}}><IB icon="share" onClick={()=>shareResult(result)} size={32}/><IB icon="settings" onClick={()=>setShowSettings(true)} size={32}/></div>
    </div>
    {result.lunar&&<div style={{fontSize:11,color:T.muted,textAlign:'center',marginBottom:6}}>ÂL {result.lunar.day}/{result.lunar.month}/{result.lunar.year}</div>}
    {(result.question||result.name)&&<div style={{padding:12,background:T.card,borderRadius:12,marginBottom:10,fontSize:13,boxShadow:T.shadow}}>{result.name&&<div style={{fontWeight:600,marginBottom:2}}>{result.name}</div>}{result.question&&<div style={{color:T.muted}}>{result.question}</div>}</div>}
    <div style={{display:'flex',justifyContent:'space-evenly',padding:'20px 10px',background:T.card,borderRadius:16,boxShadow:T.shadow,marginBottom:10}}><QB hex={result.chinh} lv={result.lineValues} hl={result.moving} label="Chánh" w={68}/>{result.queHo&&<QB hex={result.queHo} lv={hoLv(result.lineValues)} label="Hộ" w={68}/>}{result.bien&&<QB hex={result.bien} lv={bienLv(result.lineValues,result.moving)} label="Biến" w={68}/>}</div>
    <TheDung r={result}/>
    <details style={{marginBottom:10}}><summary style={{fontSize:12,color:T.muted,cursor:'pointer',padding:'6px 0'}}>▸ Chi tiết 6 hào</summary><div style={{padding:12,background:T.card,borderRadius:10,boxShadow:T.shadow,fontSize:12}}>{[...result.lines].reverse().map((l,ri)=>{const i=5-ri;const isM=result.moving.includes(i);return<div key={i} style={{padding:'4px 0',color:isM?T.red:T.fg}}>{LINE_NAMES[i]}: {l.value===9?'Lão Dương':l.value===6?'Lão Âm':l.value===7?'Thiếu Dương':'Thiếu Âm'}{isM?' (động)':''}</div>})}</div></details>
    <div style={{marginBottom:10}}><div style={{fontSize:12,color:T.muted,fontWeight:600,marginBottom:4}}>Phạm vi sự việc</div><textarea value={phamVi} onChange={e=>setPhamVi(e.target.value)} rows={2} placeholder="Bổ sung hoàn cảnh..." style={{width:'100%',padding:12,border:`1px solid ${T.border}`,borderRadius:10,boxSizing:'border-box',fontSize:13,fontFamily:'inherit',resize:'none',background:T.card,color:T.fg}}/></div>
    <button onClick={luanQue} disabled={luanLoading} style={{width:'100%',padding:14,background:`linear-gradient(135deg, ${T.accent}, ${dark?'#a08050':'#6b5530'})`,color:'#fff',border:'none',borderRadius:12,fontWeight:600,fontSize:15,marginBottom:10,opacity:luanLoading?.5:1,boxShadow:`0 4px 16px ${T.accent}30`}}>
      {luanLoading?'Đang luận giải...':'Luận Giải AI'}
    </button>
    {(luanResult||chatHistory.length>0)&&<div style={{borderRadius:14,padding:16,marginBottom:12,background:T.card,boxShadow:T.shadow}}>
      {chatHistory.length===0&&<div style={{fontSize:14,lineHeight:1.8,whiteSpace:'pre-wrap'}}>{luanResult}{luanLoading&&<span style={{color:T.accent}}>▊</span>}</div>}
      {chatHistory.length>0&&chatHistory.map((msg,i)=><div key={i} style={{marginBottom:10,padding:msg.role==='user'?'10px 14px':0,background:msg.role==='user'?T.bg:'transparent',borderRadius:10,borderLeft:msg.role==='assistant'?`3px solid ${T.accent}`:'none',paddingLeft:msg.role==='assistant'?14:14}}>{msg.role==='user'&&i>0&&<div style={{fontSize:11,color:T.muted,marginBottom:2}}>Hỏi thêm:</div>}<div style={{fontSize:14,lineHeight:1.8,whiteSpace:'pre-wrap'}}>{i===0?'':msg.content}{luanLoading&&i===chatHistory.length-1&&msg.role==='assistant'&&<span style={{color:T.accent}}>▊</span>}</div></div>)}
      {done&&<div style={{display:'flex',gap:6,marginTop:10,borderTop:`1px solid ${T.border}`,paddingTop:10}}><input type="text" value={followUp} onChange={e=>setFollowUp(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendFU()}} placeholder="Hỏi thêm..." style={{flex:1,padding:12,border:`1px solid ${T.border}`,borderRadius:10,fontSize:14,background:T.bg,color:T.fg}}/><button onClick={sendFU} disabled={!followUp.trim()||luanLoading} style={{padding:'12px 18px',background:T.accent,color:'#fff',border:'none',borderRadius:10,fontWeight:600,opacity:!followUp.trim()||luanLoading?.5:1}}>Gửi</button></div>}
    </div>}
    {Sett()}{Pop()}
  </div></div>}

  // ======== LỊCH VIỆT — Calendar ========

  // Get quẻ chánh for giờ Tý of a given solar date
  const dayQue=(d,m,y)=>{
    const lu=s2l(d,m,y);
    const chiY=((lu.year+8)%12)+1;
    const upper=chiY+lu.month+lu.day;
    const lower=upper+1; // Tý=1
    const uNum=upper%8===0?8:upper%8;
    const lNum=lower%8===0?8:lower%8;
    const uKey=MH_NUM[uNum],lKey=MH_NUM[lNum];
    const lv=[...lKey.split('').reverse().map(Number),...uKey.split('').reverse().map(Number)];
    return lv2hex(lv);
  };

  // Tra cứu: search year for matching quẻ
  const searchQue=()=>{
    if(!tcChinh||!tcBien){alert('Chọn cả quẻ Chánh và Biến');return}
    setTcLoading(true);setTcResults(null);
    setTimeout(()=>{
      const matches=[];
      const targetC=tcChinh.toUpperCase();
      const targetB=tcBien.toUpperCase();
      const daysInYear=[31,((tcYear%4===0&&tcYear%100!==0)||tcYear%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
      for(let m=1;m<=12;m++){
        for(let d=1;d<=daysInYear[m-1];d++){
          const lu=s2l(d,m,tcYear);
          const chiY=((lu.year+8)%12)+1;
          const sumU=chiY+lu.month+lu.day;
          for(let hi=0;hi<12;hi++){
            const hourChi=hi+1;
            const sumL=sumU+hourChi;
            const uRem=sumU%8;const uNum=uRem===0?8:uRem;
            const lRem=sumL%8;const lNum=lRem===0?8:lRem;
            const hRem=sumL%6;const haoIdx=hRem===0?5:(hRem-1);
            const uKey=MH_NUM[uNum],lKey=MH_NUM[lNum];
            const lv=[...lKey.split('').reverse().map(Number),...uKey.split('').reverse().map(Number)];
            const chinh=lv2hex(lv);
            if(!chinh)continue;
            const cShort=calQ(chinh);
            if(cShort.toUpperCase()!==targetC)continue;
            const bien=lv2bien(lv,[haoIdx]);
            if(!bien)continue;
            const bShort=calQ(bien);
            if(bShort.toUpperCase()!==targetB)continue;
            const queHo=lv2ho(lv);
            matches.push({d,m,hi,chinh,bien,queHo,luDay:lu.day,luMonth:lu.month});
            if(matches.length>=200)break;
          }
          if(matches.length>=200)break;
        }
        if(matches.length>=200)break;
      }
      setTcResults(matches);setTcLoading(false);
    },50);
  };

  if(view==='lichviet'){
    const daysInMonth=new Date(calYear,calMonth,0).getDate();
    const firstDow=new Date(calYear,calMonth-1,1).getDay();
    const today=new Date();const isToday=(d)=>d===today.getDate()&&calMonth===today.getMonth()+1&&calYear===today.getFullYear();
    const prevM=()=>{if(calMonth===1){setCalMonth(12);setCalYear(calYear-1)}else setCalMonth(calMonth-1)};
    const nextM=()=>{if(calMonth===12){setCalMonth(1);setCalYear(calYear+1)}else setCalMonth(calMonth+1)};
    const dowLabels=['CN','T2','T3','T4','T5','T6','T7'];
    const cells=[];for(let i=0;i<firstDow;i++)cells.push(null);for(let d=1;d<=daysInMonth;d++)cells.push(d);

    return<div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'16px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button onClick={goHome} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600}}>← Quay lại</button>
        <span style={{fontWeight:700,color:T.fg,fontSize:16}}>Lịch Việt</span>
        <div style={{width:60}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <button onClick={prevM} style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.card,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
        <button onClick={()=>setShowMonthPicker(true)} style={{background:'none',border:'none',cursor:'pointer'}}>
          <span style={{fontSize:17,fontWeight:700,color:T.fg}}>Tháng {calMonth}, {calYear} </span>
          <span style={{fontSize:12,color:T.accent}}>▾</span>
        </button>
        <button onClick={nextM} style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.card,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:2}}>
        {dowLabels.map((d,i)=><div key={d} style={{textAlign:'center',fontSize:11,fontWeight:600,color:i===0?T.calRed:i===6?'#1976d2':T.muted,padding:'2px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
        {cells.map((d,i)=>{
          if(!d)return<div key={i}/>;
          const lu=s2l(d,calMonth,calYear);
          const dow=new Date(calYear,calMonth-1,d).getDay();
          const isNew=lu.day===1;const isFull=lu.day===15;
          const dq=dayQue(d,calMonth,calYear);
          const luColor=(isNew||isFull)?T.calRed:T.muted;
          const luText=isNew?`${lu.day}/${lu.month}`:lu.day;
          const cellBg=isToday(d)?T.accentSoft:dark?'#1e1e24':'#ede8df';
          return<button key={i} onClick={()=>{setCalDay(d);setCalFrom('lichviet');setView('lichday')}}
            style={{padding:'4px 2px',background:cellBg,borderRadius:6,textAlign:'center',cursor:'pointer',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',border:isToday(d)?`2px solid ${T.accent}`:'none',aspectRatio:'1/1.1'}}>
            <div style={{fontSize:17,fontWeight:isToday(d)?700:600,color:dow===0?T.calRed:dow===6?'#1976d2':T.fg,lineHeight:1.2}}>{d}</div>
            {dq&&<div style={{fontSize:9,color:T.accent,lineHeight:1.2,fontWeight:500}}>{calQ(dq)}</div>}
            <div style={{fontSize:10,color:luColor,fontWeight:(isNew||isFull)?700:400,lineHeight:1.2}}>{luText}</div>
          </button>
        })}
      </div>
      {showMonthPicker&&<div onClick={()=>setShowMonthPicker(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
        <div onClick={e=>e.stopPropagation()} style={{background:dark?'#1c1c20':'#fff',borderRadius:16,padding:20,maxWidth:340,width:'100%'}}>
          <div style={{textAlign:'center',marginBottom:16,fontWeight:700,color:T.fg,fontSize:16}}>Chọn tháng & năm</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:16}}>
            <input type="number" value={calYear} onChange={e=>setCalYear(parseInt(e.target.value)||2026)}
              style={{width:80,padding:'8px 4px',textAlign:'center',fontSize:18,fontWeight:700,border:`1px solid ${T.border}`,borderRadius:8,background:T.card,color:T.fg}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
            {Array.from({length:12},(_,i)=>i+1).map(m=>(
              <button key={m} onClick={()=>{setCalMonth(m);setShowMonthPicker(false)}}
                style={{padding:'10px 0',borderRadius:8,border:m===calMonth?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:m===calMonth?T.accentBg:T.card,color:m===calMonth?T.accent:T.fg,fontWeight:m===calMonth?700:400,fontSize:14,cursor:'pointer'}}>
                T{m}
              </button>
            ))}
          </div>
          <button onClick={()=>{const d=new Date();setCalYear(d.getFullYear());setCalMonth(d.getMonth()+1);setShowMonthPicker(false)}}
            style={{width:'100%',marginTop:12,padding:10,background:T.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:600}}>Hôm nay</button>
        </div>
      </div>}
    </div></div>;
  }

  // ======== LỊCH VIỆT — Day Detail: 12 quẻ theo giờ ========
  if(view==='lichday'&&calDay){
    const lu=s2l(calDay,calMonth,calYear);
    const chiYear=((lu.year+8)%12)+1;
    const sumUpper=chiYear+lu.month+lu.day;
    const hourQues=CHI_NAMES.map((_,hi)=>{
      const hourChi=hi+1;const sumLower=sumUpper+hourChi;
      const uRem=sumUpper%8;const uNum=uRem===0?8:uRem;
      const lRem=sumLower%8;const lNum=lRem===0?8:lRem;
      const hRem=sumLower%6;const haoIdx=hRem===0?5:(hRem-1);
      const uKey=MH_NUM[uNum],lKey=MH_NUM[lNum];
      const lv=[...lKey.split('').reverse().map(Number),...uKey.split('').reverse().map(Number)];
      const moving=[haoIdx];
      const lines=lv.map((v,i)=>({value:moving.includes(i)?(v===1?9:6):(v===1?7:8)}));
      return{chinh:lv2hex(lv),bien:lv2bien(lv,moving),queHo:lv2ho(lv),lines,lineValues:lv,moving};
    });

    return<div style={wrapScroll} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'12px 16px'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <button onClick={()=>setView(calFrom)} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600}}>← Quay lại</button>
        <div style={{textAlign:'center'}}>
          <span style={{fontSize:15,fontWeight:700,color:T.fg}}>{calDay}/{calMonth}/{calYear}</span>
          <span style={{fontSize:12,color:T.muted,marginLeft:8}}>ÂL {lu.day}/{lu.month}</span>
        </div>
        <div style={{width:40}}/>
      </div>

      {/* Column headers */}
      <div style={{display:'grid',gridTemplateColumns:'54px 1fr 1fr 1fr 24px',gap:2,marginBottom:2,padding:'0 4px'}}>
        <div style={{fontSize:10,fontWeight:600,color:T.muted,textAlign:'center'}}>Giờ</div>
        <div style={{fontSize:10,fontWeight:600,color:T.accent,textAlign:'center'}}>Chánh</div>
        <div style={{fontSize:10,fontWeight:600,color:T.muted,textAlign:'center'}}>Hộ</div>
        <div style={{fontSize:10,fontWeight:600,color:T.muted,textAlign:'center'}}>Biến</div>
        <div/>
      </div>

      {/* 12 hours */}
      <div>
        {hourQues.map((q,hi)=>{
          if(!q.chinh)return null;
          return<div key={hi}
            style={{width:'100%',display:'grid',gridTemplateColumns:'54px 1fr 1fr 1fr 24px',gap:2,alignItems:'center',background:T.card,border:`1px solid ${T.border}`,borderRadius:6,textAlign:'center',padding:'8px 4px',marginBottom:2}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{CHI_NAMES[hi]}</div>
              <div style={{fontSize:11,color:T.fg}}>{CHI_HOURS[hi]}h</div>
            </div>
            <div onClick={()=>q.chinh&&setPopup(q.chinh)} style={{cursor:'pointer',fontSize:13,fontWeight:600,color:T.fg}}>{calQ(q.chinh)}</div>
            <div onClick={()=>q.queHo&&setPopup(q.queHo)} style={{cursor:'pointer',fontSize:13,fontWeight:600,color:T.fg}}>{q.queHo?calQ(q.queHo):''}</div>
            <div onClick={()=>q.bien&&setPopup(q.bien)} style={{cursor:'pointer',fontSize:13,fontWeight:600,color:T.fg}}>{q.bien?calQ(q.bien):''}</div>
            <div onClick={()=>{setCalHour(hi);setView('lichhour')}} style={{cursor:'pointer',fontSize:11,color:T.accent,fontWeight:600}}>▸</div>
          </div>
        })}
      </div>
    </div>{Pop()}</div>;
  }

  // ======== TRA CỨU NGÀY THEO QUẺ ========
  if(view==='tracuu'){
    const queList=HEXAGRAMS.map(h=>{const p=h[1].split(' ');return{full:h[1],short:p.length>2?p.slice(2).join(' '):h[1]}}).sort((a,b)=>a.short.localeCompare(b.short));

    return<div style={wrapScroll} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'16px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <button onClick={goHome} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600}}>← Quay lại</button>
        <span style={{fontWeight:700,color:T.fg,fontSize:16}}>Tra Cứu Ngày Theo Quẻ</span>
        <div style={{width:50}}/>
      </div>

      <div style={{background:T.card,borderRadius:14,padding:16,border:`1px solid ${T.border}`,marginBottom:16,boxShadow:T.shadow}}>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,fontWeight:600,color:T.accent,display:'block',marginBottom:4}}>Quẻ Chánh *</label>
          <select value={tcChinh} onChange={e=>setTcChinh(e.target.value)}
            style={{width:'100%',padding:10,border:`1px solid ${T.border}`,borderRadius:8,fontSize:14,background:T.bg,color:T.fg}}>
            <option value="">— Chọn quẻ —</option>
            {queList.map(q=><option key={'c'+q.full} value={q.short}>{q.short} ({q.full})</option>)}
          </select>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,fontWeight:600,color:T.accent,display:'block',marginBottom:4}}>Quẻ Biến *</label>
          <select value={tcBien} onChange={e=>setTcBien(e.target.value)}
            style={{width:'100%',padding:10,border:`1px solid ${T.border}`,borderRadius:8,fontSize:14,background:T.bg,color:T.fg}}>
            <option value="">— Chọn quẻ —</option>
            {queList.map(q=><option key={'b'+q.full} value={q.short}>{q.short} ({q.full})</option>)}
          </select>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',marginBottom:12}}>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:T.muted,display:'block',marginBottom:4}}>Năm</label>
            <input type="number" value={tcYear} onChange={e=>setTcYear(parseInt(e.target.value)||2026)}
              style={{width:90,padding:10,border:`1px solid ${T.border}`,borderRadius:8,fontSize:16,fontWeight:700,textAlign:'center',background:T.bg,color:T.fg}}/>
          </div>
          <button onClick={searchQue} disabled={tcLoading}
            style={{flex:1,padding:12,background:T.accent,color:'#fff',border:'none',borderRadius:10,fontWeight:700,fontSize:15,opacity:tcLoading?.5:1}}>
            {tcLoading?'Đang tìm...':'🔍 Tìm Kiếm'}
          </button>
        </div>
      </div>

      {tcResults&&<div>
        <div style={{fontSize:12,color:T.muted,marginBottom:6}}>
          {tcResults.length===0?'Không tìm thấy trong năm '+tcYear:`${tcResults.length} kết quả`}
        </div>
        {tcResults.map((r,i)=>{
          const dow=['CN','T2','T3','T4','T5','T6','T7'][new Date(tcYear,r.m-1,r.d).getDay()];
          return<div key={i} onClick={()=>{setCalYear(tcYear);setCalMonth(r.m);setCalDay(r.d);setCalFrom('tracuu');setView('lichday')}}
            style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',marginBottom:3,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,cursor:'pointer'}}>
            <div style={{minWidth:70}}>
              <div style={{fontSize:13,fontWeight:600,color:T.fg}}>{dow} {r.d}/{r.m}</div>
              <div style={{fontSize:9,color:T.muted}}>ÂL {r.luDay}/{r.luMonth}</div>
            </div>
            <div style={{fontSize:11,fontWeight:600,color:T.accent,minWidth:28}}>{CHI_NAMES[r.hi]}</div>
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4,fontSize:11,fontWeight:500}}>
              <span style={{color:T.accent}}>{calQ(r.chinh)}</span>
              {r.queHo&&<><span style={{color:T.muted}}>›</span><span style={{color:T.fg}}>{calQ(r.queHo)}</span></>}
              <span style={{color:T.muted}}>›</span>
              <span style={{color:T.green}}>{calQ(r.bien)}</span>
            </div>
          </div>
        })}
      </div>}
    </div></div>;
  }

  // ======== LỊCH VIỆT — Hour Detail: 12 khung 10 phút ========
  if(view==='lichhour'&&calDay&&calHour!==null){
    const lu=s2l(calDay,calMonth,calYear);
    const chiYear=((lu.year+8)%12)+1;
    const hourChi=calHour+1;
    const sumUpper=chiYear+lu.month+lu.day+hourChi;
    // Start time for this Chi hour
    const startH=calHour===0?23:calHour*2-1;
    const minQues=Array.from({length:12},(_,mi)=>{
      const sumLower=sumUpper+(mi+1);
      const uRem=sumUpper%8;const uNum=uRem===0?8:uRem;
      const lRem=sumLower%8;const lNum=lRem===0?8:lRem;
      const hRem=sumLower%6;const haoIdx=hRem===0?5:(hRem-1);
      const uKey=MH_NUM[uNum],lKey=MH_NUM[lNum];
      const lv=[...lKey.split('').reverse().map(Number),...uKey.split('').reverse().map(Number)];
      return{chinh:lv2hex(lv),queHo:lv2ho(lv),bien:lv2bien(lv,[haoIdx])};
    });
    // Time labels: 12 intervals of 10 min
    const timeLabels=Array.from({length:12},(_,mi)=>{
      const totalMin=mi*10;
      const h=(startH+Math.floor(totalMin/60))%24;
      const m=totalMin%60;
      const h2=(startH+Math.floor((totalMin+10)/60))%24;
      const m2=(totalMin+10)%60;
      return `${h}h${m.toString().padStart(2,'0')} - ${h2}h${m2.toString().padStart(2,'0')}`;
    });

    return<div style={wrapScroll} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}><div style={{maxWidth:480,margin:'0 auto',padding:'12px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <button onClick={()=>setView('lichday')} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600}}>← Quay lại</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:700,color:T.fg}}>{calDay}/{calMonth}/{calYear}</div>
          <div style={{fontSize:13,fontWeight:600,color:T.accent}}>Giờ {CHI_NAMES[calHour]} ({CHI_HOURS[calHour]}h)</div>
        </div>
        <div style={{width:50}}/>
      </div>

      {minQues.map((q,mi)=>{
        if(!q.chinh)return null;
        return<div key={mi} style={{borderBottom:`1px solid ${T.border}`,padding:'10px 0'}}>
          <div style={{fontSize:12,color:T.muted,marginBottom:4}}>{timeLabels[mi]}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 8px'}}>
            <div onClick={()=>setPopup(q.chinh)} style={{cursor:'pointer',fontSize:15,fontWeight:600,color:T.fg,flex:1,textAlign:'left'}}>{calQ(q.chinh)}</div>
            <span style={{color:T.muted,margin:'0 8px'}}>—</span>
            <div onClick={()=>q.queHo&&setPopup(q.queHo)} style={{cursor:'pointer',fontSize:15,fontWeight:600,color:T.fg,flex:1,textAlign:'center'}}>{q.queHo?calQ(q.queHo):''}</div>
            <span style={{color:T.muted,margin:'0 8px'}}>—</span>
            <div onClick={()=>q.bien&&setPopup(q.bien)} style={{cursor:'pointer',fontSize:15,fontWeight:600,color:T.fg,flex:1,textAlign:'right'}}>{q.bien?calQ(q.bien):''}</div>
          </div>
        </div>
      })}
    </div>{Pop()}</div>;
  }

  return<div style={wrap}><div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100dvh'}}><button onClick={goHome} style={{padding:'14px 28px',background:T.accent,color:'#fff',border:'none',borderRadius:12,fontWeight:600}}>← Quay lại</button></div></div>;
}
