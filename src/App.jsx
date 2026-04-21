import { useState, useRef } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP, getHexagram, getBienQue } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const LINE_NAMES = ['Sơ','Nhị','Tam','Tứ','Ngũ','Thượng'];
const MH_MAP = {1:'111',2:'011',3:'101',4:'001',5:'110',6:'010',7:'100',8:'000'};

// Lunar (compact Hồ Ngọc Đức)
function jdn(d,m,y){let a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;let jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;if(jd<2299161)jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;return jd}
function nmJD(k){let T=k/1236.85,T2=T*T,T3=T2*T,r=Math.PI/180;let J=2415020.75933+29.53058868*k+.0001178*T2-.000000155*T3+.00033*Math.sin((166.56+132.87*T)*r);let M=359.2242+29.10535608*k,Mp=306.0253+385.81691806*k+.0107306*T2,F=21.2964+390.67050646*k-.0016528*T2;let C=(.1734-.000393*T)*Math.sin(M*r)+.0021*Math.sin(2*r*M)-.4068*Math.sin(Mp*r)+.0161*Math.sin(2*r*Mp)+.0104*Math.sin(2*r*F)-.0051*Math.sin(r*(M+Mp))-.0074*Math.sin(r*(M-Mp))+.0004*Math.sin(r*(2*F+M))-.0004*Math.sin(r*(2*F-M))-.0006*Math.sin(r*(2*F+Mp))+.001*Math.sin(r*(2*F-Mp))+.0005*Math.sin(r*(2*Mp+M));let dt=T<-11?.001+.000839*T+.0002261*T2:-.000278+.000265*T+.000262*T2;return J+C-dt}
function sL(jd){let T=(jd-2451545)/36525,r=Math.PI/180,M=357.5291+35999.0503*T,L=(280.46645+36000.76983*T+(1.9146-.004817*T)*Math.sin(r*M)+.019993*Math.sin(2*r*M)+.00029*Math.sin(3*r*M))*r;L-=Math.PI*2*Math.floor(L/(Math.PI*2));return Math.floor(L/Math.PI*6)}
function gLM11(y){let o=jdn(31,12,y)-2415021,k=Math.floor(o/29.530588853),n=nmJD(k);if(sL(n+.29)>=9)n=nmJD(k-1);return Math.floor(n+.5)}
function gLMO(a){let k=Math.floor((a-2415021.076998695)/29.530588853+.5),l=0,i=1,c=sL(nmJD(k+i)+.29);do{l=c;i++;c=sL(nmJD(k+i)+.29)}while(c!==l&&i<14);return i-1}
function s2l(d,m,y){let n=jdn(d,m,y),k=Math.floor((n-2415021.076998695)/29.530588853),s=Math.floor(nmJD(k)+.5);if(s>n)s=Math.floor(nmJD(k-1)+.5);let a=gLM11(y),b=a,ly;if(a>=s){ly=y;a=gLM11(y-1)}else{ly=y+1;b=gLM11(y+1)}let ld=n-s+1,df=Math.floor((s-a)/29),ll=0,lm=df+11;if(b-a>365){let lo=gLMO(a);if(df>=lo){lm=df+10;if(df===lo)ll=1}}if(lm>12)lm-=12;if(lm>=11&&df<4)ly-=1;return{day:ld,month:lm,year:ly}}
function hIdx(h){return h>=23||h<1?0:Math.floor((h-1)/2)+1}

// Quẻ Hộ
function queHo(lv){const lo=[lv[1],lv[2],lv[3]].join(''),up=[lv[2],lv[3],lv[4]].join('');const i=HEXAGRAM_LOOKUP[up+lo];return i!==undefined?HEXAGRAMS[i]:null}

