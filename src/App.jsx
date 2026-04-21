import { useState, useMemo, useEffect, useRef } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP, getHexagram, getBienQue } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const LINE_NAMES = ['Sơ (1)','Nhị (2)','Tam (3)','Tứ (4)','Ngũ (5)','Thượng (6)'];

// Mai Hoa trigram number → binary (1=Càn...8=Khôn)
const MH_MAP = {1:'111',2:'011',3:'101',4:'001',5:'110',6:'010',7:'100',8:'000'};
const MH_NAMES = {1:'Càn',2:'Đoài',3:'Ly',4:'Chấn',5:'Tốn',6:'Khảm',7:'Cấn',8:'Khôn'};

// ======== LUNAR CALENDAR (simplified from Hồ Ngọc Đức) ========
function jdn(d,m,y){let a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3,jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;if(jd<2299161)jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;return jd}
function newMoonJD(k){let T=k/1236.85,T2=T*T,T3=T2*T,dr=Math.PI/180;let Jd1=2415020.75933+29.53058868*k+.0001178*T2-.000000155*T3;Jd1+=.00033*Math.sin((166.56+132.87*T-.009173*T2)*dr);let M=359.2242+29.10535608*k-.0000333*T2-.00000347*T3;let Mpr=306.0253+385.81691806*k+.0107306*T2+.00001236*T3;let F=21.2964+390.67050646*k-.0016528*T2-.00000239*T3;let C1=(.1734-.000393*T)*Math.sin(M*dr)+.0021*Math.sin(2*dr*M);C1-=.4068*Math.sin(Mpr*dr)+.0161*Math.sin(dr*2*Mpr)-.0004*Math.sin(dr*3*Mpr);C1+=.0104*Math.sin(dr*2*F)-.0051*Math.sin(dr*(M+Mpr));C1-=.0074*Math.sin(dr*(M-Mpr))+.0004*Math.sin(dr*(2*F+M));C1-=.0004*Math.sin(dr*(2*F-M))-.0006*Math.sin(dr*(2*F+Mpr));C1+=.001*Math.sin(dr*(2*F-Mpr))+.0005*Math.sin(dr*(2*Mpr+M));let dt;if(T<-11)dt=.001+.000839*T+.0002261*T2-.00000845*T3-.000000081*T*T3;else dt=-.000278+.000265*T+.000262*T2;return Jd1+C1-dt}
function sunLongitude(jd){let T=(jd-2451545)/36525,T2=T*T,dr=Math.PI/180;let M=357.5291+35999.0503*T-.0001559*T2-.00000048*T*T2;let L0=280.46645+36000.76983*T+.0003032*T2;let DL=(1.9146-.004817*T-.000014*T2)*Math.sin(dr*M);DL+=(.019993-.000101*T)*Math.sin(dr*2*M)+.00029*Math.sin(dr*3*M);let L=(L0+DL)*dr;L=L-Math.PI*2*Math.floor(L/(Math.PI*2));return Math.floor(L/Math.PI*6)}
function getLunarMonth11(yy){let off=jdn(31,12,yy)-2415021,k=Math.floor(off/29.530588853),nm=newMoonJD(k);if(sunLongitude(nm+7/24)>=9)nm=newMoonJD(k-1);return Math.floor(nm+.5)}
function getLeapMonthOffset(a11){let k=Math.floor((a11-2415021.076998695)/29.530588853+.5),last=0,i=1,arc=sunLongitude(newMoonJD(k+i)+7/24);do{last=arc;i++;arc=sunLongitude(newMoonJD(k+i)+7/24)}while(arc!==last&&i<14);return i-1}
function solar2lunar(dd,mm,yy){let dn=jdn(dd,mm,yy),k=Math.floor((dn-2415021.076998695)/29.530588853),ms=Math.floor(newMoonJD(k)+.5);if(ms>dn)ms=Math.floor(newMoonJD(k-1)+.5);let a11=getLunarMonth11(yy),b11=a11,ly;if(a11>=ms){ly=yy;a11=getLunarMonth11(yy-1)}else{ly=yy+1;b11=getLunarMonth11(yy+1)}let ld=dn-ms+1,df=Math.floor((ms-a11)/29),ll=0,lm=df+11;if(b11-a11>365){let lo=getLeapMonthOffset(a11);if(df>=lo){lm=df+10;if(df===lo)ll=1}}if(lm>12)lm-=12;if(lm>=11&&df<4)ly-=1;return{day:ld,month:lm,year:ly,leap:ll}}

