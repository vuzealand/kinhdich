import { useState, useMemo, useEffect, useRef } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP, getHexagram, getBienQue } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const LINE_NAMES = ['Sơ','Nhị','Tam','Tứ','Ngũ','Thượng'];
const MH_MAP = {1:'111',2:'011',3:'101',4:'001',5:'110',6:'010',7:'100',8:'000'};

// Lunar calendar (Hồ Ngọc Đức)
function jdn(d,m,y){let a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3,jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;if(jd<2299161)jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;return jd}
function newMoonJD(k){let T=k/1236.85,T2=T*T,T3=T2*T,dr=Math.PI/180;let J=2415020.75933+29.53058868*k+.0001178*T2-.000000155*T3+.00033*Math.sin((166.56+132.87*T-.009173*T2)*dr);let M=359.2242+29.10535608*k-.0000333*T2,Mp=306.0253+385.81691806*k+.0107306*T2,F=21.2964+390.67050646*k-.0016528*T2;let C=(.1734-.000393*T)*Math.sin(M*dr)+.0021*Math.sin(2*dr*M)-.4068*Math.sin(Mp*dr)+.0161*Math.sin(2*dr*Mp)+.0104*Math.sin(2*dr*F)-.0051*Math.sin(dr*(M+Mp))-.0074*Math.sin(dr*(M-Mp))+.0004*Math.sin(dr*(2*F+M))-.0004*Math.sin(dr*(2*F-M))-.0006*Math.sin(dr*(2*F+Mp))+.001*Math.sin(dr*(2*F-Mp))+.0005*Math.sin(dr*(2*Mp+M));let dt=T<-11?.001+.000839*T+.0002261*T2:-.000278+.000265*T+.000262*T2;return J+C-dt}
function sunLong(jd){let T=(jd-2451545)/36525,dr=Math.PI/180,M=357.5291+35999.0503*T,L0=280.46645+36000.76983*T,DL=(1.9146-.004817*T)*Math.sin(dr*M)+.019993*Math.sin(2*dr*M)+.00029*Math.sin(3*dr*M),L=(L0+DL)*dr;L-=Math.PI*2*Math.floor(L/(Math.PI*2));return Math.floor(L/Math.PI*6)}
function getLM11(y){let o=jdn(31,12,y)-2415021,k=Math.floor(o/29.530588853),n=newMoonJD(k);if(sunLong(n+7/24)>=9)n=newMoonJD(k-1);return Math.floor(n+.5)}
function getLMO(a){let k=Math.floor((a-2415021.076998695)/29.530588853+.5),l=0,i=1,c=sunLong(newMoonJD(k+i)+7/24);do{l=c;i++;c=sunLong(newMoonJD(k+i)+7/24)}while(c!==l&&i<14);return i-1}
function s2l(d,m,y){let n=jdn(d,m,y),k=Math.floor((n-2415021.076998695)/29.530588853),s=Math.floor(newMoonJD(k)+.5);if(s>n)s=Math.floor(newMoonJD(k-1)+.5);let a=getLM11(y),b=a,ly;if(a>=s){ly=y;a=getLM11(y-1)}else{ly=y+1;b=getLM11(y+1)}let ld=n-s+1,df=Math.floor((s-a)/29),ll=0,lm=df+11;if(b-a>365){let lo=getLMO(a);if(df>=lo){lm=df+10;if(df===lo)ll=1}}if(lm>12)lm-=12;if(lm>=11&&df<4)ly-=1;return{day:ld,month:lm,year:ly}}

function hourIdx(h){return h>=23||h<1?0:Math.floor((h-1)/2)+1}

// Quẻ Hộ
function getQueHo(lv){const lo=[lv[1],lv[2],lv[3]].join(''),up=[lv[2],lv[3],lv[4]].join('');const i=HEXAGRAM_LOOKUP[up+lo];return i!==undefined?HEXAGRAMS[i]:null}