// Mai Hoa core
function mhCalc(upper,lower,total){
  const u=((upper-1)%8)+1,l=((lower-1)%8)+1,mv=((total-1)%6);
  const uB=MH_MAP[u],lB=MH_MAP[l];
  const lv=[...lB.split('').map(Number),...uB.split('').map(Number)];
  const moving=[mv];
  const lines=lv.map((v,i)=>({value:moving.includes(i)?(v===1?9:6):(v===1?7:8)}));
  return{chinh:getHexagram(lv),bien:getBienQue(lv,moving),lines,lineValues:lv,moving};
}

export default function App(){
  const[view,setView]=useState('home'); // home|dacbiet|nhap|result
  const[question,setQuestion]=useState('');
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
  const[showHistory,setShowHistory]=useState(false);
  const[chatHistory,setChatHistory]=useState([]);
  const[followUp,setFollowUp]=useState('');
  const[phamVi,setPhamVi]=useState('');
  const[specialNum,setSpecialNum]=useState('');
  const[manualUpper,setManualUpper]=useState('111');
  const[manualLower,setManualLower]=useState('000');
  const[manualMoving,setManualMoving]=useState([]);

  const toggleDark=()=>{const n=!dark;setDark(n);localStorage.setItem('kd_dark',n?'1':'0')};

  // Colors
  const P=dark?'#c9b06b':'#8b6914';
  const bg=dark?'#0f0f1a':'#faf8f4';
  const fg=dark?'#e8e0d0':'#2c2417';
  const card=dark?'#1a1a2e':'#fff';
  const border=dark?'#333':'#e0d8cc';

  // ======== CASTING ========
  const finish=(r,method)=>{
    const ho=r.lineValues?queHo(r.lineValues):null;
    const now=new Date();
    const lunar=s2l(now.getDate(),now.getMonth()+1,now.getFullYear());
    const full={...r,queHo:ho,method,question,lunar,ts:`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} ${now.getDate()}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`};
    setResult(full);
    const entry={id:Date.now(),...full};
    setHistory(prev=>{const u=[entry,...prev].slice(0,50);localStorage.setItem('kd_history',JSON.stringify(u));return u});
    setLuanResult('');setChatHistory([]);setPhamVi('');
    setView('result');
  };

  const castThoi=()=>{
    const now=new Date();
    const lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear());
    const hi=hIdx(now.getHours())+1;
    const us=lu.year+lu.month+lu.day,ls=us+hi;
    finish({...mhCalc(us,ls,ls)},'Thời');
  };

  const castKhac=()=>{
    const now=new Date();
    const lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear());
    const hi=hIdx(now.getHours())+1;
    const mi=now.getMinutes()+1;
    const us=lu.year+lu.month+lu.day+hi;
    const ls=us+mi;
    finish({...mhCalc(us,ls,ls)},'Khắc');
  };

  const castGiay=()=>{
    const now=new Date();
    const sec=now.getSeconds()+1;
    const lu=s2l(now.getDate(),now.getMonth()+1,now.getFullYear());
    const hi=hIdx(now.getHours())+1;
    const us=lu.year+lu.month+lu.day+hi;
    finish({...mhCalc(us,us+sec,us+sec+now.getMilliseconds())},'Giây');
  };

  const castNgauNhien=()=>{
    const lines=[];
    for(let i=0;i<6;i++){const coins=[0,0,0].map(()=>Math.random()<.5?2:3);lines.push({value:coins.reduce((a,b)=>a+b,0)})}
    const lv=lines.map(l=>(l.value===7||l.value===9)?1:0);
    const moving=lines.map((l,i)=>(l.value===6||l.value===9)?i:-1).filter(i=>i>=0);
    finish({chinh:getHexagram(lv),bien:moving.length>0?getBienQue(lv,moving):null,lines,lineValues:lv,moving},'Ngẫu Nhiên');
  };

  const castDacBiet=()=>{
    const nums=specialNum.replace(/\D/g,'');
    if(!nums){alert('Nhập số');return}
    const total=nums.split('').reduce((a,b)=>a+parseInt(b),0);
    const mid=Math.floor(nums.length/2)||1;
    const u=nums.slice(0,mid).split('').reduce((a,b)=>a+parseInt(b),0)||1;
    const l=nums.slice(mid).split('').reduce((a,b)=>a+parseInt(b),0)||1;
    finish({...mhCalc(u,l,total||1)},'Đặc Biệt');
  };

  const castNhap=()=>{
    const lo=manualLower.split('').map(Number),up=manualUpper.split('').map(Number);
    const lv=[...lo,...up];
    const lines=lv.map((v,i)=>({value:manualMoving.includes(i)?(v===1?9:6):(v===1?7:8)}));
    finish({chinh:getHexagram(lv),bien:manualMoving.length>0?getBienQue(lv,manualMoving):null,lines,lineValues:lv,moving:manualMoving},'Nhập Quẻ');
  };

  // ======== AI ========
  const buildPrompt=()=>{
    if(!result?.chinh)return'';
    const c=result.chinh,uT=TRIGRAMS[c[3]],lT=TRIGRAMS[c[4]];
    let p=`# Gieo Quẻ Kinh Dịch\n`;
    if(question)p+=`**Câu hỏi:** ${question}\n`;
    if(phamVi)p+=`**Phạm vi:** ${phamVi}\n`;
    p+=`**Phương pháp:** ${result.method} • ${result.ts}\n`;
    if(result.lunar)p+=`**Âm lịch:** ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}\n`;
    p+=`\n## Quẻ Chánh: ${c[1]} (${c[2]})\n- Thượng: ${uT.name} ${uT.symbol} (${uT.nature}, ${uT.element})\n- Hạ: ${lT.name} ${lT.symbol} (${lT.nature}, ${lT.element})\n- Nghĩa: ${c[5]}\n`;
    if(result.moving?.length>0){
      const mv0=result.moving[0];
      const isUp=mv0>=3;
      p+=`- **Thể**: ${isUp?lT.name:uT.name} (${isUp?lT.element:uT.element})\n- **Dụng**: ${isUp?uT.name:lT.name} (${isUp?uT.element:lT.element})\n`;
    }
    p+=`\n## 6 Hào:\n`;
    result.lines.forEach((l,i)=>{
      const isM=result.moving.includes(i);
      const lb=l.value===9?'Lão Dương(động)':l.value===6?'Lão Âm(động)':l.value===7?'Thiếu Dương':'Thiếu Âm';
      p+=`- ${LINE_NAMES[i]}: ${lb}${isM?' ★ĐỘNG':''}\n`;
    });
    if(result.queHo){const h=result.queHo;p+=`\n## Quẻ Hộ: ${h[1]} — ${h[5]}\n`}
    if(result.bien){const b=result.bien;p+=`\n## Quẻ Biến: ${b[1]} — ${b[5]}\n`}
    p+=`\n---\nLuận giải${question?' cho câu hỏi':''}. Phân tích Thể/Dụng, Quẻ Hộ (nội tình), Quẻ Biến (kết quả). Lời khuyên cụ thể.`;
    return p;
  };

  const callAI=async(msgs,onStream)=>{
    const res=await fetch('/api/luan-giai',{method:'POST',headers:{'Content-Type':'application/json','x-kb-secret':kbSecret,'x-user':userName||'anon'},body:JSON.stringify({model:aiModel,max_tokens:4096,system:SYSTEM_PROMPT,messages:msgs})});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'API error')}
    const reader=res.body.getReader(),dec=new TextDecoder();let full='',buf='';
    while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop()||'';
    for(const l of ls){if(!l.startsWith('data: '))continue;try{const o=JSON.parse(l.slice(6));if(o.type==='content_block_delta'&&o.delta?.text){full+=o.delta.text;onStream?.(full)}}catch{}}}return full;
  };

  const luanQue=async()=>{
    if(!kbSecret){setShowSettings(true);return}
    setLuanResult('');setLuanLoading(true);setChatHistory([]);
    try{const p=buildPrompt();const t=await callAI([{role:'user',content:p}],setLuanResult);setChatHistory([{role:'user',content:p},{role:'assistant',content:t}])}
    catch(e){setLuanResult('❌ '+e.message)}finally{setLuanLoading(false)}
  };

  const sendFU=async()=>{
    if(!followUp.trim()||luanLoading)return;
    const m={role:'user',content:followUp},h=[...chatHistory,m];setChatHistory(h);setFollowUp('');setLuanLoading(true);
    try{const t=await callAI(h,p=>setChatHistory([...h,{role:'assistant',content:p}]));setChatHistory([...h,{role:'assistant',content:t}])}
    catch(e){setChatHistory([...h,{role:'assistant',content:'❌ '+e.message}])}finally{setLuanLoading(false)}
  };

  // ======== RENDER HEX ========
  const RHex=({lv,moving=[],w=70,h=7})=>(
    <div style={{display:'flex',flexDirection:'column-reverse',alignItems:'center',gap:3}}>
      {lv.map((v,i)=>{
        const isM=moving.includes(i);
        const c=isM?'#c62828':fg;
        return <div key={i}>{v===1
          ?<div style={{width:w,height:h,background:c,borderRadius:2}}/>
          :<div style={{display:'flex',gap:w*.12}}><div style={{width:w*.42,height:h,background:c,borderRadius:2}}/><div style={{width:w*.42,height:h,background:c,borderRadius:2}}/></div>
        }</div>;
      })}
    </div>
  );

  // ======== POPUP ========
  const Popup=()=>popup&&(
    <div onClick={()=>setPopup(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,maxWidth:380,width:'100%',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{background:`linear-gradient(135deg, ${P}, #d4a017)`,padding:'20px 24px',textAlign:'center'}}>
          <div style={{fontSize:26,fontWeight:'bold',color:'#fff',letterSpacing:1}}>{popup[1]}</div>
          <div style={{fontSize:32,marginTop:4,color:'rgba(255,255,255,.8)',fontFamily:'serif'}}>{popup[2]}</div>
        </div>
        <div style={{padding:'20px 24px'}}>
          <div style={{fontSize:14,lineHeight:1.7,color:'#333',marginBottom:12}}>{popup[5]}</div>
          <div style={{fontSize:12,color:'#888',borderTop:'1px solid #eee',paddingTop:8}}>
            Thượng: {TRIGRAMS[popup[3]]?.name} ({TRIGRAMS[popup[3]]?.nature}) • Hạ: {TRIGRAMS[popup[4]]?.name} ({TRIGRAMS[popup[4]]?.nature})
          </div>
        </div>
        <button onClick={()=>setPopup(null)} style={{width:'100%',padding:14,background:P,color:'#fff',border:'none',fontSize:16,fontWeight:'bold',cursor:'pointer'}}>OK</button>
      </div>
    </div>
  );

  // ======== SETTINGS ========
  const Settings=()=>showSettings&&(
    <div onClick={()=>setShowSettings(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:card,borderRadius:16,padding:20,maxWidth:400,width:'100%',color:fg}}>
        <h3 style={{margin:'0 0 16px',color:P,fontSize:18}}>Cài Đặt</h3>
        {[['👤 Tên',userName,v=>{setUserName(v);localStorage.setItem('kd_username',v)},'text','Tên...'],
          ['🔑 Secret',kbSecret,v=>{setKbSecret(v);localStorage.setItem('kd_kb_secret',v)},'password','Mật khẩu nhóm...']
        ].map(([l,val,fn,t,ph])=>(
          <div key={l} style={{marginBottom:12}}>
            <label style={{fontSize:12,display:'block',marginBottom:4,color:P}}>{l}</label>
            <input type={t} value={val} onChange={e=>fn(e.target.value)} placeholder={ph}
              style={{width:'100%',padding:10,border:`1px solid ${border}`,borderRadius:8,boxSizing:'border-box',fontSize:14,background:bg,color:fg}}/>
          </div>
        ))}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,display:'block',marginBottom:4}}>Model</label>
          <select value={aiModel} onChange={e=>{setAiModel(e.target.value);localStorage.setItem('kd_model',e.target.value)}}
            style={{width:'100%',padding:10,border:`1px solid ${border}`,borderRadius:8,fontSize:14,background:bg,color:fg}}>
            <option value="claude-sonnet-4-20250514">Sonnet 4</option><option value="claude-opus-4-20250514">Opus 4</option>
          </select>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontSize:13}}>Dark Mode</span>
          <button onClick={toggleDark} style={{padding:'6px 16px',border:`1px solid ${border}`,borderRadius:6,background:dark?'#333':'#f0f0f0',color:dark?'#fff':'#333',cursor:'pointer'}}>{dark?'🌙':'☀️'}</button>
        </div>
        <button onClick={()=>setShowSettings(false)} style={{width:'100%',padding:10,background:P,color:'#fff',border:'none',borderRadius:8,fontWeight:'bold',cursor:'pointer'}}>Đóng</button>
      </div>
    </div>
  );

  // ======== HOME ========
  if(view==='home'){
    const grid=[
      ['🕐','THỜI','Gieo theo thời','#c0392b',castThoi],
      ['⏱️','KHẮC','Gieo theo khắc','#d35400',castKhac],
      ['⏲️','GIÂY','Bấm lấy giây','#f39c12',castGiay],
      ['⚡','NGẪU NHIÊN','Tung 3 xu 6 lần','#27ae60',castNgauNhien],
      ['✏️','NHẬP QUẺ','Chọn quái thủ công','#8e44ad',()=>setView('nhap')],
      ['🔢','ĐẶC BIỆT','Nhập số tính quẻ','#2980b9',()=>setView('dacbiet')],
    ];
    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif"}}>
        <div style={{maxWidth:480,margin:'0 auto',padding:16}}>
          {/* Header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <button onClick={()=>setShowHistory(true)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',padding:4}}>📜</button>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:'bold',color:P,letterSpacing:2}}>KINH DỊCH</div>
              <div style={{fontSize:11,color:P,opacity:.6}}>Gieo Quẻ & AI Luận Giải</div>
            </div>
            <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',padding:4}}>⚙️</button>
          </div>

          {/* Question */}
          <div style={{marginBottom:16}}>
            <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={2} placeholder="Câu hỏi (tùy chọn)..."
              style={{width:'100%',padding:12,border:`1px solid ${border}`,borderRadius:12,boxSizing:'border-box',fontSize:14,fontFamily:'inherit',resize:'none',background:card,color:fg}}/>
          </div>

          {/* Grid 3x2 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
            {grid.slice(0,3).map(([icon,label,desc,clr,fn])=>(
              <button key={label} onClick={fn}
                style={{padding:'24px 8px',background:clr,color:'#fff',border:'none',borderRadius:14,cursor:'pointer',textAlign:'center',boxShadow:`0 4px 15px ${clr}40`,transition:'transform .1s'}}>
                <div style={{fontSize:32}}>{icon}</div>
                <div style={{fontSize:13,fontWeight:'bold',marginTop:6}}>{label}</div>
              </button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            {grid.slice(3,5).map(([icon,label,desc,clr,fn])=>(
              <button key={label} onClick={fn}
                style={{padding:'18px 8px',background:clr,color:'#fff',border:'none',borderRadius:14,cursor:'pointer',textAlign:'center',boxShadow:`0 4px 15px ${clr}40`}}>
                <div style={{fontSize:28}}>{icon}</div>
                <div style={{fontSize:12,fontWeight:'bold',marginTop:4}}>{label}</div>
                <div style={{fontSize:10,opacity:.8,marginTop:2}}>{desc}</div>
              </button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr'}}>
            {grid.slice(5).map(([icon,label,desc,clr,fn])=>(
              <button key={label} onClick={fn}
                style={{padding:'16px',background:clr,color:'#fff',border:'none',borderRadius:14,cursor:'pointer',textAlign:'center',boxShadow:`0 4px 15px ${clr}40`,display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
                <span style={{fontSize:28}}>{icon}</span>
                <div style={{textAlign:'left'}}><div style={{fontSize:13,fontWeight:'bold'}}>{label}</div><div style={{fontSize:10,opacity:.8}}>{desc}</div></div>
              </button>
            ))}
          </div>
        </div>

        {/* History */}
        {showHistory&&(
          <div onClick={()=>setShowHistory(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
            <div onClick={e=>e.stopPropagation()} style={{background:card,borderRadius:16,padding:16,maxWidth:500,width:'100%',maxHeight:'80vh',color:fg}}>
              <h3 style={{margin:'0 0 12px',color:P}}>📜 Lịch Sử</h3>
              <div style={{maxHeight:'60vh',overflowY:'auto'}}>
                {history.length===0&&<div style={{textAlign:'center',padding:20,color:'#999'}}>Chưa có</div>}
                {history.map(h=>(
                  <div key={h.id} onClick={()=>{setResult(h);setView('result');setShowHistory(false);setLuanResult('');setChatHistory([])}}
                    style={{padding:12,marginBottom:6,border:`1px solid ${border}`,borderRadius:10,cursor:'pointer',background:bg}}>
                    <div style={{fontWeight:'bold',color:P,fontSize:14}}>{h.chinh?h.chinh[1]:'?'}{h.queHo?' → '+h.queHo[1]:''}{h.bien?' → '+h.bien[1]:''}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>{h.method||''} • {h.question||'—'} • {h.ts}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowHistory(false)} style={{width:'100%',marginTop:10,padding:10,background:P,color:'#fff',border:'none',borderRadius:8,fontWeight:'bold',cursor:'pointer'}}>Đóng</button>
            </div>
          </div>
        )}
        <Settings/><Popup/>
      </div>
    );
  }

  // ======== ĐẶC BIỆT ========
  if(view==='dacbiet'){
    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:20,maxWidth:480,margin:'0 auto',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center'}}>
        <div style={{fontSize:48,marginBottom:16}}>🔢</div>
        <h2 style={{color:'#2980b9',marginBottom:8}}>Quẻ Đặc Biệt</h2>
        <p style={{fontSize:13,color:'#888',textAlign:'center',marginBottom:20}}>Nhập dãy số ngẫu nhiên bất kỳ</p>
        <input type="text" inputMode="numeric" value={specialNum} onChange={e=>setSpecialNum(e.target.value)} placeholder="VD: 394728"
          style={{width:'100%',maxWidth:300,padding:16,border:`2px solid #2980b9`,borderRadius:12,fontSize:24,textAlign:'center',background:card,color:fg,boxSizing:'border-box',marginBottom:20}}/>
        <div style={{display:'flex',gap:10,width:'100%',maxWidth:300}}>
          <button onClick={()=>{setView('home');setSpecialNum('')}} style={{flex:1,padding:12,background:'#eee',border:'none',borderRadius:10,cursor:'pointer',color:'#666',fontWeight:'bold'}}>← Quay lại</button>
          <button onClick={castDacBiet} style={{flex:2,padding:12,background:'#2980b9',color:'#fff',border:'none',borderRadius:10,fontWeight:'bold',cursor:'pointer',fontSize:16}}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // ======== NHẬP QUẺ ========
  if(view==='nhap'){
    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:480,margin:'0 auto'}}>
        <h3 style={{color:'#8e44ad',marginBottom:12,textAlign:'center'}}>✏️ Nhập Quẻ</h3>
        <div style={{display:'flex',gap:10,marginBottom:12}}>
          {[['Thượng Quái',manualUpper,setManualUpper],['Hạ Quái',manualLower,setManualLower]].map(([label,val,fn])=>(
            <div key={label} style={{flex:1}}>
              <div style={{fontSize:12,marginBottom:6,color:'#888',textAlign:'center'}}>{label}</div>
              {Object.entries(TRIGRAMS).map(([k,t])=>(
                <button key={k} onClick={()=>fn(k)}
                  style={{width:'100%',padding:7,marginBottom:3,background:val===k?'#8e44ad':card,color:val===k?'#fff':fg,border:`1px solid ${border}`,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:val===k?'bold':'normal'}}>
                  {t.symbol} {t.name}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,marginBottom:6,color:'#888',textAlign:'center'}}>Hào Động</div>
          <div style={{display:'flex',gap:4,justifyContent:'center'}}>
            {LINE_NAMES.map((n,i)=>(
              <button key={i} onClick={()=>setManualMoving(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}
                style={{padding:'8px 12px',background:manualMoving.includes(i)?'#c62828':card,color:manualMoving.includes(i)?'#fff':fg,border:`1px solid ${border}`,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:'bold'}}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>{setView('home');setManualMoving([])}} style={{flex:1,padding:12,background:'#eee',border:'none',borderRadius:10,cursor:'pointer',color:'#666',fontWeight:'bold'}}>← Quay lại</button>
          <button onClick={castNhap} style={{flex:2,padding:12,background:'#8e44ad',color:'#fff',border:'none',borderRadius:10,fontWeight:'bold',cursor:'pointer',fontSize:16}}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // ======== RESULT ========
  if(view==='result'&&result?.chinh){
    const c=result.chinh,ho=result.queHo,b=result.bien;
    const bLv=b?result.lineValues.map((v,i)=>result.moving.includes(i)?(v===1?0:1):v):null;
    const hoLv=ho?[result.lineValues[1],result.lineValues[2],result.lineValues[3],result.lineValues[2],result.lineValues[3],result.lineValues[4]]:null;
    const done=!luanLoading&&(luanResult||chatHistory.length>0);
    const shortName=(n)=>n.split(' ').pop();

    return(
      <div style={{background:bg,color:fg,minHeight:'100dvh',fontFamily:"'Noto Sans',system-ui,sans-serif",padding:16,maxWidth:600,margin:'0 auto'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <button onClick={()=>{setView('home');setResult(null);setLuanResult('');setChatHistory([])}} style={{background:'none',border:'none',color:P,fontSize:13,cursor:'pointer',fontWeight:'bold'}}>← Quay lại</button>
          <span style={{fontSize:12,color:'#888'}}>{result.method} • {result.ts}</span>
          <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',fontSize:16,cursor:'pointer'}}>⚙️</button>
        </div>

        {/* Question */}
        {question&&<div style={{padding:10,background:card,borderRadius:10,marginBottom:10,fontSize:13,border:`1px solid ${border}`}}>
          <span style={{color:P,fontWeight:'bold'}}>Câu hỏi: </span>{question}
        </div>}
        {result.lunar&&<div style={{fontSize:11,color:'#888',textAlign:'center',marginBottom:8}}>ÂL: {result.lunar.day}/{result.lunar.month}/{result.lunar.year}</div>}

        {/* 3 Hexagrams */}
        <div style={{display:'flex',justifyContent:'space-evenly',alignItems:'flex-start',padding:'20px 8px',marginBottom:4,background:card,borderRadius:14,border:`1px solid ${border}`}}>
          {[{hex:c,lv:result.lineValues,mv:result.moving,label:'Chánh'},
            ho&&{hex:ho,lv:hoLv,mv:[],label:'Hộ'},
            b&&{hex:b,lv:bLv,mv:[],label:'Biến'}
          ].filter(Boolean).map(({hex,lv,mv,label})=>(
            <div key={label} style={{textAlign:'center',cursor:'pointer',flex:1}} onClick={()=>setPopup(hex)}>
              <div style={{fontSize:11,color:'#999',marginBottom:6,fontWeight:'bold',letterSpacing:1}}>{label}</div>
              <RHex lv={lv} moving={mv}/>
              <div style={{marginTop:8,fontSize:14,fontWeight:'bold',color:P}}>{shortName(hex[1])}</div>
            </div>
          ))}
        </div>

        {/* Hào details */}
        <details style={{marginBottom:10}}>
          <summary style={{fontSize:12,color:'#888',cursor:'pointer',padding:'6px 0'}}>Chi tiết 6 hào</summary>
          <div style={{padding:10,background:card,borderRadius:8,border:`1px solid ${border}`,fontSize:12}}>
            {[...result.lines].reverse().map((l,ri)=>{
              const i=5-ri;const isM=result.moving.includes(i);
              return <div key={i} style={{padding:'3px 0',color:isM?'#c62828':fg}}>{LINE_NAMES[i]}: {l.value===9?'Lão Dương ★':l.value===6?'Lão Âm ★':l.value===7?'Thiếu Dương':'Thiếu Âm'}</div>;
            })}
          </div>
        </details>

        {/* Phạm vi */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:12,color:P,fontWeight:'bold',marginBottom:4}}>Phạm vi sự việc:</div>
          <textarea value={phamVi} onChange={e=>setPhamVi(e.target.value)} rows={2} placeholder="Mô tả thêm hoàn cảnh..."
            style={{width:'100%',padding:10,border:`1px solid ${border}`,borderRadius:10,boxSizing:'border-box',fontSize:13,fontFamily:'inherit',resize:'none',background:card,color:fg}}/>
        </div>

        {/* AI */}
        <button onClick={luanQue} disabled={luanLoading}
          style={{width:'100%',padding:12,background:`linear-gradient(135deg, ${P}, #d4a017)`,color:'#fff',border:'none',borderRadius:10,fontWeight:'bold',cursor:'pointer',opacity:luanLoading?.5:1,fontSize:15,marginBottom:10,boxShadow:`0 4px 15px ${P}40`}}>
          🔮 {luanLoading?'Đang luận...':'Luận Giải AI'}
        </button>

        {(luanResult||chatHistory.length>0)&&(
          <div style={{border:`1px solid ${border}`,borderRadius:12,padding:14,marginBottom:12,background:card}}>
            {chatHistory.length===0&&<div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{luanResult}{luanLoading&&<span style={{color:P}}>▊</span>}</div>}
            {chatHistory.length>0&&chatHistory.map((msg,i)=>(
              <div key={i} style={{marginBottom:10,padding:msg.role==='user'?'10px 14px':0,background:msg.role==='user'?bg:'transparent',borderRadius:10,borderLeft:msg.role==='assistant'?`3px solid ${P}`:'none',paddingLeft:msg.role==='assistant'?12:14}}>
                {msg.role==='user'&&i>0&&<div style={{fontSize:11,color:'#999',marginBottom:2}}>Hỏi thêm:</div>}
                <div style={{fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{i===0?'(Đã gửi data)':msg.content}{luanLoading&&i===chatHistory.length-1&&msg.role==='assistant'&&<span style={{color:P}}>▊</span>}</div>
              </div>
            ))}
            {done&&(
              <div style={{display:'flex',gap:6,marginTop:10,borderTop:`1px solid ${border}`,paddingTop:10}}>
                <input type="text" value={followUp} onChange={e=>setFollowUp(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendFU()}}
                  placeholder="Hỏi thêm..." style={{flex:1,padding:10,border:`1px solid ${border}`,borderRadius:8,fontSize:14,background:bg,color:fg}}/>
                <button onClick={sendFU} disabled={!followUp.trim()||luanLoading}
                  style={{padding:'10px 16px',background:P,color:'#fff',border:'none',borderRadius:8,fontWeight:'bold',cursor:'pointer',opacity:!followUp.trim()||luanLoading?.5:1}}>Gửi</button>
              </div>
            )}
          </div>
        )}
        <Settings/><Popup/>
      </div>
    );
  }

  return <div style={{background:bg,color:fg,minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center'}}>
    <button onClick={()=>setView('home')} style={{padding:'12px 24px',background:P,color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontWeight:'bold'}}>← Quay lại</button>
  </div>;
}
