import { useState, useRef, useCallback, useEffect } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const LINE_NAMES = ['Sơ','Nhị','Tam','Tứ','Ngũ','Thượng'];
const MH_NUM = {1:'111',2:'011',3:'101',4:'001',5:'110',6:'010',7:'100',8:'000'};
const VIET = {'111':'Thiên','000':'Địa','001':'Lôi','110':'Phong','010':'Thủy','101':'Hỏa','100':'Sơn','011':'Trạch'};

// ======== CORE: lineValues is ALWAYS bottom-to-top [hào1..hào6] ========
// Trigram keys in HEXAGRAM_LOOKUP are TOP-to-BOTTOM strings

function lv2hex(lv) {
  const lower = [lv[2],lv[1],lv[0]].join('');
  const upper = [lv[5],lv[4],lv[3]].join('');
  const idx = HEXAGRAM_LOOKUP[upper + lower];
  return idx !== undefined ? HEXAGRAMS[idx] : null;
}

function lv2ho(lv) {
  // Hạ quái Hộ: hào 2,3,4 (index 1,2,3) → key top-to-bottom = [3,2,1]
  const ha = [lv[3],lv[2],lv[1]].join('');
  // Thượng quái Hộ: hào 3,4,5 (index 2,3,4) → key top-to-bottom = [4,3,2]
  const thuong = [lv[4],lv[3],lv[2]].join('');
  const idx = HEXAGRAM_LOOKUP[thuong + ha];
  return idx !== undefined ? HEXAGRAMS[idx] : null;
}

function lv2bien(lv, moving) {
  const nv = lv.map((v,i) => moving.includes(i) ? (1-v) : v);
  return lv2hex(nv);
}

function bienLv(lv, moving) {
  return lv.map((v,i) => moving.includes(i) ? (1-v) : v);
}

function hoLv(lv) {
  return [lv[1],lv[2],lv[3], lv[2],lv[3],lv[4]];
}

// ======== Lunar (compact Hồ Ngọc Đức) ========
function jdn(d,m,y){let a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;let jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;if(jd<2299161)jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;return jd}
function nmJD(k){let T=k/1236.85,T2=T*T,r=Math.PI/180;let J=2415020.75933+29.53058868*k+.0001178*T2+.00033*Math.sin((166.56+132.87*T)*r);let M=359.2242+29.10535608*k,Mp=306.0253+385.81691806*k+.0107306*T2,F=21.2964+390.67050646*k-.0016528*T2;let C=(.1734-.000393*T)*Math.sin(M*r)+.0021*Math.sin(2*r*M)-.4068*Math.sin(Mp*r)+.0161*Math.sin(2*r*Mp)+.0104*Math.sin(2*r*F)-.0051*Math.sin(r*(M+Mp))-.0074*Math.sin(r*(M-Mp))+.0004*Math.sin(r*(2*F+M))-.0004*Math.sin(r*(2*F-M))-.0006*Math.sin(r*(2*F+Mp))+.001*Math.sin(r*(2*F-Mp))+.0005*Math.sin(r*(2*Mp+M));let dt=T<-11?.001+.000839*T+.0002261*T2:-.000278+.000265*T+.000262*T2;return J+C-dt}
function sL(jd){let T=(jd-2451545)/36525,r=Math.PI/180,M=357.5291+35999.0503*T,L=(280.46645+36000.76983*T+(1.9146-.004817*T)*Math.sin(r*M)+.019993*Math.sin(2*r*M)+.00029*Math.sin(3*r*M))*r;L-=Math.PI*2*Math.floor(L/(Math.PI*2));return Math.floor(L/Math.PI*6)}
function gLM11(y){let o=jdn(31,12,y)-2415021,k=Math.floor(o/29.530588853),n=nmJD(k);if(sL(n+.29)>=9)n=nmJD(k-1);return Math.floor(n+.5)}
function gLMO(a){let k=Math.floor((a-2415021.076998695)/29.530588853+.5),l=0,i=1,cc=sL(nmJD(k+i)+.29);do{l=cc;i++;cc=sL(nmJD(k+i)+.29)}while(cc!==l&&i<14);return i-1}
function s2l(d,m,y){let n=jdn(d,m,y),k=Math.floor((n-2415021.076998695)/29.530588853),s=Math.floor(nmJD(k)+.5);if(s>n)s=Math.floor(nmJD(k-1)+.5);let a=gLM11(y),b=a,ly;if(a>=s){ly=y;a=gLM11(y-1)}else{ly=y+1;b=gLM11(y+1)}let ld=n-s+1,df=Math.floor((s-a)/29),ll=0,lm=df+11;if(b-a>365){let lo=gLMO(a);if(df>=lo){lm=df+10;if(df===lo)ll=1}}if(lm>12)lm-=12;if(lm>=11&&df<4)ly-=1;return{day:ld,month:lm,year:ly}}
function hIdx(h){return h>=23||h<1?0:Math.floor((h-1)/2)+1}