// Mai Hoa
function maiHoa(upper,lower,total){
  const u=((upper-1)%8)+1,l=((lower-1)%8)+1,mv=((total-1)%6);
  const uB=MH_MAP[u],lB=MH_MAP[l];
  const lv=[...lB.split('').map(Number),...uB.split('').map(Number)];
  const moving=[mv];
  const lines=lv.map((v,i)=>({value:moving.includes(i)?(v===1?9:6):(v===1?7:8)}));
  return{chinh:getHexagram(lv),bien:getBienQue(lv,moving),lines,lineValues:lv,moving};
}
function maiHoaTime(h,d,m,y){
  const lu=s2l(d,m,y),hi=hourIdx(h)+1;
  const us=lu.year+lu.month+lu.day,ls=us+hi;
  return{...maiHoa(us,ls,ls),lunar:lu,hIdx:hi};
}

export default function KinhDichApp(){
  // Steps: 'input' → 'cast' → 'result'
  const[step,setStep]=useState('input');
  const[name,setName]=useState(()=>localStorage.getItem('kd_username')||'');
  const[question,setQuestion]=useState('');
  const[method,setMethod]=useState('ctbt'); // ctbt|nhap|giay|dacbiet
  const[result,setResult]=useState(null);
  const[popup,setPopup]=useState(null); // hex data for popup
  const[dark,setDark]=useState(()=>localStorage.getItem('kd_dark')==='1');
  const[kbSecret,setKbSecret]=useState(()=>localStorage.getItem('kd_kb_secret')||'');
  const[aiModel,setAiModel]=useState(()=>localStorage.getItem('kd_model')||'claude-sonnet-4-20250514');
  const[luanResult,setLuanResult]=useState('');
  const[luanLoading,setLuanLoading]=useState(false);
  const[showSettings,setShowSettings]=useState(false);
  const[history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('kd_history')||'[]')}catch{return[]}});
  const[showHistory,setShowHistory]=useState(false);
  const[chatHistory,setChatHistory]=useState([]);
  const[followUp,setFollowUp]=useState('');
  const[phamVi,setPhamVi]=useState('');
  // Manual
  const[manualUpper,setManualUpper]=useState('111');
  const[manualLower,setManualLower]=useState('000');
  const[manualMoving,setManualMoving]=useState([]);
  // Đặc biệt
  const[specialNum,setSpecialNum]=useState('');

  const toggleDark=()=>{const n=!dark;setDark(n);localStorage.setItem('kd_dark',n?'1':'0')};
  const saveName=(n)=>{setName(n);localStorage.setItem('kd_username',n)};

  const bg=dark?'#1a1a2e':'#fff';
  const fg=dark?'#e0e0e0':'#333';
  const card=dark?'#2a2a40':'#f5f0e8';
  const gold='#8b6914';
  const goldBg='#c9a84c';

  // ======== CAST ========
  const finishCast=(r)=>{
    const ho=r.lineValues?getQueHo(r.lineValues):null;
    const now=new Date();
    const full={...r,queHo:ho,name,question,phamVi,ts:now.toLocaleString('vi-VN'),time:`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} ${now.getDate()}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`};
    setResult(full);
    const entry={id:Date.now(),...full};
    const updated=[entry,...history].slice(0,50);
    setHistory(updated);
    localStorage.setItem('kd_history',JSON.stringify(updated));
    setLuanResult('');setChatHistory([]);
    setStep('result');
  };

  const castCTBT=()=>{
    const now=new Date();
    const r=maiHoaTime(now.getHours(),now.getDate(),now.getMonth()+1,now.getFullYear());
    finishCast({...r,method:'ctbt'});
  };

  const castGiay=()=>{
    const now=new Date();
    const sec=now.getSeconds()+1,ms=now.getMilliseconds();
    const total=sec*1000+ms;
    finishCast({...maiHoa(sec,sec+(now.getMinutes()+1),total),method:'giay',seconds:sec});
  };

  const castDacBiet=()=>{
    const nums=specialNum.replace(/[^\d]/g,'');
    if(nums.length<1){alert('Nhập ít nhất 1 số');return}
    const total=nums.split('').reduce((a,b)=>a+parseInt(b),0);
    const mid=Math.floor(nums.length/2);
    const upper=nums.slice(0,mid||1).split('').reduce((a,b)=>a+parseInt(b),0);
    const lower=nums.slice(mid||1).split('').reduce((a,b)=>a+parseInt(b),0);
    finishCast({...maiHoa(upper||1,lower||1,total||1),method:'dacbiet',inputNums:specialNum});
  };

  const castManual=()=>{
    const lo=manualLower.split('').map(Number),up=manualUpper.split('').map(Number);
    const lv=[...lo,...up];
    const lines=lv.map((v,i)=>({value:manualMoving.includes(i)?(v===1?9:6):(v===1?7:8)}));
    finishCast({chinh:getHexagram(lv),bien:manualMoving.length>0?getBienQue(lv,manualMoving):null,lines,lineValues:lv,moving:manualMoving,method:'nhap'});
  };

  // ======== AI ========
  const buildPrompt=()=>{
    if(!result?.chinh)return'';
    const c=result.chinh,uT=TRIGRAMS[c[3]],lT=TRIGRAMS[c[4]];
    let p=`# Gieo Quẻ Kinh Dịch\n`;
    if(question)p+=`**Câu hỏi:** ${question}\n`;
    if(phamVi)p+=`**Phạm vi:** ${phamVi}\n`;
    if(result.time)p+=`**Thời điểm:** ${result.time}\n`;
    if(result.lunar)p+=`**Âm lịch:** ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}\n`;
    p+=`\n## Quẻ Chánh: ${c[1]} (${c[2]})\n- Thượng: ${uT.name} ${uT.symbol} (${uT.nature}, ${uT.element})\n- Hạ: ${lT.name} ${lT.symbol} (${lT.nature}, ${lT.element})\n- Nghĩa: ${c[5]}\n`;
    // Thể Dụng
    if(result.moving?.length>0){
      const mvLine=result.moving[0];
      const isUpperMoving=mvLine>=3;
      p+=`- **Thể** (${isUpperMoving?'Hạ':'Thượng'} quái = ${isUpperMoving?lT.name:uT.name}, ${isUpperMoving?lT.element:uT.element})\n`;
      p+=`- **Dụng** (${isUpperMoving?'Thượng':'Hạ'} quái = ${isUpperMoving?uT.name:lT.name}, ${isUpperMoving?uT.element:lT.element})\n`;
    }
    p+=`\n## 6 Hào:\n`;
    result.lines.forEach((l,i)=>{
      const isM=result.moving.includes(i);
      const lb=l.value===9?'Lão Dương (động)':l.value===6?'Lão Âm (động)':l.value===7?'Thiếu Dương':'Thiếu Âm';
      p+=`- ${LINE_NAMES[i]}: ${lb}${isM?' ★ĐỘNG':''}\n`;
    });
    if(result.queHo){const h=result.queHo;p+=`\n## Quẻ Hộ: ${h[1]} (${h[2]})\n- Nghĩa: ${h[5]}\n`}
    if(result.bien){const b=result.bien;p+=`\n## Quẻ Biến: ${b[1]} (${b[2]})\n- Nghĩa: ${b[5]}\n`}
    p+=`\n---\nLuận giải quẻ này${question?' cho câu hỏi trên':''}. Phân tích Thể/Dụng sinh khắc, quẻ Hộ (nội tình), quẻ Biến (kết quả). Lời khuyên cụ thể.`;
    return p;
  };

  const callAI=async(msgs,onStream)=>{
    const res=await fetch('/api/luan-giai',{method:'POST',headers:{'Content-Type':'application/json','x-kb-secret':kbSecret,'x-user':name||'anonymous'},body:JSON.stringify({model:aiModel,max_tokens:4096,system:SYSTEM_PROMPT,messages:msgs})});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'API error')}
    const reader=res.body.getReader(),dec=new TextDecoder();let full='',buf='';
    while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop()||'';for(const l of ls){if(!l.startsWith('data: '))continue;try{const o=JSON.parse(l.slice(6));if(o.type==='content_block_delta'&&o.delta?.text){full+=o.delta.text;onStream?.(full)}}catch{}}}
    return full;
  };

  const luanQue=async()=>{
    if(!kbSecret){setShowSettings(true);return}
    setLuanResult('');setLuanLoading(true);setChatHistory([]);
    try{const p=buildPrompt();const t=await callAI([{role:'user',content:p}],setLuanResult);setChatHistory([{role:'user',content:p},{role:'assistant',content:t}])}
    catch(e){setLuanResult('❌ '+e.message)}finally{setLuanLoading(false)}
  };

  const sendFollowUp=async()=>{
    if(!followUp.trim()||luanLoading)return;
    const m={role:'user',content:followUp},h=[...chatHistory,m];setChatHistory(h);setFollowUp('');setLuanLoading(true);
    try{const t=await callAI(h,p=>setChatHistory([...h,{role:'assistant',content:p}]));setChatHistory([...h,{role:'assistant',content:t}])}
    catch(e){setChatHistory([...h,{role:'assistant',content:'❌ '+e.message}])}finally{setLuanLoading(false)}
  };

  // ======== RENDER HEXAGRAM ========
  const renderHex=(lv,moving=[],w=80,h=8)=>(
    <div style={{display:'flex',flexDirection:'column-reverse',alignItems:'center',gap:4}}>
      {lv.map((v,i)=>{
        const isM=moving.includes(i);
        const c=isM?'#c62828':(dark?'#e0e0e0':'#333');
        return <div key={i}>{v===1?<div style={{width:w,height:h,background:c,borderRadius:2}}/>:<div style={{display:'flex',gap:w*.12}}><div style={{width:w*.42,height:h,background:c,borderRadius:2}}/><div style={{width:w*.42,height:h,background:c,borderRadius:2}}/></div>}</div>;
      })}
    </div>
  );

  // ======== SETTINGS ========
  const renderSettings=()=>showSettings&&(
    <div onClick={()=>setShowSettings(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:bg,borderRadius:10,padding:16,maxWidth:400,width:'100%',color:fg}}>
        <h3 style={{margin:'0 0 12px',color:gold}}>⚙️ Cài Đặt</h3>
        <div style={{marginBottom:12,padding:10,background:dark?'#2a1a00':'#fff8e1',border:'1px solid '+gold,borderRadius:6}}>
          <label style={{fontSize:12,color:gold,fontWeight:'bold',display:'block',marginBottom:4}}>🔑 KB Secret</label>
          <input type="password" value={kbSecret} onChange={e=>{setKbSecret(e.target.value);localStorage.setItem('kd_kb_secret',e.target.value)}} placeholder="Mật khẩu nhóm..."
            style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4,boxSizing:'border-box',fontSize:14,background:card,color:fg}}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,display:'block',marginBottom:4}}>Model</label>
          <select value={aiModel} onChange={e=>{setAiModel(e.target.value);localStorage.setItem('kd_model',e.target.value)}} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4,fontSize:14,background:card,color:fg}}>
            <option value="claude-sonnet-4-20250514">Sonnet 4</option><option value="claude-opus-4-20250514">Opus 4</option>
          </select>
        </div>
        <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
          <label style={{fontSize:12}}>Dark Mode</label>
          <button onClick={toggleDark} style={{padding:'4px 12px',border:'1px solid #ccc',borderRadius:4,background:dark?'#333':'#fff',color:dark?'#fff':'#333',cursor:'pointer'}}>{dark?'🌙':'☀️'}</button>
        </div>
        <button onClick={()=>setShowSettings(false)} style={{width:'100%',padding:8,background:gold,color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:'bold',cursor:'pointer'}}>Đóng</button>
      </div>
    </div>
  );

  // ======== POPUP ========
  const renderPopup=()=>popup&&(
    <div onClick={()=>setPopup(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:10,maxWidth:380,width:'100%',overflow:'hidden'}}>
        <div style={{background:goldBg,padding:'16px 20px',textAlign:'center'}}>
          <div style={{fontSize:24,fontWeight:'bold',color:'#fff'}}>{popup[1]}</div>
        </div>
        <div style={{padding:'16px 20px',fontSize:14,lineHeight:1.6,color:'#333'}}>
          <div style={{marginBottom:8}}>{popup[5]}</div>
          <div style={{fontSize:12,color:'#888'}}>
            {TRIGRAMS[popup[3]]?.name} ({TRIGRAMS[popup[3]]?.nature}) / {TRIGRAMS[popup[4]]?.name} ({TRIGRAMS[popup[4]]?.nature})
          </div>
        </div>
        <button onClick={()=>setPopup(null)} style={{width:'100%',padding:12,background:gold,color:'#fff',border:'none',fontSize:16,fontWeight:'bold',cursor:'pointer'}}>OK</button>
      </div>
    </div>
  );

  // ======== STEP 1: INPUT ========
  if(step==='input'){
    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:480,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <button onClick={()=>setShowHistory(true)} style={{background:'none',border:'none',fontSize:16,cursor:'pointer',color:fg}}>📜</button>
          <span style={{fontSize:18,fontWeight:'bold',color:gold}}>KINH DỊCH</span>
          <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',fontSize:16,cursor:'pointer',color:fg}}>⚙️</button>
        </div>

        <div style={{background:card,borderRadius:10,padding:16,border:`1px solid ${dark?'#444':'#ddd'}`}}>
          <input type="text" value={name} onChange={e=>saveName(e.target.value)} placeholder="Tên sự kiện, sự việc"
            style={{width:'100%',padding:10,border:`1px solid ${gold}`,borderRadius:6,boxSizing:'border-box',fontSize:15,background:'transparent',color:fg,marginBottom:12}}/>

          <div style={{color:gold,fontSize:13,fontWeight:'bold',marginBottom:4}}>Sự việc và câu hỏi:</div>
          <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={4} placeholder="Nhập câu hỏi..."
            style={{width:'100%',padding:10,border:`1px solid ${dark?'#555':'#ccc'}`,borderRadius:6,boxSizing:'border-box',fontSize:14,fontFamily:'inherit',resize:'none',background:'transparent',color:fg,marginBottom:12}}/>

          {/* Method buttons */}
          <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
            {[['ctbt','CTBT','#c9a84c'],['nhap','NHẬP','#888'],['giay','GIÂY','#888'],['dacbiet','SỐ','#888']].map(([m,label,clr])=>(
              <button key={m} onClick={()=>setMethod(m)}
                style={{padding:'6px 14px',borderRadius:4,border:'none',fontSize:12,fontWeight:'bold',cursor:'pointer',
                  background:method===m?goldBg:'#ddd',color:method===m?'#fff':'#666'}}>
                {label}
              </button>
            ))}
          </div>

          {/* Conditional inputs */}
          {method==='dacbiet'&&(
            <input type="text" value={specialNum} onChange={e=>setSpecialNum(e.target.value)} placeholder="Nhập số ngẫu nhiên..."
              style={{width:'100%',padding:10,border:`1px solid ${gold}`,borderRadius:6,boxSizing:'border-box',fontSize:16,textAlign:'center',background:'transparent',color:fg,marginBottom:12}}/>
          )}

          {method==='nhap'?(
            <button onClick={()=>setStep('manual')} style={{width:'100%',padding:14,background:goldBg,color:'#fff',border:'none',borderRadius:8,fontSize:16,fontWeight:'bold',cursor:'pointer'}}>
              NHẬP QUẺ
            </button>
          ):(
            <button onClick={()=>setStep('cast')} style={{width:'100%',padding:14,background:goldBg,color:'#fff',border:'none',borderRadius:8,fontSize:16,fontWeight:'bold',cursor:'pointer'}}>
              GIEO QUẺ
            </button>
          )}
        </div>

        {/* History */}
        {showHistory&&(
          <div onClick={()=>setShowHistory(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16}}>
            <div onClick={e=>e.stopPropagation()} style={{background:bg,borderRadius:10,padding:16,maxWidth:500,width:'100%',maxHeight:'80vh',color:fg}}>
              <h3 style={{margin:'0 0 12px',color:gold}}>📜 Lịch Sử ({history.length})</h3>
              <div style={{maxHeight:'60vh',overflowY:'auto'}}>
                {history.length===0&&<div style={{textAlign:'center',padding:20,color:'#999'}}>Chưa có</div>}
                {history.map(h=>(
                  <div key={h.id} onClick={()=>{setResult(h);setStep('result');setShowHistory(false);setLuanResult('');setChatHistory([])}}
                    style={{padding:10,marginBottom:6,border:'1px solid #ddd',borderRadius:6,cursor:'pointer',background:card}}>
                    <div style={{fontWeight:'bold',color:gold}}>{h.chinh?h.chinh[1]:'?'}{h.queHo?' | '+h.queHo[1]:''}{h.bien?' → '+h.bien[1]:''}</div>
                    <div style={{fontSize:11,color:'#888'}}>{h.question||h.name||'—'} • {h.ts}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowHistory(false)} style={{width:'100%',marginTop:8,padding:8,background:gold,color:'#fff',border:'none',borderRadius:6,fontWeight:'bold',cursor:'pointer'}}>Đóng</button>
            </div>
          </div>
        )}
        {renderSettings()}
      </div>
    );
  }

  // ======== STEP: MANUAL ========
  if(step==='manual'){
    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:480,margin:'0 auto'}}>
        <h3 style={{color:gold,marginBottom:12}}>✏️ Nhập Quẻ</h3>
        <div style={{display:'flex',gap:10,marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,marginBottom:4,color:'#888'}}>Thượng Quái</div>
            {Object.entries(TRIGRAMS).map(([k,t])=>(
              <button key={k} onClick={()=>setManualUpper(k)} style={{width:'100%',padding:5,marginBottom:3,background:manualUpper===k?gold:card,color:manualUpper===k?'#fff':fg,border:'1px solid #ccc',borderRadius:4,cursor:'pointer',fontSize:12}}>
                {t.symbol} {t.name}
              </button>
            ))}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,marginBottom:4,color:'#888'}}>Hạ Quái</div>
            {Object.entries(TRIGRAMS).map(([k,t])=>(
              <button key={k} onClick={()=>setManualLower(k)} style={{width:'100%',padding:5,marginBottom:3,background:manualLower===k?gold:card,color:manualLower===k?'#fff':fg,border:'1px solid #ccc',borderRadius:4,cursor:'pointer',fontSize:12}}>
                {t.symbol} {t.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,marginBottom:4,color:'#888'}}>Hào Động</div>
          <div style={{display:'flex',gap:4}}>{LINE_NAMES.map((n,i)=>(
            <button key={i} onClick={()=>setManualMoving(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}
              style={{flex:1,padding:6,background:manualMoving.includes(i)?'#c62828':card,color:manualMoving.includes(i)?'#fff':fg,border:'1px solid #ccc',borderRadius:4,cursor:'pointer',fontSize:11}}>{n}</button>
          ))}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setStep('input');setManualMoving([])}} style={{flex:1,padding:10,background:'#eee',border:'none',borderRadius:6,cursor:'pointer',color:'#333'}}>← Quay lại</button>
          <button onClick={castManual} style={{flex:2,padding:10,background:gold,color:'#fff',border:'none',borderRadius:6,fontWeight:'bold',cursor:'pointer'}}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // ======== STEP: CAST (tap to cast) ========
  if(step==='cast'){
    const doCast=()=>{
      if(method==='giay')castGiay();
      else if(method==='dacbiet')castDacBiet();
      else castCTBT();
    };
    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:480,margin:'0 auto',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:13,color:'#888',marginBottom:4}}>CLICK VÀO HÌNH ĐỂ LẤY QUẺ</div>
        {question&&<div style={{fontSize:12,color:'#999',marginBottom:20}}>Câu hỏi: {name||question}</div>}
        <div onClick={doCast} style={{width:180,height:180,borderRadius:'50%',background:`radial-gradient(circle,${goldBg} 30%,${gold} 100%)`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 4px 30px rgba(139,105,20,.4)',fontSize:48,userSelect:'none',transition:'transform .1s',active:{transform:'scale(.95)'}}}>
          ☯
        </div>
        <button onClick={()=>setStep('input')} style={{marginTop:30,padding:'8px 20px',background:'transparent',border:`1px solid ${gold}`,borderRadius:6,cursor:'pointer',color:gold,fontSize:13}}>← Quay lại</button>
      </div>
    );
  }

  // ======== STEP: RESULT ========
  if(step==='result'&&result?.chinh){
    const c=result.chinh,ho=result.queHo,b=result.bien;
    const bLv=b?result.lineValues.map((v,i)=>result.moving.includes(i)?(v===1?0:1):v):null;
    const hoLv=ho?[result.lineValues[1],result.lineValues[2],result.lineValues[3],result.lineValues[2],result.lineValues[3],result.lineValues[4]]:null;
    const finished=!luanLoading&&(luanResult||chatHistory.length>0);

    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:600,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <button onClick={()=>{setStep('input');setResult(null);setLuanResult('');setChatHistory([])}} style={{background:'none',border:'none',color:gold,fontSize:13,cursor:'pointer'}}>← Back</button>
          <span style={{fontWeight:'bold',color:gold}}>{name||'Sự kiện'}</span>
          <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',fontSize:16,cursor:'pointer'}}>⚙️</button>
        </div>

        {/* Time + question */}
        <div style={{fontSize:12,color:'#888',marginBottom:4}}>
          <span style={{color:gold,fontWeight:'bold'}}>Sự việc và câu hỏi:</span> {result.time}
        </div>
        {question&&<div style={{padding:8,background:card,borderRadius:6,marginBottom:8,fontSize:13,border:`1px solid ${dark?'#444':'#ddd'}`}}>{question}</div>}

        {/* 3 Hexagrams: CHÁNH | HỘ | BIẾN */}
        <div style={{display:'flex',justifyContent:'space-around',alignItems:'flex-start',padding:'16px 8px',marginBottom:8,background:card,borderRadius:10,border:`1px solid ${dark?'#555':'#ccc'}`}}>
          {/* Chánh */}
          <div style={{textAlign:'center',cursor:'pointer'}} onClick={()=>setPopup(c)}>
            {renderHex(result.lineValues,result.moving,70,7)}
            <div style={{marginTop:6,fontWeight:'bold',fontSize:14,color:gold}}>{c[1].split(' ').pop()}</div>
          </div>
          {/* Hộ */}
          {ho&&<div style={{textAlign:'center',cursor:'pointer'}} onClick={()=>setPopup(ho)}>
            {renderHex(hoLv,[],70,7)}
            <div style={{marginTop:6,fontWeight:'bold',fontSize:14,color:gold}}>{ho[1].split(' ').pop()}</div>
          </div>}
          {/* Biến */}
          {b&&<div style={{textAlign:'center',cursor:'pointer'}} onClick={()=>setPopup(b)}>
            {renderHex(bLv,[],70,7)}
            <div style={{marginTop:6,fontWeight:'bold',fontSize:14,color:gold}}>{b[1].split(' ').pop()}</div>
          </div>}
        </div>

        {/* Labels */}
        <div style={{display:'flex',justifyContent:'space-around',marginBottom:12,fontSize:12,fontWeight:'bold',color:'#888'}}>
          <span>CHÁNH</span>{ho&&<span>HỘ</span>}{b&&<span>BIẾN</span>}
        </div>

        {/* Phạm vi */}
        <div style={{marginBottom:8}}>
          <div style={{color:gold,fontSize:13,fontWeight:'bold',marginBottom:4}}>Phạm vi của sự việc:</div>
          <textarea value={phamVi} onChange={e=>setPhamVi(e.target.value)} rows={3} placeholder="Mô tả thêm hoàn cảnh, phạm vi..."
            style={{width:'100%',padding:8,border:`1px solid ${dark?'#555':'#ccc'}`,borderRadius:6,boxSizing:'border-box',fontSize:13,fontFamily:'inherit',resize:'none',background:'transparent',color:fg}}/>
        </div>

        {/* Luận giải */}
        <div style={{marginBottom:12}}>
          <div style={{color:gold,fontSize:13,fontWeight:'bold',marginBottom:4}}>Luận giải:</div>
          <button onClick={luanQue} disabled={luanLoading}
            style={{width:'100%',padding:10,background:goldBg,color:'#fff',border:'none',borderRadius:6,fontWeight:'bold',cursor:'pointer',opacity:luanLoading?.5:1,fontSize:14,marginBottom:8}}>
            🔮 {luanLoading?'Đang luận...':'Luận Giải AI'}
          </button>

          {(luanResult||chatHistory.length>0)&&(
            <div style={{border:`1px solid ${dark?'#444':'#ddd'}`,borderRadius:8,padding:12}}>
              {chatHistory.length===0&&<div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{luanResult}{luanLoading&&<span style={{color:gold}}>▊</span>}</div>}
              {chatHistory.length>0&&chatHistory.map((msg,i)=>(
                <div key={i} style={{marginBottom:10,padding:msg.role==='user'?'8px 12px':0,background:msg.role==='user'?card:'transparent',borderRadius:8,borderLeft:msg.role==='assistant'?'3px solid '+gold:'none',paddingLeft:msg.role==='assistant'?10:12}}>
                  {msg.role==='user'&&i>0&&<div style={{fontSize:11,color:'#999',marginBottom:2}}>Hỏi thêm:</div>}
                  <div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{i===0?'(Đã gửi data quẻ)':msg.content}{luanLoading&&i===chatHistory.length-1&&msg.role==='assistant'&&<span style={{color:gold}}>▊</span>}</div>
                </div>
              ))}
              {finished&&(
                <div style={{display:'flex',gap:4,marginTop:8,borderTop:'1px solid #ddd',paddingTop:8}}>
                  <input type="text" value={followUp} onChange={e=>setFollowUp(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendFollowUp()}}
                    placeholder="Hỏi thêm..." style={{flex:1,padding:8,border:'1px solid #ccc',borderRadius:6,fontSize:14,background:card,color:fg}}/>
                  <button onClick={sendFollowUp} disabled={!followUp.trim()||luanLoading}
                    style={{padding:'8px 12px',background:gold,color:'#fff',border:'none',borderRadius:6,fontWeight:'bold',cursor:'pointer',opacity:!followUp.trim()||luanLoading?.5:1}}>Gửi</button>
                </div>
              )}
            </div>
          )}
        </div>

        {renderSettings()}
        {renderPopup()}
      </div>
    );
  }

  return <div style={{background:bg,color:fg,minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center'}}><button onClick={()=>setStep('input')} style={{padding:'10px 20px',background:gold,color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>← Quay lại</button></div>;
}