const CHI = ['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];
const CAN = ['Giáp','Ất','Bính','Đinh','Mậu','Kỷ','Canh','Tân','Nhâm','Quý'];
function hourIndex(h){if(h>=23||h<1)return 0;return Math.floor((h-1)/2)+1}

// ======== QUẺ HỘ ========
function getQueHo(lineValues) {
  // Hạ quái Hộ = hào 2,3,4 (index 1,2,3)
  // Thượng quái Hộ = hào 3,4,5 (index 2,3,4)
  const hoLower = [lineValues[1], lineValues[2], lineValues[3]].join('');
  const hoUpper = [lineValues[2], lineValues[3], lineValues[4]].join('');
  const idx = HEXAGRAM_LOOKUP[hoUpper + hoLower];
  return idx !== undefined ? HEXAGRAMS[idx] : null;
}

// ======== MAI HOA DỊCH SỐ ========
function maiHoaFromNumbers(upper, lower, total) {
  const uNum = ((upper - 1) % 8) + 1;
  const lNum = ((lower - 1) % 8) + 1;
  const movingLine = ((total - 1) % 6) + 1; // 1-6
  const uBin = MH_MAP[uNum];
  const lBin = MH_MAP[lNum];
  const lineValues = [...lBin.split('').map(Number), ...uBin.split('').map(Number)];
  const moving = [movingLine - 1]; // 0-indexed
  const chinh = getHexagram(lineValues);
  const bien = getBienQue(lineValues, moving);
  const lines = lineValues.map((v, i) => ({ value: moving.includes(i) ? (v === 1 ? 9 : 6) : (v === 1 ? 7 : 8) }));
  return { chinh, bien, lines, lineValues, moving, uNum, lNum, movingLine };
}

function maiHoaFromTime(h, m, solarDay, solarMonth, solarYear) {
  const lunar = solar2lunar(solarDay, solarMonth, solarYear);
  const hIdx = hourIndex(h) + 1; // 1-12
  const upperSum = lunar.year + lunar.month + lunar.day;
  const lowerSum = upperSum + hIdx;
  return { ...maiHoaFromNumbers(upperSum, lowerSum, lowerSum), lunar, hIdx, method: 'time' };
}

export default function KinhDichApp() {
  const [mode, setMode] = useState(null);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('kd_dark') === '1');
  const [kbSecret, setKbSecret] = useState(() => localStorage.getItem('kd_kb_secret') || '');
  const [userName, setUserName] = useState(() => localStorage.getItem('kd_username') || '');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('kd_model') || 'claude-sonnet-4-20250514');
  const [luanResult, setLuanResult] = useState('');
  const [luanLoading, setLuanLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('kd_history') || '[]') } catch { return [] } });
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [followUp, setFollowUp] = useState('');

  // Manual mode
  const [manualUpper, setManualUpper] = useState('111');
  const [manualLower, setManualLower] = useState('000');
  const [manualMoving, setManualMoving] = useState([]);

  // Đặc Biệt mode
  const [specialNum, setSpecialNum] = useState('');

  const toggleDark = () => { const n = !dark; setDark(n); localStorage.setItem('kd_dark', n ? '1' : '0') };

  // ======== CASTING METHODS ========
  const finishResult = (r) => {
    const queHo = r.lineValues ? getQueHo(r.lineValues) : null;
    const full = { ...r, queHo, question, ts: new Date().toLocaleString('vi-VN') };
    setResult(full);
    saveHistory(full);
    setLuanResult('');
    setChatHistory([]);
  };

  // 1. Coins
  const castCoins = () => {
    const newLines = [];
    for (let i = 0; i < 6; i++) {
      const coins = [0, 0, 0].map(() => Math.random() < 0.5 ? 2 : 3);
      newLines.push({ value: coins.reduce((a, b) => a + b, 0) });
    }
    const lineValues = newLines.map(l => (l.value === 7 || l.value === 9) ? 1 : 0);
    const moving = newLines.map((l, i) => (l.value === 6 || l.value === 9) ? i : -1).filter(i => i >= 0);
    finishResult({ chinh: getHexagram(lineValues), bien: moving.length > 0 ? getBienQue(lineValues, moving) : null, lines: newLines, lineValues, moving, method: 'coins' });
  };

  // 2. Yarrow
  const castYarrow = () => {
    const yarrowLine = () => { const r = Math.random(); if (r < 1/16) return 6; if (r < 6/16) return 7; if (r < 13/16) return 8; return 9; };
    const newLines = []; for (let i = 0; i < 6; i++) newLines.push({ value: yarrowLine() });
    const lineValues = newLines.map(l => (l.value === 7 || l.value === 9) ? 1 : 0);
    const moving = newLines.map((l, i) => (l.value === 6 || l.value === 9) ? i : -1).filter(i => i >= 0);
    finishResult({ chinh: getHexagram(lineValues), bien: moving.length > 0 ? getBienQue(lineValues, moving) : null, lines: newLines, lineValues, moving, method: 'yarrow' });
  };

  // 3. Manual
  const castManual = () => {
    const lower = manualLower.split('').map(Number);
    const upper = manualUpper.split('').map(Number);
    const lineValues = [...lower, ...upper];
    const newLines = lineValues.map((v, i) => ({ value: manualMoving.includes(i) ? (v === 1 ? 9 : 6) : (v === 1 ? 7 : 8) }));
    finishResult({ chinh: getHexagram(lineValues), bien: manualMoving.length > 0 ? getBienQue(lineValues, manualMoving) : null, lines: newLines, lineValues, moving: manualMoving, method: 'manual' });
  };

  // 4. Thời (Mai Hoa - current time)
  const castThoi = () => {
    const now = new Date();
    const r = maiHoaFromTime(now.getHours(), now.getMinutes(), now.getDate(), now.getMonth() + 1, now.getFullYear());
    finishResult({ ...r, method: 'thoi', castTime: now.toLocaleString('vi-VN') });
  };

  // 5. Khắc (Mai Hoa - specific time input)
  const [khacDate, setKhacDate] = useState(() => { const d = new Date(); return d.toISOString().slice(0, 16); });
  const castKhac = () => {
    const d = new Date(khacDate);
    const r = maiHoaFromTime(d.getHours(), d.getMinutes(), d.getDate(), d.getMonth() + 1, d.getFullYear());
    finishResult({ ...r, method: 'khac', castTime: d.toLocaleString('vi-VN') });
  };

  // 6. Giây (seconds as seed)
  const castGiay = () => {
    const now = new Date();
    const sec = now.getSeconds() + 1; // 1-60
    const ms = now.getMilliseconds();
    const total = sec * 1000 + ms;
    const upper = sec;
    const lower = sec + (now.getMinutes() + 1);
    const r = maiHoaFromNumbers(upper, lower, total);
    finishResult({ ...r, method: 'giay', castTime: now.toLocaleString('vi-VN'), seconds: sec });
  };

  // 7. Đặc Biệt (user input numbers)
  const castDacBiet = () => {
    const nums = specialNum.replace(/[^\d]/g, '');
    if (nums.length < 1) { alert('Nhập ít nhất 1 số'); return; }
    const total = nums.split('').reduce((a, b) => a + parseInt(b), 0);
    const mid = Math.floor(nums.length / 2);
    const upper = nums.slice(0, mid || 1).split('').reduce((a, b) => a + parseInt(b), 0);
    const lower = nums.slice(mid || 1).split('').reduce((a, b) => a + parseInt(b), 0);
    const r = maiHoaFromNumbers(upper || 1, lower || 1, total || 1);
    finishResult({ ...r, method: 'dacbiet', inputNums: specialNum });
  };

  // ======== HISTORY ========
  const saveHistory = (r) => {
    const entry = { id: Date.now(), ...r };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('kd_history', JSON.stringify(updated));
  };

  // ======== AI LUẬN ========
  const buildPrompt = () => {
    if (!result || !result.chinh) return '';
    const c = result.chinh;
    const upperT = TRIGRAMS[c[3]], lowerT = TRIGRAMS[c[4]];
    let prompt = `# Gieo Quẻ Kinh Dịch\n`;
    if (question) prompt += `**Câu hỏi:** ${question}\n\n`;
    if (result.method) prompt += `**Phương pháp:** ${({coins:'3 Đồng Xu',yarrow:'Cỏ Thi',manual:'Nhập Trực Tiếp',thoi:'Mai Hoa Thời',khac:'Mai Hoa Khắc',giay:'Giây',dacbiet:'Đặc Biệt'})[result.method]||result.method}\n`;
    if (result.castTime) prompt += `**Thời điểm:** ${result.castTime}\n`;
    if (result.lunar) prompt += `**Âm lịch:** ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}\n`;
    prompt += `\n## Quẻ Chính: ${c[1]} (${c[2]})\n`;
    prompt += `- Thượng quái: ${upperT.name} ${upperT.symbol} (${upperT.nature}, ${upperT.element})\n`;
    prompt += `- Hạ quái: ${lowerT.name} ${lowerT.symbol} (${lowerT.nature}, ${lowerT.element})\n`;
    prompt += `- Ý nghĩa: ${c[5]}\n\n`;
    prompt += `## 6 Hào (dưới lên):\n`;
    result.lines.forEach((l, i) => {
      const isM = result.moving.includes(i);
      const label = l.value === 9 ? 'Lão Dương ⚊→⚋ (động)' : l.value === 6 ? 'Lão Âm ⚋→⚊ (động)' : l.value === 7 ? 'Thiếu Dương ⚊' : 'Thiếu Âm ⚋';
      prompt += `- Hào ${LINE_NAMES[i]}: ${label}${isM ? ' ★ĐỘNG' : ''}\n`;
    });
    if (result.queHo) {
      const h = result.queHo;
      prompt += `\n## Quẻ Hộ: ${h[1]} (${h[2]})\n- Ý nghĩa: ${h[5]}\n`;
    }
    if (result.bien) {
      const b = result.bien;
      prompt += `\n## Quẻ Biến: ${b[1]} (${b[2]})\n- Ý nghĩa: ${b[5]}\n`;
    }
    prompt += `\n---\nHãy luận giải quẻ này${question ? ' cho câu hỏi trên' : ''}. Phân tích: quẻ chính (thể/dụng, ngũ hành), hào động, quẻ hộ (nội tình bên trong), quẻ biến (kết quả tương lai), lời khuyên cụ thể.`;
    return prompt;
  };

  const callAI = async (messages, onStream) => {
    const res = await fetch('/api/luan-giai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kb-secret': kbSecret, 'x-user': userName || 'anonymous' },
      body: JSON.stringify({ model: aiModel, max_tokens: 4096, system: SYSTEM_PROMPT, messages })
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'API error ' + res.status); }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = '', buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const ls = buffer.split('\n'); buffer = ls.pop() || '';
      for (const line of ls) {
        if (!line.startsWith('data: ')) continue;
        try { const obj = JSON.parse(line.slice(6)); if (obj.type === 'content_block_delta' && obj.delta?.text) { full += obj.delta.text; onStream && onStream(full); } } catch {}
      }
    }
    return full;
  };

  const luanQue = async () => {
    if (!kbSecret) { setShowSettings(true); return; }
    setLuanResult(''); setLuanLoading(true); setChatHistory([]);
    try {
      const prompt = buildPrompt();
      const text = await callAI([{ role: 'user', content: prompt }], setLuanResult);
      setChatHistory([{ role: 'user', content: prompt }, { role: 'assistant', content: text }]);
    } catch (e) { setLuanResult('❌ Lỗi: ' + e.message); }
    finally { setLuanLoading(false); }
  };

  const sendFollowUp = async () => {
    if (!followUp.trim() || luanLoading) return;
    const msg = { role: 'user', content: followUp };
    const newH = [...chatHistory, msg]; setChatHistory(newH); setFollowUp(''); setLuanLoading(true);
    try {
      const text = await callAI(newH, (p) => setChatHistory([...newH, { role: 'assistant', content: p }]));
      setChatHistory([...newH, { role: 'assistant', content: text }]);
    } catch (e) { setChatHistory([...newH, { role: 'assistant', content: '❌ ' + e.message }]); }
    finally { setLuanLoading(false); }
  };

  // ======== RENDER HELPERS ========
  const bg = dark ? '#1a1a2e' : '#fff';
  const fg = dark ? '#e0e0e0' : '#333';
  const card = dark ? '#2a2a40' : '#f8f8f8';
  const accent = '#1a237e';
  const accent2 = '#e65100';

  const renderHexLines = (lineValues, moving = [], size = 'large') => {
    const w = size === 'large' ? 100 : size === 'medium' ? 60 : 40;
    const h = size === 'large' ? 10 : 6;
    const gap = size === 'large' ? 6 : 3;
    return (
      <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap }}>
        {lineValues.map((v, i) => {
          const isM = moving.includes(i);
          const color = isM ? accent2 : (dark ? '#e0e0e0' : '#333');
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {v === 1 ? (
                <div style={{ width: w, height: h, background: color, borderRadius: 2 }} />
              ) : (
                <div style={{ display: 'flex', gap: w * 0.15 }}>
                  <div style={{ width: w * 0.4, height: h, background: color, borderRadius: 2 }} />
                  <div style={{ width: w * 0.4, height: h, background: color, borderRadius: 2 }} />
                </div>
              )}
              {isM && <span style={{ fontSize: 9, color: accent2, fontWeight: 'bold' }}>★</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderQueBlock = (hex, label, lineValues, moving, color, size = 'large') => {
    if (!hex) return null;
    const u = TRIGRAMS[hex[3]], l = TRIGRAMS[hex[4]];
    return (
      <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{label}</div>
        {renderHexLines(lineValues, moving, size)}
        <div style={{ marginTop: 6, fontWeight: 'bold', fontSize: size === 'large' ? 16 : 13, color }}>{hex[1]}</div>
        <div style={{ fontSize: 11, color: '#888' }}>{u?.name || ''} / {l?.name || ''}</div>
      </div>
    );
  };

  // ======== SETTINGS ========
  const renderSettings = () => showSettings && (
    <div onClick={() => setShowSettings(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, borderRadius: 10, padding: 16, maxWidth: 400, width: '100%', color: fg }}>
        <h3 style={{ margin: '0 0 12px', color: accent2 }}>⚙️ Cài Đặt</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>👤 Tên</label>
          <input type="text" value={userName} onChange={e => { setUserName(e.target.value); localStorage.setItem('kd_username', e.target.value) }}
            style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', fontSize: 14, background: card, color: fg }} />
        </div>
        <div style={{ marginBottom: 12, padding: 10, background: dark ? '#2a1a00' : '#fff8e1', border: '1px solid #e65100', borderRadius: 6 }}>
          <label style={{ fontSize: 12, color: accent2, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>🔑 KB Secret</label>
          <input type="password" value={kbSecret} onChange={e => { setKbSecret(e.target.value); localStorage.setItem('kd_kb_secret', e.target.value) }}
            placeholder="Mật khẩu nhóm..." style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', fontSize: 14, background: card, color: fg }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Model</label>
          <select value={aiModel} onChange={e => { setAiModel(e.target.value); localStorage.setItem('kd_model', e.target.value) }}
            style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontSize: 14, background: card, color: fg }}>
            <option value="claude-sonnet-4-20250514">Sonnet 4</option>
            <option value="claude-opus-4-20250514">Opus 4</option>
          </select>
        </div>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12 }}>Dark Mode</label>
          <button onClick={toggleDark} style={{ padding: '4px 12px', border: '1px solid #ccc', borderRadius: 4, background: dark ? '#333' : '#fff', color: dark ? '#fff' : '#333', cursor: 'pointer' }}>
            {dark ? '🌙 Bật' : '☀️ Tắt'}
          </button>
        </div>
        <button onClick={() => setShowSettings(false)} style={{ width: '100%', padding: 8, background: accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>Đóng</button>
      </div>
    </div>
  );

  // ======== HOME ========
  if (!mode && !result) {
    const methods = [
      ['thoi', '🕐', 'Thời', 'Mai Hoa theo thời điểm hiện tại', '#e53935'],
      ['khac', '⏱️', 'Khắc', 'Chọn thời gian cụ thể', '#e65100'],
      ['giay', '⏲️', 'Giây', 'Bấm nút lấy giây hiện tại', '#f9a825'],
      ['coins', '🪙', 'Đồng Xu', 'Tung 3 đồng xu 6 lần', '#43a047'],
      ['yarrow', '🌿', 'Cỏ Thi', 'Xác suất truyền thống', '#00897b'],
      ['manual', '✏️', 'Nhập Quẻ', 'Chọn thượng/hạ quái', '#5e35b1'],
      ['dacbiet', '🔢', 'Đặc Biệt', 'Nhập số ngẫu nhiên', '#1e88e5'],
    ];
    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 16, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#999' }}>{userName || ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowHistory(true)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>📜</button>
            <button onClick={toggleDark} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>{dark ? '🌙' : '☀️'}</button>
            <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>⚙️</button>
          </div>
        </div>
        <h1 style={{ textAlign: 'center', color: accent, fontSize: 24, marginBottom: 2 }}>☰ Kinh Dịch</h1>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#999', marginBottom: 12 }}>Gieo quẻ & Luận giải AI</p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Câu hỏi (tùy chọn)</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} placeholder="Nhập câu hỏi muốn xem quẻ..."
            style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', resize: 'none', background: card, color: fg }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          {methods.slice(0, 3).map(([m, icon, label, desc, clr]) => (
            <button key={m} onClick={() => m === 'thoi' ? castThoi() : setMode(m)}
              style={{ padding: '16px 8px', background: clr, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 28 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>{label}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {methods.slice(3, 5).map(([m, icon, label, desc, clr]) => (
            <button key={m} onClick={() => m === 'coins' ? castCoins() : castYarrow()}
              style={{ padding: '14px 8px', background: clr, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 24 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>{label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{desc}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {methods.slice(5).map(([m, icon, label, desc, clr]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '14px 8px', background: clr, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 24 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>{label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{desc}</div>
            </button>
          ))}
        </div>

        {showHistory && (
          <div onClick={() => setShowHistory(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: bg, borderRadius: 10, padding: 16, maxWidth: 500, width: '100%', maxHeight: '80vh', color: fg }}>
              <h3 style={{ margin: '0 0 12px', color: accent2 }}>📜 Lịch Sử ({history.length})</h3>
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {history.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Chưa có lịch sử</div>}
                {history.map(h => (
                  <div key={h.id} onClick={() => { setResult(h); setShowHistory(false); setLuanResult(''); setChatHistory([]); }} style={{ padding: 10, marginBottom: 6, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: card }}>
                    <div style={{ fontWeight: 'bold', color: accent }}>{h.chinh ? h.chinh[1] : '?'}{h.queHo ? ' | Hộ: ' + h.queHo[1] : ''}{h.bien ? ' → ' + h.bien[1] : ''}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{h.question || '(không có câu hỏi)'} • {h.ts}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowHistory(false)} style={{ width: '100%', marginTop: 8, padding: 8, background: accent, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Đóng</button>
            </div>
          </div>
        )}
        {renderSettings()}
      </div>
    );
  }

  // ======== KHẮC INPUT ========
  if (mode === 'khac' && !result) {
    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ color: accent2, marginBottom: 12 }}>⏱️ Khắc — Chọn Thời Gian</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Ngày giờ</label>
          <input type="datetime-local" value={khacDate} onChange={e => setKhacDate(e.target.value)}
            style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box', fontSize: 16, background: card, color: fg }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(null)} style={{ flex: 1, padding: 10, background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#333' }}>← Quay lại</button>
          <button onClick={castKhac} style={{ flex: 2, padding: 10, background: accent2, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // ======== GIÂY ========
  if (mode === 'giay' && !result) {
    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 20, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: '#f9a825', marginBottom: 20 }}>⏲️ Giây</h2>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 30 }}>Bấm nút khi cảm thấy đúng lúc.<br/>Giây hiện tại sẽ được dùng để tính quẻ.</p>
        <button onClick={castGiay}
          style={{ width: 160, height: 160, borderRadius: '50%', background: '#f9a825', color: '#fff', border: 'none', fontSize: 24, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(249,168,37,0.4)' }}>
          BẤM
        </button>
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setMode(null)} style={{ padding: '8px 20px', background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#333' }}>← Quay lại</button>
        </div>
      </div>
    );
  }

  // ======== ĐẶC BIỆT ========
  if (mode === 'dacbiet' && !result) {
    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ color: '#1e88e5', marginBottom: 12 }}>🔢 Đặc Biệt</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Nhập dãy số ngẫu nhiên bất kỳ. App sẽ dùng tổng các chữ số để tính quẻ theo phương pháp Mai Hoa.</p>
        <input type="text" value={specialNum} onChange={e => setSpecialNum(e.target.value)}
          placeholder="VD: 394728, 2456, 88..."
          style={{ width: '100%', padding: 12, border: '2px solid #1e88e5', borderRadius: 8, boxSizing: 'border-box', fontSize: 18, textAlign: 'center', background: card, color: fg, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(null)} style={{ flex: 1, padding: 10, background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#333' }}>← Quay lại</button>
          <button onClick={castDacBiet} style={{ flex: 2, padding: 10, background: '#1e88e5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // ======== MANUAL INPUT ========
  if (mode === 'manual' && !result) {
    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ color: '#5e35b1', marginBottom: 12 }}>✏️ Nhập Quẻ</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Thượng Quái</label>
            {Object.entries(TRIGRAMS).map(([k, t]) => (
              <button key={k} onClick={() => setManualUpper(k)}
                style={{ width: '100%', padding: 6, marginBottom: 3, background: manualUpper === k ? '#5e35b1' : card, color: manualUpper === k ? '#fff' : fg, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                {t.symbol} {t.name}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Hạ Quái</label>
            {Object.entries(TRIGRAMS).map(([k, t]) => (
              <button key={k} onClick={() => setManualLower(k)}
                style={{ width: '100%', padding: 6, marginBottom: 3, background: manualLower === k ? '#5e35b1' : card, color: manualLower === k ? '#fff' : fg, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                {t.symbol} {t.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Hào Động (chọn 0-6 hào)</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {LINE_NAMES.map((n, i) => (
              <button key={i} onClick={() => setManualMoving(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                style={{ flex: 1, padding: 6, background: manualMoving.includes(i) ? accent2 : card, color: manualMoving.includes(i) ? '#fff' : fg, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>
                {n.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setMode(null); setManualMoving([]); }} style={{ flex: 1, padding: 10, background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#333' }}>← Quay lại</button>
          <button onClick={castManual} style={{ flex: 2, padding: 10, background: '#5e35b1', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // ======== RESULT ========
  if (result && result.chinh) {
    const c = result.chinh;
    const b = result.bien;
    const ho = result.queHo;
    const bLines = b ? result.lineValues.map((v, i) => result.moving.includes(i) ? (v === 1 ? 0 : 1) : v) : null;
    const hoLines = ho ? [result.lineValues[1], result.lineValues[2], result.lineValues[3], result.lineValues[2], result.lineValues[3], result.lineValues[4]] : null;
    const finished = !luanLoading && (luanResult || chatHistory.length > 0);

    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={() => { setResult(null); setMode(null); setLuanResult(''); setChatHistory([]); }}
            style={{ padding: '4px 12px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: card, color: fg, fontSize: 12 }}>← Gieo lại</button>
          <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>⚙️</button>
        </div>

        {result.question && <div style={{ padding: 8, background: dark ? '#2a2a10' : '#fff8e1', borderRadius: 6, marginBottom: 10, fontSize: 13, border: '1px solid #e65100' }}>
          <b style={{ color: accent2 }}>Câu hỏi:</b> {result.question}
        </div>}
        {result.castTime && <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 8 }}>
          {({coins:'🪙 Đồng Xu',yarrow:'🌿 Cỏ Thi',manual:'✏️ Nhập',thoi:'🕐 Mai Hoa Thời',khac:'⏱️ Khắc',giay:'⏲️ Giây',dacbiet:'🔢 Đặc Biệt'})[result.method]||''} • {result.castTime}
          {result.lunar && ` • ÂL ${result.lunar.day}/${result.lunar.month}/${result.lunar.year}`}
        </div>}

        {/* 3 quẻ: Chánh | Hộ | Biến */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap', padding: '12px 0', border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 10, background: card }}>
          {renderQueBlock(c, 'Chánh', result.lineValues, result.moving, accent, 'large')}
          {ho && renderQueBlock(ho, 'Hộ', hoLines, [], '#795548', 'medium')}
          {b && renderQueBlock(b, 'Biến', bLines, [], accent2, 'medium')}
        </div>

        {/* Line details */}
        <div style={{ marginBottom: 10, padding: 10, background: card, borderRadius: 6, fontSize: 12 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>6 Hào:</div>
          {[...result.lines].reverse().map((l, ri) => {
            const i = 5 - ri;
            const isM = result.moving.includes(i);
            const label = l.value === 9 ? 'Lão Dương (động)' : l.value === 6 ? 'Lão Âm (động)' : l.value === 7 ? 'Thiếu Dương' : 'Thiếu Âm';
            return <div key={i} style={{ padding: '2px 0', color: isM ? accent2 : fg }}>{LINE_NAMES[i]}: {label} {isM && '★'}</div>;
          })}
          <div style={{ marginTop: 4, color: '#888', fontStyle: 'italic' }}>{c[5]}</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={luanQue} disabled={luanLoading}
            style={{ flex: 2, padding: 10, background: accent2, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', opacity: luanLoading ? 0.5 : 1, fontSize: 14 }}>
            🔮 {luanLoading ? 'Đang luận...' : 'Luận Giải AI'}
          </button>
          <button onClick={() => { setResult(null); setMode(null); setLuanResult(''); setChatHistory([]); }}
            style={{ flex: 1, padding: 10, background: card, border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: fg }}>Gieo Mới</button>
        </div>

        {/* AI Result + Chat */}
        {(luanResult || chatHistory.length > 0) && (
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            {chatHistory.length === 0 && (
              <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {luanResult}{luanLoading && <span style={{ color: accent2 }}>▊</span>}
              </div>
            )}
            {chatHistory.length > 0 && chatHistory.map((msg, i) => (
              <div key={i} style={{ marginBottom: 10, padding: msg.role === 'user' ? '8px 12px' : 0, background: msg.role === 'user' ? card : 'transparent', borderRadius: 8, borderLeft: msg.role === 'assistant' ? '3px solid ' + accent2 : 'none', paddingLeft: msg.role === 'assistant' ? 10 : 12 }}>
                {msg.role === 'user' && i > 0 && <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>Hỏi thêm:</div>}
                <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {i === 0 ? '(Đã gửi data quẻ)' : msg.content}
                  {luanLoading && i === chatHistory.length - 1 && msg.role === 'assistant' && <span style={{ color: accent2 }}>▊</span>}
                </div>
              </div>
            ))}
            {finished && (
              <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 8 }}>
                <input type="text" value={followUp} onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendFollowUp() }}
                  placeholder="Hỏi thêm..." style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6, fontSize: 14, background: card, color: fg }} />
                <button onClick={sendFollowUp} disabled={!followUp.trim() || luanLoading}
                  style={{ padding: '8px 12px', background: accent2, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', opacity: !followUp.trim() || luanLoading ? 0.5 : 1 }}>Gửi</button>
              </div>
            )}
          </div>
        )}
        {renderSettings()}
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ background: bg, color: fg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>☰</div>
        <div>Đang xử lý...</div>
        <button onClick={() => { setResult(null); setMode(null); }} style={{ marginTop: 12, padding: '8px 20px', background: accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>← Quay lại</button>
      </div>
    </div>
  );
}