// ======== Mai Hoa calc (lv = bottom-to-top) ========
function mhCalc(upperSum, lowerSum, totalSum) {
  const uNum = ((upperSum-1)%8)+1;
  const lNum = ((lowerSum-1)%8)+1;
  const mvIdx = ((totalSum-1)%6); // 0=hào1, 5=hào6
  const uKey = MH_NUM[uNum]; // top-to-bottom string
  const lKey = MH_NUM[lNum];
  // Reverse to get bottom-to-top for lv
  const lv = [...lKey.split('').reverse().map(Number), ...uKey.split('').reverse().map(Number)];
  const moving = [mvIdx];
  const lines = lv.map((v,i) => ({value: moving.includes(i) ? (v===1?9:6) : (v===1?7:8)}));
  return { chinh: lv2hex(lv), bien: lv2bien(lv,moving), queHo: lv2ho(lv), lines, lineValues: lv, moving };
}

function nowTS(){const d=new Date();return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`}
function shortQ(hex){if(!hex)return'';const p=hex[1].split(' ');return p.length>2?p.slice(2).join(' '):hex[1]}

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

  const toggleDark=()=>{const n=!dark;setDark(n);localStorage.setItem('kd_dark',n?'1':'0')};

  // Knowledge base from cloud
  const[kbBooks,setKbBooks]=useState([]);
  const[kbNotes,setKbNotes]=useState([]);
  useEffect(()=>{
    fetch('/api/knowledge').then(r=>r.json()).then(d=>{
      if(d.ok){setKbBooks(d.books||[]);setKbNotes(d.notes||[])}
    }).catch(()=>{});
  },[]);

  // Find relevant KB chunks for a quẻ
  const findKB=(queName)=>{
    if(!queName)return'';
    const kw=queName.toLowerCase().split(' ').filter(w=>w.length>1);
    const all=[...kbBooks,...kbNotes];
    const scored=all.map(c=>{
      const t=((c.name||'')+' '+(c.text||'')).toLowerCase();
      let score=0;
      kw.forEach(k=>{if(t.includes(k))score+=1});
      // Exact name match = high score
      if((c.name||'').toLowerCase().includes(queName.toLowerCase()))score+=10;
      return{c,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
    // Always include all user notes
    const notes=kbNotes.map(n=>`[ghi chú/${n.author||'user'}/${n.name||''}]\n${n.text}`).join('\n---\n');
    const books=scored.filter(x=>x.c.source!=='user').map(({c})=>`[${c.source||'sách'}/${c.name||''}]\n${c.text}`).join('\n---\n');
    return [notes,books].filter(Boolean).join('\n---\n');
  };
  const goHome=()=>{setView('home');setResult(null);setLuanResult('');setChatHistory([]);setDacBietResult(null)};

  // Swipe (smooth with visual feedback)
  const swipeRef=useRef({x:0,t:0});
  const[swipeX,setSwipeX]=useState(0);
  const onTS=useCallback(e=>{swipeRef.current={x:e.touches[0].clientX,t:Date.now()};setSwipeX(0)},[]);
  const onTM=useCallback(e=>{
    const dx=e.touches[0].clientX-swipeRef.current.x;
    if(swipeRef.current.x<50&&dx>0) setSwipeX(Math.min(dx*.3,60));
  },[]);
  const onTE=useCallback(e=>{
    const dx=e.changedTouches[0].clientX-swipeRef.current.x;
    const dt=Date.now()-swipeRef.current.t;
    const velocity=dx/Math.max(dt,1);
    setSwipeX(0);
    if((dx>80||velocity>0.4)&&swipeRef.current.x<50&&dt<500) goHome();
  },[]);

  // Pull-down for ngẫu nhiên
  const[pullY,setPullY]=useState(0);
  const pullRef=useRef(0);

  const P={
    bg:dark?'#111113':'#f7f6f3',fg:dark?'#d4d0c8':'#1c1917',card:dark?'#1c1c20':'#ffffff',
    muted:dark?'#6b6860':'#a8a29e',border:dark?'#2a2a2e':'#e7e5e4',
    accent:dark?'#d4a574':'#92400e',accentBg:dark?'#2a1f14':'#fef3c7',
    red:'#b91c1c',green:'#15803d',purple:'#7c3aed',blue:'#1d4ed8',amber:'#b45309',teal:'#0f766e',
  };

  // ======== CAST ========
  const addHist=(r)=>{setHistory(prev=>{const u=[r,...prev].slice(0,50);localStorage.setItem('kd_history',JSON.stringify(u));return u})};

  const buildResult=(r,method,question='',name='')=>{
    const lu=s2l(new Date().getDate(),new Date().getMonth()+1,new Date().getFullYear());
    return{id:Date.now(),...r,method,question,name,lunar:lu,ts:nowTS()};
  };

  const castMH=(method)=>{
    const now=new Date(),lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear()),hi=hIdx(now.getHours())+1;
    let us,ls;
    if(method==='thoi'){us=lu.year+lu.month+lu.day;ls=us+hi}
    else if(method==='khac'){us=lu.year+lu.month+lu.day+hi;ls=us+(now.getMinutes()+1)}
    else if(method==='giay'){const sec=now.getSeconds()+1;us=lu.year+lu.month+lu.day+hi;ls=us+sec}
    const r=buildResult(mhCalc(us,ls,ls),method==='thoi'?'Thời':method==='khac'?'Khắc':'Giây');
    setResult(r);addHist(r);setLuanResult('');setChatHistory([]);setPhamVi('');setView('result');
  };

  const castNgauNhien=()=>{
    // Ngẫu Nhiên dùng Mai Hoa: timestamp làm seed
    // Thượng quái = seed / 8, Hạ quái = seed2 / 8, Hào động = tổng / 6
    const now=Date.now();
    const s1=now%100000;           // 5 digits from ms
    const s2=Math.floor(now/7)%100000;  // shifted digits
    const upper=s1;
    const lower=s2;
    const total=upper+lower;
    const r=buildResult(mhCalc(upper||1,lower||1,total||1),'Ngẫu Nhiên');
    setResult(r);addHist(r);setLuanResult('');setChatHistory([]);setPhamVi('');setView('ngaunhien');
  };

  const castDacBiet=()=>{
    const nums=specialNum.replace(/\D/g,'');if(!nums){alert('Nhập số');return}
    const total=nums.split('').reduce((a,b)=>a+parseInt(b),0);
    const mid=Math.floor(nums.length/2)||1;
    const u=nums.slice(0,mid).split('').reduce((a,b)=>a+parseInt(b),0)||1;
    const l=nums.slice(mid).split('').reduce((a,b)=>a+parseInt(b),0)||1;
    const r=buildResult(mhCalc(u,l,total||1),'Đặc Biệt');
    setResult(r);addHist(r);setDacBietResult(r);setLuanResult('');setChatHistory([]);setPhamVi('');
  };

  const castNhap=()=>{
    // Manual: keys are top-to-bottom, reverse for lv
    const lo=manualLower.split('').reverse().map(Number);
    const up=manualUpper.split('').reverse().map(Number);
    const lv=[...lo,...up];
    const moving=[...manualMoving];
    const lines=lv.map((v,i)=>({value:moving.includes(i)?(v===1?9:6):(v===1?7:8)}));
    const r=buildResult({chinh:lv2hex(lv),bien:moving.length>0?lv2bien(lv,moving):null,queHo:lv2ho(lv),lines,lineValues:lv,moving},'Nhập Quẻ');
    setResult(r);addHist(r);setLuanResult('');setChatHistory([]);setPhamVi('');setView('result');
  };

  const castQuestion=()=>{
    const now=new Date(),lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear()),hi=hIdx(now.getHours())+1;
    const sec=now.getSeconds()+1,ms=now.getMilliseconds()+1;
    const us=lu.year+lu.month+lu.day+hi;
    const ls=us+sec;
    const r=buildResult(mhCalc(us,ls,ls+ms),'Gieo Quẻ',qText,qName);
    setQResult(r);addHist(r);
  };

  const saveQ=()=>{if(!qResult)return;setSaved(prev=>{const u=[{...qResult,savedAt:new Date().toLocaleString('vi-VN')},...prev];localStorage.setItem('kd_saved',JSON.stringify(u));return u});alert('✓ Đã lưu')};

  // ======== AI ========
  const buildPrompt=()=>{if(!result?.chinh)return'';const ch=result.chinh,uT=TRIGRAMS[ch[3]],lT=TRIGRAMS[ch[4]];let p=`# Gieo Quẻ Kinh Dịch\n`;if(result.question)p+=`**Câu hỏi:** ${result.question}\n`;if(result.name)p+=`**Sự việc:** ${result.name}\n`;if(phamVi)p+=`**Phạm vi:** ${phamVi}\n`;p+=`**${result.method}** • ${result.ts}`;if(result.lunar)p+=` • ÂL ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}`;p+=`\n\n## Quẻ Chánh: ${ch[1]}\n- Thượng: ${uT.name} (${uT.nature}, ${uT.element})\n- Hạ: ${lT.name} (${lT.nature}, ${lT.element})\n- Nghĩa: ${ch[5]}\n`;if(result.moving?.length>0){const mv0=result.moving[0],isUp=mv0>=3;p+=`- **Thể**: ${isUp?lT.name:uT.name} (${isUp?lT.element:uT.element})\n- **Dụng**: ${isUp?uT.name:lT.name} (${isUp?uT.element:lT.element})\n`}p+=`\n## 6 Hào:\n`;result.lines.forEach((l,i)=>{const isM=result.moving.includes(i);p+=`- ${LINE_NAMES[i]}: ${l.value===9?'Lão Dương':l.value===6?'Lão Âm':l.value===7?'Thiếu Dương':'Thiếu Âm'}${isM?' ★ĐỘNG':''}\n`});if(result.queHo)p+=`\n## Quẻ Hộ: ${result.queHo[1]} — ${result.queHo[5]}\n`;if(result.bien)p+=`\n## Quẻ Biến: ${result.bien[1]} — ${result.bien[5]}\n`;
  // KB references
  const refs=[findKB(ch[1]),result.queHo?findKB(result.queHo[1]):'',result.bien?findKB(result.bien[1]):''].filter(Boolean).join('\n---\n');
  if(refs)p+=`\n[REFERENCE]\n${refs}\n[/REFERENCE]\n`;
  p+=`\n---\nLuận giải${result.question?' cho câu hỏi':''}. Phân tích Thể/Dụng sinh khắc, Quẻ Hộ (nội tình), Quẻ Biến (kết quả). Lời khuyên cụ thể.`;return p};
  const callAI=async(msgs,onS)=>{const res=await fetch('/api/luan-giai',{method:'POST',headers:{'Content-Type':'application/json','x-kb-secret':kbSecret,'x-user':userName||'anon'},body:JSON.stringify({model:aiModel,max_tokens:4096,system:SYSTEM_PROMPT,messages:msgs})});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'API error')}const reader=res.body.getReader(),dec=new TextDecoder();let full='',buf='';while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop()||'';for(const l of ls){if(!l.startsWith('data: '))continue;try{const o=JSON.parse(l.slice(6));if(o.type==='content_block_delta'&&o.delta?.text){full+=o.delta.text;onS?.(full)}}catch{}}}return full};
  const luanQue=async()=>{if(!kbSecret){setShowSettings(true);return}setLuanResult('');setLuanLoading(true);setChatHistory([]);try{const p=buildPrompt();const t=await callAI([{role:'user',content:p}],setLuanResult);setChatHistory([{role:'user',content:p},{role:'assistant',content:t}])}catch(e){setLuanResult('❌ '+e.message)}finally{setLuanLoading(false)}};
  const sendFU=async()=>{if(!followUp.trim()||luanLoading)return;const m={role:'user',content:followUp},h=[...chatHistory,m];setChatHistory(h);setFollowUp('');setLuanLoading(true);try{const t=await callAI(h,p=>setChatHistory([...h,{role:'assistant',content:p}]));setChatHistory([...h,{role:'assistant',content:t}])}catch(e){setChatHistory([...h,{role:'assistant',content:'❌ '+e.message}])}finally{setLuanLoading(false)}};

  // ======== RENDER ========
  const RHex=({lv,highlight=[],w=90})=>{
    const h=Math.max(7,w/11);const gap=Math.max(7,w/8);const half=(w-w*.1)/2;
    return <div style={{display:'flex',flexDirection:'column-reverse',alignItems:'center',gap}}>
      {lv.map((v,i)=>{
        const hl=highlight.includes(i);
        const cl=hl?P.red:P.fg;
        return <div key={i} style={{width:w,display:'flex',justifyContent:v===1?'center':'space-between'}}>
          {v===1?<div style={{width:w,height:h,background:cl,borderRadius:2}}/>
            :<><div style={{width:half,height:h,background:cl,borderRadius:2}}/><div style={{width:half,height:h,background:cl,borderRadius:2}}/></>}
        </div>
      })}
    </div>;
  };

  // Quẻ block: Thượng / Hạ / Tên
  const QB=({hex,lv,label,w=90,hl=[]})=>{
    if(!hex)return null;
    return <div style={{textAlign:'center',cursor:'pointer',flex:1}} onClick={()=>setPopup(hex)}>
      <div style={{fontSize:10,color:P.muted,marginBottom:8,fontWeight:700,letterSpacing:1.5}}>{label}</div>
      <RHex lv={lv} w={w} highlight={hl}/>
      <div style={{marginTop:10,fontSize:13,color:P.fg,lineHeight:1.3}}>{VIET[hex[3]]||''}</div>
      <div style={{fontSize:13,color:P.fg}}>{VIET[hex[4]]||''}</div>
      <div style={{fontSize:17,fontWeight:700,color:P.accent,marginTop:2}}>{shortQ(hex)}</div>
    </div>;
  };

  // Popup (no Chinese)
  const Pop=()=>popup&&(
    <div onClick={()=>setPopup(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,maxWidth:380,width:'100%',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
        <div style={{background:P.accent,padding:'20px 24px',textAlign:'center'}}>
          <div style={{fontSize:26,fontWeight:700,color:'#fff'}}>{popup[1]}</div>
        </div>
        <div style={{padding:'20px 24px',fontSize:14,lineHeight:1.7,color:'#333'}}>{popup[5]}</div>
        <div style={{padding:'0 24px 16px',fontSize:12,color:'#999'}}>Thượng: {TRIGRAMS[popup[3]]?.name} ({TRIGRAMS[popup[3]]?.nature}) — Hạ: {TRIGRAMS[popup[4]]?.name} ({TRIGRAMS[popup[4]]?.nature})</div>
        <button onClick={()=>setPopup(null)} style={{width:'100%',padding:14,background:P.accent,color:'#fff',border:'none',fontSize:15,fontWeight:700,cursor:'pointer'}}>OK</button>
      </div>
    </div>
  );

  // Settings
  const Sett=()=>showSettings&&(
    <div onClick={()=>setShowSettings(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:400,width:'100%',color:P.fg}}>
        <h3 style={{margin:'0 0 16px',color:P.accent}}>Cài Đặt</h3>
        {[['Tên',userName,v=>{setUserName(v);localStorage.setItem('kd_username',v)},'text'],['KB Secret',kbSecret,v=>{setKbSecret(v);localStorage.setItem('kd_kb_secret',v)},'password']].map(([l,val,fn,t])=>(
          <div key={l} style={{marginBottom:12}}><label style={{fontSize:12,display:'block',marginBottom:4,color:P.muted}}>{l}</label>
            <input type={t} value={val} onChange={e=>fn(e.target.value)} style={{width:'100%',padding:10,border:`1px solid ${P.border}`,borderRadius:8,boxSizing:'border-box',fontSize:14,background:P.bg,color:P.fg}}/></div>))}
        <div style={{marginBottom:12}}><label style={{fontSize:12,display:'block',marginBottom:4,color:P.muted}}>Model</label>
          <select value={aiModel} onChange={e=>{setAiModel(e.target.value);localStorage.setItem('kd_model',e.target.value)}} style={{width:'100%',padding:10,border:`1px solid ${P.border}`,borderRadius:8,fontSize:14,background:P.bg,color:P.fg}}>
            <option value="claude-sonnet-4-20250514">Sonnet 4</option><option value="claude-opus-4-20250514">Opus 4</option></select></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontSize:13}}>Giao diện tối</span>
          <button onClick={toggleDark} style={{padding:'6px 16px',border:`1px solid ${P.border}`,borderRadius:6,background:dark?'#333':'#f0f0f0',color:dark?'#fff':'#333',cursor:'pointer'}}>{dark?'🌙':'☀️'}</button>
        </div>
        <button onClick={()=>setShowSettings(false)} style={{width:'100%',padding:10,background:P.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Đóng</button>
      </div>
    </div>
  );

  const ListModal=({show,items,title,onClose,onSelect,onRemove,empty})=>show&&(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:16,maxWidth:500,width:'100%',maxHeight:'80vh',color:P.fg}}>
        <h3 style={{margin:'0 0 12px',color:P.accent}}>{title} ({items.length})</h3>
        <div style={{maxHeight:'60vh',overflowY:'auto'}}>{items.length===0&&<div style={{textAlign:'center',padding:20,color:P.muted}}>{empty}</div>}
          {items.map(h=>(
            <div key={h.id} style={{display:'flex',alignItems:'center',gap:8,padding:10,marginBottom:6,border:`1px solid ${P.border}`,borderRadius:10,background:P.bg}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={()=>{onSelect(h);onClose()}}>
                <div style={{fontWeight:600,color:P.accent,fontSize:14}}>{h.chinh?shortQ(h.chinh):''}{h.queHo?' → '+shortQ(h.queHo):''}{h.bien?' → '+shortQ(h.bien):''}</div>
                <div style={{fontSize:11,color:P.muted,marginTop:2}}>{h.method||''} • {h.question||h.name||'—'} • {h.ts||''}</div>
              </div>
              {onRemove&&<button onClick={()=>onRemove(h.id)} style={{background:'none',border:'none',color:P.muted,fontSize:16,cursor:'pointer'}}>✕</button>}
            </div>
          ))}</div>
        <button onClick={onClose} style={{width:'100%',marginTop:10,padding:10,background:P.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Đóng</button>
      </div>
    </div>
  );

  const wrap={background:P.bg,color:P.fg,minHeight:'100dvh',fontFamily:"'Noto Sans','Inter',system-ui,sans-serif",transform:`translateX(${swipeX}px)`,transition:swipeX===0?'transform .2s ease-out':'none'};

  // ======== HOME ========
  if(view==='home'){
    const MB=({icon,label,color,onClick})=>(
      <button onClick={onClick} style={{padding:'26px 8px',background:P.card,border:`1.5px solid ${P.border}`,borderRadius:16,cursor:'pointer',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
        <div style={{width:48,height:48,borderRadius:14,background:color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color}}>{icon}</div>
        <div style={{fontSize:12,fontWeight:600,color}}>{label}</div>
      </button>
    );
    return(
      <div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
        <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
            <div/><div style={{fontSize:18,fontWeight:700,letterSpacing:1.5}}>KINH DỊCH</div>
            <button onClick={()=>setShowSettings(true)} style={{width:36,height:36,borderRadius:10,border:`1px solid ${P.border}`,background:P.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:15}}>⚙️</button>
          </div>
          <button onClick={()=>{setQName('');setQText('');setQResult(null);setView('question')}}
            style={{width:'100%',padding:'16px 18px',background:P.card,border:`1.5px solid ${P.accent}`,borderRadius:16,marginBottom:20,cursor:'pointer',display:'flex',alignItems:'center',gap:12,textAlign:'left'}}>
            <div style={{width:48,height:48,borderRadius:14,background:P.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>☯</div>
            <div><div style={{fontSize:15,fontWeight:600,color:P.accent}}>Đặt câu hỏi gieo quẻ</div>
              <div style={{fontSize:11,color:P.muted,marginTop:2}}>Nhập sự việc → gieo → lưu → luận giải AI</div></div>
          </button>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
            <MB icon="◴" label="Thời" color={P.red} onClick={()=>castMH('thoi')}/>
            <MB icon="◷" label="Khắc" color={P.amber} onClick={()=>castMH('khac')}/>
            <MB icon="◎" label="Giây" color={P.teal} onClick={()=>castMH('giay')}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            <MB icon="⚃" label="Ngẫu Nhiên" color={P.green} onClick={castNgauNhien}/>
            <MB icon="☰" label="Nhập Quẻ" color={P.purple} onClick={()=>setView('nhap')}/>
            <MB icon="✦" label="Đặc Biệt" color={P.blue} onClick={()=>{setSpecialNum('');setDacBietResult(null);setView('dacbiet')}}/>
          </div>
        </div>
        <Sett/><Pop/>
      </div>
    );
  }

  // ======== QUESTION ========
  if(view==='question'){
    const r=qResult;
    return(
      <div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
        <div style={{maxWidth:480,margin:'0 auto',padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <button onClick={goHome} style={{background:'none',border:'none',color:P.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
            <span style={{fontWeight:700,color:P.accent}}>Gieo Quẻ</span>
            <button onClick={()=>setShowSaved(true)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${P.border}`,background:P.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:14}}>📋</button>
          </div>
          <input type="text" value={qName} onChange={e=>setQName(e.target.value)} placeholder="Tên sự việc"
            style={{width:'100%',padding:12,border:`1px solid ${P.border}`,borderRadius:12,boxSizing:'border-box',fontSize:14,background:P.card,color:P.fg,marginBottom:10}}/>
          <textarea value={qText} onChange={e=>setQText(e.target.value)} rows={5} placeholder="Sự việc và câu hỏi..."
            style={{width:'100%',padding:12,border:`1px solid ${P.border}`,borderRadius:12,boxSizing:'border-box',fontSize:14,fontFamily:'inherit',resize:'none',background:P.card,color:P.fg,marginBottom:16}}/>
          {!r&&<div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:12,color:P.muted,marginBottom:12}}>Tap để gieo quẻ</div>
            <div onClick={castQuestion} style={{width:140,height:140,borderRadius:'50%',background:`radial-gradient(circle at 40% 40%, ${P.accentBg}, ${P.accent})`,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:`0 6px 24px ${P.accent}30`,fontSize:56,color:'#fff',userSelect:'none'}}>☯</div>
          </div>}
          {r&&<>
            <div style={{fontSize:11,color:P.muted,textAlign:'center',marginBottom:6}}>{r.ts}{r.lunar?` • ÂL ${r.lunar.day}/${r.lunar.month}/${r.lunar.year}`:''}</div>
            <div style={{display:'flex',justifyContent:'space-evenly',padding:'24px 8px',marginBottom:10,background:P.card,borderRadius:16,border:`1px solid ${P.border}`}}>
              <QB hex={r.chinh} lv={r.lineValues} hl={r.moving} label="CHÁNH" w={90}/>
              {r.queHo&&<QB hex={r.queHo} lv={hoLv(r.lineValues)} label="HỘ" w={90}/>}
              {r.bien&&<QB hex={r.bien} lv={bienLv(r.lineValues,r.moving)} label="BIẾN" w={90}/>}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button onClick={saveQ} style={{flex:1,padding:10,background:P.card,border:`1px solid ${P.border}`,borderRadius:10,cursor:'pointer',fontWeight:600,color:P.accent}}>💾 Lưu</button>
              <button onClick={()=>setQResult(null)} style={{flex:1,padding:10,background:P.card,border:`1px solid ${P.border}`,borderRadius:10,cursor:'pointer',fontWeight:600,color:P.muted}}>Gieo lại</button>
              <button onClick={()=>{setResult(r);setView('result')}} style={{flex:2,padding:10,background:P.accent,color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'}}>🔮 Luận Giải</button>
            </div>
          </>}
          <ListModal show={showSaved} items={saved} title="📋 Đã Lưu" onClose={()=>setShowSaved(false)} empty="Chưa lưu" onSelect={h=>{setQResult(h);setQName(h.name||'');setQText(h.question||'');setShowSaved(false)}} onRemove={id=>{const u=saved.filter(s=>s.id!==id);setSaved(u);localStorage.setItem('kd_saved',JSON.stringify(u))}}/>
          <Pop/>
        </div>
      </div>
    );
  }

  // ======== NGẪU NHIÊN (pull-down recast) ========
  if(view==='ngaunhien'&&result?.chinh){
    const doPull=()=>{setPullY(0);setTimeout(castNgauNhien,50)};
    return(
      <div style={{...wrap,transform:`translateX(${swipeX}px) translateY(${pullY}px)`,transition:(swipeX===0&&pullY===0)?'transform .25s ease-out':'none'}}
        onTouchStart={e=>{onTS(e);pullRef.current=e.touches[0].clientY}}
        onTouchMove={e=>{
          const dx=e.touches[0].clientX-swipeRef.current.x;
          const dy=e.touches[0].clientY-pullRef.current;
          if(Math.abs(dx)>Math.abs(dy)&&swipeRef.current.x<50&&dx>0){setSwipeX(Math.min(dx*.3,60))}
          else if(dy>0&&Math.abs(dy)>Math.abs(dx)){setPullY(Math.min(dy*.4,80))}
        }}
        onTouchEnd={e=>{
          const dx=e.changedTouches[0].clientX-swipeRef.current.x;
          const dt=Date.now()-swipeRef.current.t;
          if(swipeX>30||(dx>80&&swipeRef.current.x<50&&dt<500)){setSwipeX(0);goHome()}
          else if(pullY>50){setSwipeX(0);doPull()}
          else{setSwipeX(0);setPullY(0)}
        }}>        {pullY>10&&<div style={{textAlign:'center',padding:8,fontSize:12,color:P.accent,fontWeight:600}}>{pullY>50?'↓ Thả để gieo lại':'↓ Kéo xuống gieo lại'}</div>}
        <div style={{maxWidth:600,margin:'0 auto',padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <button onClick={goHome} style={{background:'none',border:'none',color:P.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
            <span style={{fontSize:12,color:P.muted}}>Ngẫu Nhiên • {result.ts}</span>
            <div style={{width:32}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-evenly',padding:'28px 12px',marginBottom:10,background:P.card,borderRadius:16,border:`1px solid ${P.border}`}}>
            <QB hex={result.chinh} lv={result.lineValues} hl={result.moving} label="CHÁNH" w={90}/>
            {result.queHo&&<QB hex={result.queHo} lv={hoLv(result.lineValues)} label="HỘ" w={90}/>}
            {result.bien&&<QB hex={result.bien} lv={bienLv(result.lineValues,result.moving)} label="BIẾN" w={90}/>}
          </div>
          <div style={{textAlign:'center',color:P.muted,fontSize:12,padding:8}}>↓ Kéo xuống để gieo lại</div>
          <button onClick={castNgauNhien} style={{width:'100%',padding:12,marginTop:8,background:P.card,border:`1px solid ${P.border}`,borderRadius:10,cursor:'pointer',color:P.green,fontWeight:600}}>⚃ Gieo lại</button>
        </div>
        <Sett/><Pop/>
      </div>
    );
  }

  // ======== ĐẶC BIỆT (continuous) ========
  if(view==='dacbiet'){
    const r=dacBietResult;
    return(
      <div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
        <div style={{maxWidth:480,margin:'0 auto',padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <button onClick={goHome} style={{background:'none',border:'none',color:P.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
            <span style={{fontWeight:700,color:P.blue}}>✦ Đặc Biệt</span>
            <div style={{width:60}}/>
          </div>
          <p style={{fontSize:13,color:P.muted,textAlign:'center',marginBottom:16}}>Nhập dãy số ngẫu nhiên</p>
          <input type="text" inputMode="numeric" value={specialNum} onChange={e=>setSpecialNum(e.target.value)} placeholder="12345"
            style={{width:'100%',padding:16,border:`2px solid ${P.blue}`,borderRadius:14,fontSize:24,textAlign:'center',background:P.card,color:P.fg,boxSizing:'border-box',marginBottom:12}}/>
          <button onClick={castDacBiet} style={{width:'100%',padding:14,background:P.blue,color:'#fff',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer',fontSize:16,marginBottom:16}}>Xem Quẻ</button>
          {r&&(
            <div style={{background:P.card,borderRadius:14,border:`1px solid ${P.border}`,padding:16,marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-evenly',marginBottom:12}}>
                <QB hex={r.chinh} lv={r.lineValues} hl={r.moving} label="CHÁNH" w={75}/>
                {r.queHo&&<QB hex={r.queHo} lv={hoLv(r.lineValues)} label="HỘ" w={75}/>}
                {r.bien&&<QB hex={r.bien} lv={bienLv(r.lineValues,r.moving)} label="BIẾN" w={75}/>}
              </div>
              <button onClick={()=>{setSpecialNum('');setDacBietResult(null)}} style={{width:'100%',padding:10,background:P.bg,border:`1px solid ${P.border}`,borderRadius:8,cursor:'pointer',color:P.blue,fontWeight:600}}>Gieo tiếp số khác</button>
            </div>
          )}
        </div>
        <Pop/>
      </div>
    );
  }

  // ======== NHẬP QUẺ ========
  if(view==='nhap'){
    return(
      <div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
        <div style={{maxWidth:480,margin:'0 auto',padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <button onClick={()=>{goHome();setManualMoving([])}} style={{background:'none',border:'none',color:P.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
            <span style={{fontWeight:700,color:P.purple}}>☰ Nhập Quẻ</span>
            <div style={{width:60}}/>
          </div>
          <div style={{display:'flex',gap:10,marginBottom:12}}>
            {[['Thượng Quái',manualUpper,setManualUpper],['Hạ Quái',manualLower,setManualLower]].map(([label,val,fn])=>(
              <div key={label} style={{flex:1}}>
                <div style={{fontSize:11,marginBottom:6,color:P.muted,textAlign:'center',fontWeight:600}}>{label}</div>
                {Object.entries(TRIGRAMS).map(([k,t])=>(
                  <button key={k} onClick={()=>fn(k)} style={{width:'100%',padding:6,marginBottom:3,background:val===k?P.purple:P.card,color:val===k?'#fff':P.fg,border:`1px solid ${P.border}`,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:val===k?600:400}}>{t.symbol} {t.name}</button>
                ))}
              </div>
            ))}
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,marginBottom:6,color:P.muted,textAlign:'center',fontWeight:600}}>Hào Động</div>
            <div style={{display:'flex',gap:4,justifyContent:'center'}}>{LINE_NAMES.map((n,i)=>(
              <button key={i} onClick={()=>setManualMoving(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}
                style={{padding:'8px 12px',background:manualMoving.includes(i)?P.red:P.card,color:manualMoving.includes(i)?'#fff':P.fg,border:`1px solid ${P.border}`,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>{n}</button>
            ))}</div>
          </div>
          <button onClick={castNhap} style={{width:'100%',padding:14,background:P.purple,color:'#fff',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer',fontSize:16}}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // ======== RESULT (generic + AI) ========
  if(view==='result'&&result?.chinh){
    const done=!luanLoading&&(luanResult||chatHistory.length>0);
    return(
      <div style={wrap} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
        <div style={{maxWidth:600,margin:'0 auto',padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <button onClick={goHome} style={{background:'none',border:'none',color:P.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
            <span style={{fontSize:12,color:P.muted}}>{result.method} • {result.ts}</span>
            <button onClick={()=>setShowSettings(true)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${P.border}`,background:P.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:14}}>⚙️</button>
          </div>
          {result.lunar&&<div style={{fontSize:11,color:P.muted,textAlign:'center',marginBottom:4}}>ÂL {result.lunar.day}/{result.lunar.month}/{result.lunar.year}</div>}
          {(result.question||result.name)&&<div style={{padding:10,background:P.card,borderRadius:10,marginBottom:10,fontSize:13,border:`1px solid ${P.border}`}}>
            {result.name&&<div style={{fontWeight:600,marginBottom:2}}>{result.name}</div>}
            {result.question&&<div style={{color:P.muted}}>{result.question}</div>}
          </div>}
          <div style={{display:'flex',justifyContent:'space-evenly',padding:'28px 12px',marginBottom:8,background:P.card,borderRadius:16,border:`1px solid ${P.border}`}}>
            <QB hex={result.chinh} lv={result.lineValues} hl={result.moving} label="CHÁNH" w={90}/>
            {result.queHo&&<QB hex={result.queHo} lv={hoLv(result.lineValues)} label="HỘ" w={90}/>}
            {result.bien&&<QB hex={result.bien} lv={bienLv(result.lineValues,result.moving)} label="BIẾN" w={90}/>}
          </div>
          <details style={{marginBottom:10}}>
            <summary style={{fontSize:12,color:P.muted,cursor:'pointer',padding:'6px 0'}}>▸ Chi tiết 6 hào</summary>
            <div style={{padding:10,background:P.card,borderRadius:8,border:`1px solid ${P.border}`,fontSize:12}}>
              {[...result.lines].reverse().map((l,ri)=>{const i=5-ri;const isM=result.moving.includes(i);return<div key={i} style={{padding:'3px 0',color:isM?P.red:P.fg}}>{LINE_NAMES[i]}: {l.value===9?'Lão Dương':l.value===6?'Lão Âm':l.value===7?'Thiếu Dương':'Thiếu Âm'}{isM?' (động)':''}</div>})}
            </div>
          </details>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:12,color:P.muted,fontWeight:600,marginBottom:4}}>Phạm vi sự việc</div>
            <textarea value={phamVi} onChange={e=>setPhamVi(e.target.value)} rows={2} placeholder="Bổ sung hoàn cảnh..."
              style={{width:'100%',padding:10,border:`1px solid ${P.border}`,borderRadius:10,boxSizing:'border-box',fontSize:13,fontFamily:'inherit',resize:'none',background:P.card,color:P.fg}}/>
          </div>
          <button onClick={luanQue} disabled={luanLoading}
            style={{width:'100%',padding:13,background:P.accent,color:'#fff',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer',opacity:luanLoading?.5:1,fontSize:15,marginBottom:10}}>
            🔮 {luanLoading?'Đang luận...':'Luận Giải AI'}
          </button>
          {(luanResult||chatHistory.length>0)&&(
            <div style={{border:`1px solid ${P.border}`,borderRadius:14,padding:14,marginBottom:12,background:P.card}}>
              {chatHistory.length===0&&<div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{luanResult}{luanLoading&&<span style={{color:P.accent}}>▊</span>}</div>}
              {chatHistory.length>0&&chatHistory.map((msg,i)=>(
                <div key={i} style={{marginBottom:10,padding:msg.role==='user'?'10px 14px':0,background:msg.role==='user'?P.bg:'transparent',borderRadius:10,borderLeft:msg.role==='assistant'?`3px solid ${P.accent}`:'none',paddingLeft:msg.role==='assistant'?12:14}}>
                  {msg.role==='user'&&i>0&&<div style={{fontSize:11,color:P.muted,marginBottom:2}}>Hỏi thêm:</div>}
                  <div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{i===0?'(Đã gửi data)':msg.content}{luanLoading&&i===chatHistory.length-1&&msg.role==='assistant'&&<span style={{color:P.accent}}>▊</span>}</div>
                </div>
              ))}
              {done&&<div style={{display:'flex',gap:6,marginTop:10,borderTop:`1px solid ${P.border}`,paddingTop:10}}>
                <input type="text" value={followUp} onChange={e=>setFollowUp(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendFU()}} placeholder="Hỏi thêm..."
                  style={{flex:1,padding:10,border:`1px solid ${P.border}`,borderRadius:8,fontSize:14,background:P.bg,color:P.fg}}/>
                <button onClick={sendFU} disabled={!followUp.trim()||luanLoading} style={{padding:'10px 16px',background:P.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',opacity:!followUp.trim()||luanLoading?.5:1}}>Gửi</button>
              </div>}
            </div>
          )}
          <Sett/><Pop/>
        </div>
      </div>
    );
  }

  return <div style={wrap}><div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100dvh'}}><button onClick={goHome} style={{padding:'12px 24px',background:P.accent,color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontWeight:700}}>← Quay lại</button></div></div>;
}
