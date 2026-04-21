import { useState } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP, getHexagram, getBienQue } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const LINE_NAMES = ['Sơ','Nhị','Tam','Tứ','Ngũ','Thượng'];
const MH_MAP = {1:'111',2:'011',3:'101',4:'001',5:'110',6:'010',7:'100',8:'000'};

// Lunar
function jdn(d,m,y){let a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;let jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;if(jd<2299161)jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;return jd}
function nmJD(k){let T=k/1236.85,T2=T*T,r=Math.PI/180;let J=2415020.75933+29.53058868*k+.0001178*T2+.00033*Math.sin((166.56+132.87*T)*r);let M=359.2242+29.10535608*k,Mp=306.0253+385.81691806*k+.0107306*T2,F=21.2964+390.67050646*k-.0016528*T2;let C=(.1734-.000393*T)*Math.sin(M*r)+.0021*Math.sin(2*r*M)-.4068*Math.sin(Mp*r)+.0161*Math.sin(2*r*Mp)+.0104*Math.sin(2*r*F)-.0051*Math.sin(r*(M+Mp))-.0074*Math.sin(r*(M-Mp))+.0004*Math.sin(r*(2*F+M))-.0004*Math.sin(r*(2*F-M))-.0006*Math.sin(r*(2*F+Mp))+.001*Math.sin(r*(2*F-Mp))+.0005*Math.sin(r*(2*Mp+M));let dt=T<-11?.001+.000839*T+.0002261*T2:-.000278+.000265*T+.000262*T2;return J+C-dt}
function sL(jd){let T=(jd-2451545)/36525,r=Math.PI/180,M=357.5291+35999.0503*T,L=(280.46645+36000.76983*T+(1.9146-.004817*T)*Math.sin(r*M)+.019993*Math.sin(2*r*M)+.00029*Math.sin(3*r*M))*r;L-=Math.PI*2*Math.floor(L/(Math.PI*2));return Math.floor(L/Math.PI*6)}
function gLM11(y){let o=jdn(31,12,y)-2415021,k=Math.floor(o/29.530588853),n=nmJD(k);if(sL(n+.29)>=9)n=nmJD(k-1);return Math.floor(n+.5)}
function gLMO(a){let k=Math.floor((a-2415021.076998695)/29.530588853+.5),l=0,i=1,cc=sL(nmJD(k+i)+.29);do{l=cc;i++;cc=sL(nmJD(k+i)+.29)}while(cc!==l&&i<14);return i-1}
function s2l(d,m,y){let n=jdn(d,m,y),k=Math.floor((n-2415021.076998695)/29.530588853),s=Math.floor(nmJD(k)+.5);if(s>n)s=Math.floor(nmJD(k-1)+.5);let a=gLM11(y),b=a,ly;if(a>=s){ly=y;a=gLM11(y-1)}else{ly=y+1;b=gLM11(y+1)}let ld=n-s+1,df=Math.floor((s-a)/29),ll=0,lm=df+11;if(b-a>365){let lo=gLMO(a);if(df>=lo){lm=df+10;if(df===lo)ll=1}}if(lm>12)lm-=12;if(lm>=11&&df<4)ly-=1;return{day:ld,month:lm,year:ly}}
function hIdx(h){return h>=23||h<1?0:Math.floor((h-1)/2)+1}
function queHo(lv){const i=HEXAGRAM_LOOKUP[[lv[2],lv[3],lv[4]].join('')+[lv[1],lv[2],lv[3]].join('')];return i!==undefined?HEXAGRAMS[i]:null}
function mhCalc(u,l,t){const uu=((u-1)%8)+1,ll=((l-1)%8)+1,mv=((t-1)%6);const uB=MH_MAP[uu],lB=MH_MAP[ll];const lv=[...lB.split('').map(Number),...uB.split('').map(Number)];const moving=[mv];const lines=lv.map((v,i)=>({value:moving.includes(i)?(v===1?9:6):(v===1?7:8)}));return{chinh:getHexagram(lv),bien:getBienQue(lv,moving),lines,lineValues:lv,moving}}
function nowTS(){const d=new Date();return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`}

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
  const[showHistory,setShowHistory]=useState(false);
  const[showSaved,setShowSaved]=useState(false);
  const[chatHistory,setChatHistory]=useState([]);
  const[followUp,setFollowUp]=useState('');
  const[phamVi,setPhamVi]=useState('');
  // Đặc biệt
  const[specialNum,setSpecialNum]=useState('');
  // Nhập quẻ
  const[manualUpper,setManualUpper]=useState('111');
  const[manualLower,setManualLower]=useState('000');
  const[manualMoving,setManualMoving]=useState([]);
  // Đặt câu hỏi
  const[qName,setQName]=useState('');
  const[qText,setQText]=useState('');
  const[qResult,setQResult]=useState(null);

  const toggleDark=()=>{const n=!dark;setDark(n);localStorage.setItem('kd_dark',n?'1':'0')};

  const C={
    bg:dark?'#111113':'#f7f6f3',fg:dark?'#d4d0c8':'#1c1917',card:dark?'#1c1c20':'#ffffff',
    muted:dark?'#6b6860':'#a8a29e',border:dark?'#2a2a2e':'#e7e5e4',
    accent:dark?'#d4a574':'#92400e',accentBg:dark?'#2a1f14':'#fef3c7',
    red:'#b91c1c',green:'#15803d',purple:'#7c3aed',blue:'#1d4ed8',amber:'#b45309',teal:'#0f766e',
  };

  // ======== CAST ========
  const finish=(r,method,question='',name='')=>{
    const ho=r.lineValues?queHo(r.lineValues):null;
    const lu=s2l(new Date().getDate(),new Date().getMonth()+1,new Date().getFullYear());
    const full={id:Date.now(),...r,queHo:ho,method,question,name,lunar:lu,ts:nowTS()};
    setResult(full);
    setHistory(prev=>{const u=[full,...prev].slice(0,50);localStorage.setItem('kd_history',JSON.stringify(u));return u});
    setLuanResult('');setChatHistory([]);setPhamVi('');
    return full;
  };

  const cast=(method)=>{
    const now=new Date(),lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear()),hi=hIdx(now.getHours())+1;
    if(method==='thoi'){const us=lu.year+lu.month+lu.day,ls=us+hi;finish({...mhCalc(us,ls,ls)},'Thời');setView('result')}
    else if(method==='khac'){const us=lu.year+lu.month+lu.day+hi,ls=us+(now.getMinutes()+1);finish({...mhCalc(us,ls,ls)},'Khắc');setView('result')}
    else if(method==='giay'){const sec=now.getSeconds()+1,us=lu.year+lu.month+lu.day+hi;finish({...mhCalc(us,us+sec,us+sec+now.getMilliseconds())},'Giây');setView('result')}
    else if(method==='ngaunhien'){
      const lines=[];for(let i=0;i<6;i++){const coins=[0,0,0].map(()=>Math.random()<.5?2:3);lines.push({value:coins.reduce((a,b)=>a+b,0)})}
      const lv=lines.map(l=>(l.value===7||l.value===9)?1:0);
      const moving=lines.map((l,i)=>(l.value===6||l.value===9)?i:-1).filter(i=>i>=0);
      finish({chinh:getHexagram(lv),bien:moving.length>0?getBienQue(lv,moving):null,lines,lineValues:lv,moving},'Ngẫu Nhiên');
      setView('result');
    }else if(method==='dacbiet'){
      const nums=specialNum.replace(/\D/g,'');if(!nums){alert('Nhập số');return}
      const total=nums.split('').reduce((a,b)=>a+parseInt(b),0),mid=Math.floor(nums.length/2)||1;
      const u=nums.slice(0,mid).split('').reduce((a,b)=>a+parseInt(b),0)||1;
      const l=nums.slice(mid).split('').reduce((a,b)=>a+parseInt(b),0)||1;
      finish({...mhCalc(u,l,total||1)},'Đặc Biệt');setView('result');
    }
  };

  const castNhap=()=>{
    const lo=manualLower.split('').map(Number),up=manualUpper.split('').map(Number);
    const lv=[...lo,...up];const lines=lv.map((v,i)=>({value:manualMoving.includes(i)?(v===1?9:6):(v===1?7:8)}));
    finish({chinh:getHexagram(lv),bien:manualMoving.length>0?getBienQue(lv,manualMoving):null,lines,lineValues:lv,moving:manualMoving},'Nhập Quẻ');
    setView('result');
  };

  // Cast for question page (Mai Hoa Thời)
  const castQuestion=()=>{
    const now=new Date(),lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear()),hi=hIdx(now.getHours())+1;
    const us=lu.year+lu.month+lu.day,ls=us+hi;
    const r=finish({...mhCalc(us,ls,ls)},'Gieo Quẻ',qText,qName);
    setQResult(r);
  };

  // Save question result
  const saveQuestionResult=()=>{
    if(!qResult)return;
    const entry={...qResult,savedAt:new Date().toLocaleString('vi-VN')};
    setSaved(prev=>{const u=[entry,...prev];localStorage.setItem('kd_saved',JSON.stringify(u));return u});
    alert('✓ Đã lưu');
  };

  const toggleSave=(r)=>{
    const exists=saved.some(s=>s.id===r.id);
    const updated=exists?saved.filter(s=>s.id!==r.id):[{...r,savedAt:new Date().toLocaleString('vi-VN')},...saved];
    setSaved(updated);localStorage.setItem('kd_saved',JSON.stringify(updated));
  };
  const isSaved=(id)=>saved.some(s=>s.id===id);

  // ======== AI ========
  const buildPrompt=()=>{if(!result?.chinh)return'';const ch=result.chinh,uT=TRIGRAMS[ch[3]],lT=TRIGRAMS[ch[4]];let p=`# Gieo Quẻ Kinh Dịch\n`;if(result.question)p+=`**Câu hỏi:** ${result.question}\n`;if(result.name)p+=`**Sự việc:** ${result.name}\n`;if(phamVi)p+=`**Phạm vi:** ${phamVi}\n`;p+=`**${result.method}** • ${result.ts}`;if(result.lunar)p+=` • ÂL ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}`;p+=`\n\n## Quẻ Chánh: ${ch[1]} (${ch[2]})\n- Thượng: ${uT.name} (${uT.nature}, ${uT.element})\n- Hạ: ${lT.name} (${lT.nature}, ${lT.element})\n- Nghĩa: ${ch[5]}\n`;if(result.moving?.length>0){const mv0=result.moving[0],isUp=mv0>=3;p+=`- **Thể**: ${isUp?lT.name:uT.name} (${isUp?lT.element:uT.element})\n- **Dụng**: ${isUp?uT.name:lT.name} (${isUp?uT.element:lT.element})\n`}p+=`\n## 6 Hào:\n`;result.lines.forEach((l,i)=>{const isM=result.moving.includes(i);p+=`- ${LINE_NAMES[i]}: ${l.value===9?'Lão Dương★':l.value===6?'Lão Âm★':l.value===7?'Thiếu Dương':'Thiếu Âm'}${isM?' ĐỘNG':''}\n`});if(result.queHo)p+=`\n## Quẻ Hộ: ${result.queHo[1]} — ${result.queHo[5]}\n`;if(result.bien)p+=`\n## Quẻ Biến: ${result.bien[1]} — ${result.bien[5]}\n`;p+=`\n---\nLuận giải. Thể/Dụng, Hộ, Biến. Lời khuyên.`;return p};
  const callAI=async(msgs,onS)=>{const res=await fetch('/api/luan-giai',{method:'POST',headers:{'Content-Type':'application/json','x-kb-secret':kbSecret,'x-user':userName||'anon'},body:JSON.stringify({model:aiModel,max_tokens:4096,system:SYSTEM_PROMPT,messages:msgs})});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'API error')}const reader=res.body.getReader(),dec=new TextDecoder();let full='',buf='';while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop()||'';for(const l of ls){if(!l.startsWith('data: '))continue;try{const o=JSON.parse(l.slice(6));if(o.type==='content_block_delta'&&o.delta?.text){full+=o.delta.text;onS?.(full)}}catch{}}}return full};
  const luanQue=async()=>{if(!kbSecret){setShowSettings(true);return}setLuanResult('');setLuanLoading(true);setChatHistory([]);try{const p=buildPrompt();const t=await callAI([{role:'user',content:p}],setLuanResult);setChatHistory([{role:'user',content:p},{role:'assistant',content:t}])}catch(e){setLuanResult('❌ '+e.message)}finally{setLuanLoading(false)}};
  const sendFU=async()=>{if(!followUp.trim()||luanLoading)return;const m={role:'user',content:followUp},h=[...chatHistory,m];setChatHistory(h);setFollowUp('');setLuanLoading(true);try{const t=await callAI(h,p=>setChatHistory([...h,{role:'assistant',content:p}]));setChatHistory([...h,{role:'assistant',content:t}])}catch(e){setChatHistory([...h,{role:'assistant',content:'❌ '+e.message}])}finally{setLuanLoading(false)}};

  // ======== RENDER HEX — equal width ========
  const RHex=({lv,moving=[],w=90})=>{
    const h=Math.max(6,w/12);
    const gap=w*0.1;
    const half=(w-gap)/2;
    return(
      <div style={{display:'flex',flexDirection:'column-reverse',alignItems:'center',gap:Math.max(3,w/20)}}>
        {lv.map((v,i)=>{
          const isM=moving.includes(i);
          const cl=isM?C.red:C.fg;
          return(
            <div key={i} style={{width:w,display:'flex',justifyContent:'center'}}>
              {v===1
                ?<div style={{width:w,height:h,background:cl,borderRadius:2}}/>
                :<div style={{width:w,display:'flex',justifyContent:'space-between'}}>
                  <div style={{width:half,height:h,background:cl,borderRadius:2}}/>
                  <div style={{width:half,height:h,background:cl,borderRadius:2}}/>
                </div>
              }
            </div>
          );
        })}
      </div>
    );
  };

  // ======== POPUP ========
  const Popup=()=>popup&&(
    <div onClick={()=>setPopup(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,maxWidth:380,width:'100%',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
        <div style={{background:C.accent,padding:'20px 24px',textAlign:'center'}}>
          <div style={{fontSize:26,fontWeight:700,color:'#fff'}}>{popup[1]}</div>
          <div style={{fontSize:34,marginTop:4,color:'rgba(255,255,255,.7)',fontFamily:'serif'}}>{popup[2]}</div>
        </div>
        <div style={{padding:'20px 24px',fontSize:14,lineHeight:1.7,color:'#333'}}>{popup[5]}</div>
        <div style={{padding:'0 24px 16px',fontSize:12,color:'#999'}}>{TRIGRAMS[popup[3]]?.name} ({TRIGRAMS[popup[3]]?.nature}) / {TRIGRAMS[popup[4]]?.name} ({TRIGRAMS[popup[4]]?.nature})</div>
        <button onClick={()=>setPopup(null)} style={{width:'100%',padding:14,background:C.accent,color:'#fff',border:'none',fontSize:15,fontWeight:700,cursor:'pointer'}}>OK</button>
      </div>
    </div>
  );

  // ======== SETTINGS ========
  const Settings=()=>showSettings&&(
    <div onClick={()=>setShowSettings(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:20,maxWidth:400,width:'100%',color:C.fg}}>
        <h3 style={{margin:'0 0 16px',color:C.accent}}>Cài Đặt</h3>
        {[['Tên',userName,v=>{setUserName(v);localStorage.setItem('kd_username',v)},'text'],['KB Secret',kbSecret,v=>{setKbSecret(v);localStorage.setItem('kd_kb_secret',v)},'password']].map(([l,val,fn,t])=>(
          <div key={l} style={{marginBottom:12}}><label style={{fontSize:12,display:'block',marginBottom:4,color:C.muted}}>{l}</label>
            <input type={t} value={val} onChange={e=>fn(e.target.value)} style={{width:'100%',padding:10,border:`1px solid ${C.border}`,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.bg,color:C.fg}}/></div>
        ))}
        <div style={{marginBottom:12}}><label style={{fontSize:12,display:'block',marginBottom:4,color:C.muted}}>Model</label>
          <select value={aiModel} onChange={e=>{setAiModel(e.target.value);localStorage.setItem('kd_model',e.target.value)}} style={{width:'100%',padding:10,border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.fg}}>
            <option value="claude-sonnet-4-20250514">Sonnet 4</option><option value="claude-opus-4-20250514">Opus 4</option></select></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontSize:13}}>Giao diện tối</span>
          <button onClick={toggleDark} style={{padding:'6px 16px',border:`1px solid ${C.border}`,borderRadius:6,background:dark?'#333':'#f0f0f0',color:dark?'#fff':'#333',cursor:'pointer'}}>{dark?'🌙':'☀️'}</button>
        </div>
        <button onClick={()=>setShowSettings(false)} style={{width:'100%',padding:10,background:C.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Đóng</button>
      </div>
    </div>
  );

  // List modal (history/saved)
  const ListModal=({show,items,title,onClose,onSelect,onRemove,empty})=>show&&(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:16,maxWidth:500,width:'100%',maxHeight:'80vh',color:C.fg}}>
        <h3 style={{margin:'0 0 12px',color:C.accent}}>{title} ({items.length})</h3>
        <div style={{maxHeight:'60vh',overflowY:'auto'}}>
          {items.length===0&&<div style={{textAlign:'center',padding:20,color:C.muted}}>{empty}</div>}
          {items.map(h=>(
            <div key={h.id} style={{display:'flex',alignItems:'center',gap:8,padding:10,marginBottom:6,border:`1px solid ${C.border}`,borderRadius:10,background:C.bg}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={()=>{onSelect(h);onClose()}}>
                <div style={{fontWeight:600,color:C.accent,fontSize:14}}>{h.chinh?h.chinh[1]:'?'}{h.queHo?' → '+h.queHo[1]:''}{h.bien?' → '+h.bien[1]:''}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{h.method||''} • {h.question||h.name||'—'} • {h.ts||''}</div>
              </div>
              {onRemove&&<button onClick={()=>onRemove(h.id)} style={{background:'none',border:'none',color:C.muted,fontSize:16,cursor:'pointer'}}>✕</button>}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{width:'100%',marginTop:10,padding:10,background:C.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Đóng</button>
      </div>
    </div>
  );

  // ======== HOME ========
  if(view==='home'){
    const MB=({icon,label,color,onClick})=>(
      <button onClick={onClick} style={{padding:'24px 8px',background:C.card,border:`1.5px solid ${C.border}`,borderRadius:16,cursor:'pointer',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
        <div style={{width:44,height:44,borderRadius:12,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{icon}</div>
        <div style={{fontSize:12,fontWeight:600,color}}>{label}</div>
      </button>
    );
    return(
      <div style={{background:C.bg,color:C.fg,minHeight:'100dvh',fontFamily:"'Noto Sans','Inter',system-ui,sans-serif"}}>
        <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setShowHistory(true)} style={{width:36,height:36,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:15}}>📜</button>
              <button onClick={()=>setShowSaved(true)} style={{width:36,height:36,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:15}}>🔖</button>
            </div>
            <div style={{fontSize:18,fontWeight:700,letterSpacing:1.5}}>KINH DỊCH</div>
            <button onClick={()=>setShowSettings(true)} style={{width:36,height:36,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:15}}>⚙️</button>
          </div>

          {/* Đặt câu hỏi - opens full page */}
          <button onClick={()=>{setQName('');setQText('');setQResult(null);setView('question')}}
            style={{width:'100%',padding:'16px 18px',background:C.card,border:`1.5px solid ${C.accent}`,borderRadius:16,marginBottom:20,cursor:'pointer',display:'flex',alignItems:'center',gap:12,textAlign:'left'}}>
            <div style={{width:44,height:44,borderRadius:12,background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>☯</div>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:C.accent}}>Đặt câu hỏi gieo quẻ</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>Nhập sự việc → gieo → luận giải AI</div>
            </div>
          </button>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
            <MB icon="◴" label="Thời" color={C.red} onClick={()=>cast('thoi')}/>
            <MB icon="◷" label="Khắc" color={C.amber} onClick={()=>cast('khac')}/>
            <MB icon="◎" label="Giây" color={C.teal} onClick={()=>cast('giay')}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            <MB icon="⚃" label="Ngẫu Nhiên" color={C.green} onClick={()=>cast('ngaunhien')}/>
            <MB icon="☰" label="Nhập Quẻ" color={C.purple} onClick={()=>setView('nhap')}/>
            <MB icon="✦" label="Đặc Biệt" color={C.blue} onClick={()=>setView('dacbiet')}/>
          </div>
        </div>

        <ListModal show={showHistory} items={history} title="📜 Lịch Sử" onClose={()=>setShowHistory(false)} empty="Chưa có" onSelect={h=>{setResult(h);setView('result');setLuanResult('');setChatHistory([])}}/>
        <ListModal show={showSaved} items={saved} title="🔖 Đã Lưu" onClose={()=>setShowSaved(false)} empty="Chưa lưu" onSelect={h=>{setResult(h);setView('result');setLuanResult('');setChatHistory([])}} onRemove={id=>{const u=saved.filter(s=>s.id!==id);setSaved(u);localStorage.setItem('kd_saved',JSON.stringify(u))}}/>
        <Settings/><Popup/>
      </div>
    );
  }

  // ======== QUESTION PAGE ========
  if(view==='question'){
    const short=(n)=>n?.split(' ').pop()||'';
    const r=qResult;
    return(
      <div style={{background:C.bg,color:C.fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:480,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <button onClick={()=>setView('home')} style={{background:'none',border:'none',color:C.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
          <span style={{fontWeight:700,color:C.accent}}>Gieo Quẻ</span>
          <div style={{width:60}}/>
        </div>

        <input type="text" value={qName} onChange={e=>setQName(e.target.value)} placeholder="Tên sự việc"
          style={{width:'100%',padding:12,border:`1px solid ${C.border}`,borderRadius:12,boxSizing:'border-box',fontSize:14,background:C.card,color:C.fg,marginBottom:10}}/>
        <textarea value={qText} onChange={e=>setQText(e.target.value)} rows={3} placeholder="Sự việc và câu hỏi..."
          style={{width:'100%',padding:12,border:`1px solid ${C.border}`,borderRadius:12,boxSizing:'border-box',fontSize:14,fontFamily:'inherit',resize:'none',background:C.card,color:C.fg,marginBottom:16}}/>

        {/* Tap to cast */}
        {!r&&(
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Tap vào biểu tượng để gieo quẻ</div>
            <div onClick={castQuestion}
              style={{width:140,height:140,borderRadius:'50%',background:`radial-gradient(circle at 40% 40%, ${C.accentBg}, ${C.accent})`,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:`0 6px 24px ${C.accent}30`,fontSize:56,color:'#fff',userSelect:'none'}}>
              ☯
            </div>
          </div>
        )}

        {/* Result */}
        {r&&(
          <>
            <div style={{fontSize:11,color:C.muted,textAlign:'center',marginBottom:6}}>{r.ts} • ÂL {r.lunar?.day}/{r.lunar?.month}/{r.lunar?.year}</div>
            <div style={{display:'flex',justifyContent:'space-evenly',alignItems:'flex-start',padding:'24px 12px',marginBottom:10,background:C.card,borderRadius:16,border:`1px solid ${C.border}`}}>
              {[r.chinh&&{hex:r.chinh,lv:r.lineValues,mv:r.moving,label:'CHÁNH'},
                r.queHo&&{hex:r.queHo,lv:[r.lineValues[1],r.lineValues[2],r.lineValues[3],r.lineValues[2],r.lineValues[3],r.lineValues[4]],mv:[],label:'HỘ'},
                r.bien&&{hex:r.bien,lv:r.lineValues.map((v,i)=>r.moving.includes(i)?(v===1?0:1):v),mv:[],label:'BIẾN'}
              ].filter(Boolean).map(({hex,lv,mv,label})=>(
                <div key={label} style={{textAlign:'center',cursor:'pointer',flex:1}} onClick={()=>setPopup(hex)}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:8,fontWeight:700,letterSpacing:1.5}}>{label}</div>
                  <RHex lv={lv} moving={mv} w={80}/>
                  <div style={{marginTop:10,fontSize:15,fontWeight:700,color:C.accent}}>{short(hex[1])}</div>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button onClick={saveQuestionResult} style={{flex:1,padding:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,cursor:'pointer',fontWeight:600,color:C.accent}}>💾 Lưu</button>
              <button onClick={()=>{setQResult(null)}} style={{flex:1,padding:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,cursor:'pointer',fontWeight:600,color:C.muted}}>Gieo lại</button>
              <button onClick={()=>{setResult(r);setView('result')}} style={{flex:2,padding:10,background:C.accent,color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'}}>🔮 Luận Giải</button>
            </div>
          </>
        )}
        <Popup/>
      </div>
    );
  }

  // ======== ĐẶC BIỆT ========
  if(view==='dacbiet'){
    return(
      <div style={{background:C.bg,color:C.fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:20,maxWidth:480,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <button onClick={()=>setView('home')} style={{background:'none',border:'none',color:C.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
          <span style={{fontWeight:700,color:C.blue}}>✦ Đặc Biệt</span>
          <div style={{width:60}}/>
        </div>
        <p style={{fontSize:13,color:C.muted,textAlign:'center',marginBottom:20}}>Nhập dãy số ngẫu nhiên</p>
        <input type="text" inputMode="numeric" value={specialNum} onChange={e=>setSpecialNum(e.target.value)} placeholder="VD: 394728"
          style={{width:'100%',padding:16,border:`2px solid ${C.blue}`,borderRadius:14,fontSize:24,textAlign:'center',background:C.card,color:C.fg,boxSizing:'border-box',marginBottom:16}}/>
        <button onClick={()=>cast('dacbiet')} style={{width:'100%',padding:14,background:C.blue,color:'#fff',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer',fontSize:16,marginBottom:12}}>Xem Quẻ</button>
        {result&&result.method==='Đặc Biệt'&&(
          <div style={{textAlign:'center',padding:8}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Quẻ vừa gieo: <b style={{color:C.accent}}>{result.chinh?result.chinh[1]:''}</b></div>
            <button onClick={()=>{setSpecialNum('');}} style={{padding:'8px 20px',background:C.card,border:`1px solid ${C.border}`,borderRadius:8,cursor:'pointer',color:C.blue,fontWeight:600,fontSize:13}}>Gieo tiếp số khác</button>
          </div>
        )}
      </div>
    );
  }

  // ======== NHẬP QUẺ ========
  if(view==='nhap'){
    return(
      <div style={{background:C.bg,color:C.fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:480,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <button onClick={()=>{setView('home');setManualMoving([])}} style={{background:'none',border:'none',color:C.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
          <span style={{fontWeight:700,color:C.purple}}>☰ Nhập Quẻ</span>
          <div style={{width:60}}/>
        </div>
        <div style={{display:'flex',gap:10,marginBottom:12}}>
          {[['Thượng Quái',manualUpper,setManualUpper],['Hạ Quái',manualLower,setManualLower]].map(([label,val,fn])=>(
            <div key={label} style={{flex:1}}>
              <div style={{fontSize:11,marginBottom:6,color:C.muted,textAlign:'center',fontWeight:600}}>{label}</div>
              {Object.entries(TRIGRAMS).map(([k,t])=>(
                <button key={k} onClick={()=>fn(k)} style={{width:'100%',padding:6,marginBottom:3,background:val===k?C.purple:C.card,color:val===k?'#fff':C.fg,border:`1px solid ${C.border}`,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:val===k?600:400}}>{t.symbol} {t.name}</button>
              ))}
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,marginBottom:6,color:C.muted,textAlign:'center',fontWeight:600}}>Hào Động</div>
          <div style={{display:'flex',gap:4,justifyContent:'center'}}>{LINE_NAMES.map((n,i)=>(
            <button key={i} onClick={()=>setManualMoving(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}
              style={{padding:'8px 12px',background:manualMoving.includes(i)?C.red:C.card,color:manualMoving.includes(i)?'#fff':C.fg,border:`1px solid ${C.border}`,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>{n}</button>
          ))}</div>
        </div>
        <button onClick={castNhap} style={{width:'100%',padding:14,background:C.purple,color:'#fff',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer',fontSize:16}}>Xem Quẻ</button>
      </div>
    );
  }

  // ======== RESULT ========
  if(view==='result'&&result?.chinh){
    const ch=result.chinh,ho=result.queHo,b=result.bien;
    const bLv=b?result.lineValues.map((v,i)=>result.moving.includes(i)?(v===1?0:1):v):null;
    const hoLv=ho?[result.lineValues[1],result.lineValues[2],result.lineValues[3],result.lineValues[2],result.lineValues[3],result.lineValues[4]]:null;
    const done=!luanLoading&&(luanResult||chatHistory.length>0);
    const short=(n)=>n.split(' ').pop();

    return(
      <div style={{background:C.bg,color:C.fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:600,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <button onClick={()=>{setView('home');setResult(null);setLuanResult('');setChatHistory([])}} style={{background:'none',border:'none',color:C.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>← Quay lại</button>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>toggleSave(result)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:isSaved(result.id)?C.accentBg:C.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:14}}>{isSaved(result.id)?'🔖':'📌'}</button>
            <button onClick={()=>setShowSettings(true)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:14}}>⚙️</button>
          </div>
        </div>

        <div style={{fontSize:11,color:C.muted,textAlign:'center',marginBottom:4}}>{result.method} • {result.ts}{result.lunar?` • ÂL ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}`:''}</div>
        {(result.question||result.name)&&<div style={{padding:10,background:C.card,borderRadius:10,marginBottom:10,fontSize:13,border:`1px solid ${C.border}`}}>
          {result.name&&<div style={{fontWeight:600,marginBottom:2}}>{result.name}</div>}
          {result.question&&<div style={{color:C.muted}}>{result.question}</div>}
        </div>}

        {/* 3 Hexagrams — LARGER */}
        <div style={{display:'flex',justifyContent:'space-evenly',alignItems:'flex-start',padding:'24px 12px',marginBottom:8,background:C.card,borderRadius:16,border:`1px solid ${C.border}`}}>
          {[{hex:ch,lv:result.lineValues,mv:result.moving,label:'CHÁNH'},
            ho&&{hex:ho,lv:hoLv,mv:[],label:'HỘ'},
            b&&{hex:b,lv:bLv,mv:[],label:'BIẾN'}
          ].filter(Boolean).map(({hex,lv,mv,label})=>(
            <div key={label} style={{textAlign:'center',cursor:'pointer',flex:1}} onClick={()=>setPopup(hex)}>
              <div style={{fontSize:10,color:C.muted,marginBottom:8,fontWeight:700,letterSpacing:1.5}}>{label}</div>
              <RHex lv={lv} moving={mv} w={90}/>
              <div style={{marginTop:10,fontSize:16,fontWeight:700,color:C.accent}}>{short(hex[1])}</div>
            </div>
          ))}
        </div>

        <details style={{marginBottom:10}}>
          <summary style={{fontSize:12,color:C.muted,cursor:'pointer',padding:'6px 0'}}>▸ Chi tiết 6 hào</summary>
          <div style={{padding:10,background:C.card,borderRadius:8,border:`1px solid ${C.border}`,fontSize:12}}>
            {[...result.lines].reverse().map((l,ri)=>{const i=5-ri;const isM=result.moving.includes(i);return<div key={i} style={{padding:'3px 0',color:isM?C.red:C.fg}}>{LINE_NAMES[i]}: {l.value===9?'Lão Dương ★':l.value===6?'Lão Âm ★':l.value===7?'Thiếu Dương':'Thiếu Âm'}</div>})}
          </div>
        </details>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:4}}>Phạm vi sự việc</div>
          <textarea value={phamVi} onChange={e=>setPhamVi(e.target.value)} rows={2} placeholder="Bổ sung hoàn cảnh..."
            style={{width:'100%',padding:10,border:`1px solid ${C.border}`,borderRadius:10,boxSizing:'border-box',fontSize:13,fontFamily:'inherit',resize:'none',background:C.card,color:C.fg}}/>
        </div>

        <button onClick={luanQue} disabled={luanLoading}
          style={{width:'100%',padding:13,background:C.accent,color:'#fff',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer',opacity:luanLoading?.5:1,fontSize:15,marginBottom:10}}>
          🔮 {luanLoading?'Đang luận...':'Luận Giải AI'}
        </button>

        {(luanResult||chatHistory.length>0)&&(
          <div style={{border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:12,background:C.card}}>
            {chatHistory.length===0&&<div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{luanResult}{luanLoading&&<span style={{color:C.accent}}>▊</span>}</div>}
            {chatHistory.length>0&&chatHistory.map((msg,i)=>(
              <div key={i} style={{marginBottom:10,padding:msg.role==='user'?'10px 14px':0,background:msg.role==='user'?C.bg:'transparent',borderRadius:10,borderLeft:msg.role==='assistant'?`3px solid ${C.accent}`:'none',paddingLeft:msg.role==='assistant'?12:14}}>
                {msg.role==='user'&&i>0&&<div style={{fontSize:11,color:C.muted,marginBottom:2}}>Hỏi thêm:</div>}
                <div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{i===0?'(Đã gửi data)':msg.content}{luanLoading&&i===chatHistory.length-1&&msg.role==='assistant'&&<span style={{color:C.accent}}>▊</span>}</div>
              </div>
            ))}
            {done&&(
              <div style={{display:'flex',gap:6,marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                <input type="text" value={followUp} onChange={e=>setFollowUp(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendFU()}} placeholder="Hỏi thêm..."
                  style={{flex:1,padding:10,border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.fg}}/>
                <button onClick={sendFU} disabled={!followUp.trim()||luanLoading} style={{padding:'10px 16px',background:C.accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',opacity:!followUp.trim()||luanLoading?.5:1}}>Gửi</button>
              </div>
            )}
          </div>
        )}
        <Settings/><Popup/>
      </div>
    );
  }

  return<div style={{background:C.bg,color:C.fg,minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center'}}><button onClick={()=>setView('home')} style={{padding:'12px 24px',background:C.accent,color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontWeight:700}}>← Quay lại</button></div>;
}
