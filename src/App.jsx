import { useState, useMemo, useEffect, useRef } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP, getHexagram, getBienQue } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const LINE_NAMES = ['Sơ (1)','Nhị (2)','Tam (3)','Tứ (4)','Ngũ (5)','Thượng (6)'];

export default function KinhDichApp() {
  const [mode, setMode] = useState(null); // 'coins'|'yarrow'|'manual'|null
  const [lines, setLines] = useState([]); // [{value:6|7|8|9}] bottom to top
  const [currentLine, setCurrentLine] = useState(0);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null); // {chinh, bien, lines, moving}
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

  const toggleDark = () => { const n = !dark; setDark(n); localStorage.setItem('kd_dark', n ? '1' : '0') };

  // ======== CASTING METHODS ========
  // 3 coins: each toss = 3 coins (2=yin head, 3=yang tail)
  // Sum: 6=old yin(moving), 7=young yang, 8=young yin, 9=old yang(moving)
  const tossCoin = () => {
    const coins = [0, 0, 0].map(() => Math.random() < 0.5 ? 2 : 3);
    return coins.reduce((a, b) => a + b, 0);
  };

  const castCoins = () => {
    const newLines = [];
    for (let i = 0; i < 6; i++) newLines.push({ value: tossCoin() });
    const lineValues = newLines.map(l => (l.value === 7 || l.value === 9) ? 1 : 0);
    const moving = newLines.map((l, i) => (l.value === 6 || l.value === 9) ? i : -1).filter(i => i >= 0);
    const chinh = getHexagram(lineValues);
    const bien = moving.length > 0 ? getBienQue(lineValues, moving) : null;
    const r = { chinh, bien, lines: newLines, lineValues, moving, question, ts: new Date().toLocaleString('vi-VN') };
    setResult(r);
    saveHistory(r);
  };

  // 50 yarrow stalks (simplified simulation)
  const castYarrow = () => {
    const yarrowLine = () => {
      // Simplified: probabilities match traditional yarrow stalk method
      // 6(old yin)=1/16, 7(young yang)=5/16, 8(young yin)=7/16, 9(old yang)=3/16
      const r = Math.random();
      if (r < 1 / 16) return 6;
      if (r < 6 / 16) return 7;
      if (r < 13 / 16) return 8;
      return 9;
    };
    const newLines = [];
    for (let i = 0; i < 6; i++) newLines.push({ value: yarrowLine() });
    const lineValues = newLines.map(l => (l.value === 7 || l.value === 9) ? 1 : 0);
    const moving = newLines.map((l, i) => (l.value === 6 || l.value === 9) ? i : -1).filter(i => i >= 0);
    const chinh = getHexagram(lineValues);
    const bien = moving.length > 0 ? getBienQue(lineValues, moving) : null;
    const r2 = { chinh, bien, lines: newLines, lineValues, moving, question, ts: new Date().toLocaleString('vi-VN') };
    setResult(r2);
    saveHistory(r2);
  };

  // Manual: user picks upper + lower trigram
  const [manualUpper, setManualUpper] = useState('111');
  const [manualLower, setManualLower] = useState('000');
  const [manualMoving, setManualMoving] = useState([]);
  const castManual = () => {
    const lower = manualLower.split('').map(Number);
    const upper = manualUpper.split('').map(Number);
    const lineValues = [...lower, ...upper];
    const newLines = lineValues.map((v, i) => ({ value: manualMoving.includes(i) ? (v === 1 ? 9 : 6) : (v === 1 ? 7 : 8) }));
    const chinh = getHexagram(lineValues);
    const bien = manualMoving.length > 0 ? getBienQue(lineValues, manualMoving) : null;
    const r3 = { chinh, bien, lines: newLines, lineValues, moving: manualMoving, question, ts: new Date().toLocaleString('vi-VN') };
    setResult(r3);
    saveHistory(r3);
  };

  // ======== HISTORY ========
  const saveHistory = (r) => {
    const entry = { id: Date.now(), ...r, chinh: r.chinh ? [...r.chinh] : null, bien: r.bien ? [...r.bien] : null };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('kd_history', JSON.stringify(updated));
  };

  // ======== AI LUẬN ========
  const buildPrompt = () => {
    if (!result || !result.chinh) return '';
    const c = result.chinh;
    const upperT = TRIGRAMS[c[3]];
    const lowerT = TRIGRAMS[c[4]];
    let prompt = `# Gieo Quẻ Kinh Dịch\n`;
    if (question) prompt += `**Câu hỏi:** ${question}\n\n`;
    prompt += `## Quẻ Chính: ${c[1]} (${c[2]})\n`;
    prompt += `- Ngoại quái: ${upperT.name} (${upperT.nature}, ${upperT.element})\n`;
    prompt += `- Nội quái: ${lowerT.name} (${lowerT.nature}, ${lowerT.element})\n`;
    prompt += `- Ý nghĩa: ${c[5]}\n\n`;
    prompt += `## 6 Hào (từ dưới lên):\n`;
    result.lines.forEach((l, i) => {
      const isMoving = result.moving.includes(i);
      const label = l.value === 9 ? 'Lão Dương ⚊→⚋ (động)' : l.value === 6 ? 'Lão Âm ⚋→⚊ (động)' : l.value === 7 ? 'Thiếu Dương ⚊' : 'Thiếu Âm ⚋';
      prompt += `- Hào ${LINE_NAMES[i]}: ${label}${isMoving ? ' ★ĐỘNG' : ''}\n`;
    });
    if (result.bien) {
      const b = result.bien;
      const bUpperT = TRIGRAMS[b[3]];
      const bLowerT = TRIGRAMS[b[4]];
      prompt += `\n## Quẻ Biến: ${b[1]} (${b[2]})\n`;
      prompt += `- Ngoại quái: ${bUpperT.name} (${bUpperT.nature}, ${bUpperT.element})\n`;
      prompt += `- Nội quái: ${bLowerT.name} (${bLowerT.nature}, ${bLowerT.element})\n`;
      prompt += `- Ý nghĩa: ${b[5]}\n`;
    } else {
      prompt += `\n(Không có hào động → luận toàn quẻ)\n`;
    }
    prompt += `\n---\nHãy luận giải quẻ này${question ? ' cho câu hỏi trên' : ''}. Phân tích quẻ chính, hào động, quẻ biến, và đưa ra lời khuyên cụ thể.`;
    return prompt;
  };

  const callAI = async (messages, onStream) => {
    const res = await fetch('/api/luan-que', {
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
      const ls = buffer.split('\n');
      buffer = ls.pop() || '';
      for (const line of ls) {
        if (!line.startsWith('data: ')) continue;
        try {
          const obj = JSON.parse(line.slice(6));
          if (obj.type === 'content_block_delta' && obj.delta?.text) { full += obj.delta.text; onStream && onStream(full); }
        } catch {}
      }
    }
    return full;
  };

  const luanQue = async () => {
    if (!kbSecret) { setShowSettings(true); return; }
    setLuanResult('');
    setLuanLoading(true);
    setChatHistory([]);
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
    const newH = [...chatHistory, msg];
    setChatHistory(newH);
    setFollowUp('');
    setLuanLoading(true);
    try {
      const text = await callAI(newH, (p) => setChatHistory([...newH, { role: 'assistant', content: p }]));
      setChatHistory([...newH, { role: 'assistant', content: text }]);
    } catch (e) { setChatHistory([...newH, { role: 'assistant', content: '❌ ' + e.message }]); }
    finally { setLuanLoading(false); }
  };

  // ======== RENDER HEXAGRAM ========
  const renderHexLines = (lineValues, moving = [], size = 'large') => {
    const w = size === 'large' ? 120 : 60;
    const h = size === 'large' ? 12 : 6;
    const gap = size === 'large' ? 8 : 4;
    return (
      <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: `${gap}px` }}>
        {lineValues.map((v, i) => {
          const isMoving = moving.includes(i);
          const color = isMoving ? '#e65100' : (dark ? '#e0e0e0' : '#333');
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {v === 1 ? (
                <div style={{ width: w, height: h, background: color, borderRadius: 2 }} />
              ) : (
                <div style={{ display: 'flex', gap: `${w * 0.15}px` }}>
                  <div style={{ width: w * 0.4, height: h, background: color, borderRadius: 2 }} />
                  <div style={{ width: w * 0.4, height: h, background: color, borderRadius: 2 }} />
                </div>
              )}
              {isMoving && <span style={{ fontSize: '10px', color: '#e65100' }}>★</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // ======== UI ========
  const bg = dark ? '#1a1a2e' : '#fff';
  const fg = dark ? '#e0e0e0' : '#333';
  const card = dark ? '#2a2a40' : '#f8f8f8';
  const accent = '#b71c1c';
  const accent2 = '#e65100';

  // Settings modal
  const renderSettings = () => showSettings && (
    <div onClick={() => setShowSettings(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, borderRadius: 8, padding: 16, maxWidth: 400, width: '100%', color: fg }}>
        <h3 style={{ margin: '0 0 12px', color: accent2 }}>⚙️ Cài Đặt</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>👤 Tên</label>
          <input type="text" value={userName} onChange={e => { setUserName(e.target.value); localStorage.setItem('kd_username', e.target.value) }}
            style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', fontSize: 14 }} />
        </div>
        <div style={{ marginBottom: 12, padding: 10, background: dark ? '#2a1a00' : '#fff8e1', border: '1px solid #e65100', borderRadius: 6 }}>
          <label style={{ fontSize: 12, color: accent2, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>🔑 KB Secret</label>
          <input type="password" value={kbSecret} onChange={e => { setKbSecret(e.target.value); localStorage.setItem('kd_kb_secret', e.target.value) }}
            placeholder="Mật khẩu nhóm..." style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', fontSize: 14 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Model</label>
          <select value={aiModel} onChange={e => { setAiModel(e.target.value); localStorage.setItem('kd_model', e.target.value) }}
            style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontSize: 14 }}>
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

  // HOME
  if (!mode && !result) {
    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#999' }}>{userName || ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowHistory(true)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>📜</button>
            <button onClick={toggleDark} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>{dark ? '🌙' : '☀️'}</button>
            <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>⚙️</button>
          </div>
        </div>
        <h1 style={{ textAlign: 'center', color: accent, fontSize: 28, marginBottom: 4 }}>☰ Kinh Dịch</h1>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#999', marginBottom: 20 }}>Gieo quẻ & Luận giải AI</p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Câu hỏi (tùy chọn)</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} placeholder="Nhập câu hỏi muốn xem quẻ..."
            style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', resize: 'none' }} />
        </div>

        {[
          ['coins', '🪙 Gieo 3 Đồng Xu', 'Tung 3 đồng xu 6 lần, nhanh và phổ biến nhất'],
          ['yarrow', '🌿 Cỏ Thi (50 Cọng)', 'Phương pháp truyền thống, xác suất chuẩn cổ điển'],
          ['manual', '✏️ Nhập Quẻ Trực Tiếp', 'Chọn nội/ngoại quái và hào động'],
        ].map(([m, label, desc]) => (
          <button key={m} onClick={() => m === 'manual' ? setMode('manual') : m === 'coins' ? (setMode('coins'), setTimeout(castCoins, 100)) : (setMode('yarrow'), setTimeout(castYarrow, 100))}
            style={{ width: '100%', padding: 14, marginBottom: 10, background: card, border: `2px solid ${accent}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontWeight: 'bold', fontSize: 16, color: accent }}>{label}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{desc}</div>
          </button>
        ))}

        {/* History modal */}
        {showHistory && (
          <div onClick={() => setShowHistory(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: bg, borderRadius: 8, padding: 16, maxWidth: 500, width: '100%', maxHeight: '80vh', color: fg }}>
              <h3 style={{ margin: '0 0 12px', color: accent2 }}>📜 Lịch Sử ({history.length})</h3>
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {history.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Chưa có lịch sử</div>}
                {history.map(h => (
                  <div key={h.id} onClick={() => { setResult(h); setShowHistory(false); }} style={{ padding: 10, marginBottom: 6, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: card }}>
                    <div style={{ fontWeight: 'bold', color: accent }}>{h.chinh ? h.chinh[1] : '?'}{h.bien ? ' → ' + h.bien[1] : ''}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{h.question || '(không có câu hỏi)'} • {h.ts}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowHistory(false)} style={{ width: '100%', marginTop: 8, padding: 8, background: accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>Đóng</button>
            </div>
          </div>
        )}
        {renderSettings()}
      </div>
    );
  }

  // MANUAL INPUT
  if (mode === 'manual' && !result) {
    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ color: accent, marginBottom: 12 }}>✏️ Nhập Quẻ</h2>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Ngoại Quái (trên)</label>
            {Object.entries(TRIGRAMS).map(([k, t]) => (
              <button key={k} onClick={() => setManualUpper(k)}
                style={{ width: '100%', padding: 8, marginBottom: 4, background: manualUpper === k ? accent : card, color: manualUpper === k ? '#fff' : fg, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                {t.symbol} {t.name} ({t.nature})
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nội Quái (dưới)</label>
            {Object.entries(TRIGRAMS).map(([k, t]) => (
              <button key={k} onClick={() => setManualLower(k)}
                style={{ width: '100%', padding: 8, marginBottom: 4, background: manualLower === k ? accent : card, color: manualLower === k ? '#fff' : fg, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                {t.symbol} {t.name} ({t.nature})
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Hào Động (bấm để chọn/bỏ)</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {LINE_NAMES.map((n, i) => (
              <button key={i} onClick={() => setManualMoving(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                style={{ flex: 1, padding: 8, background: manualMoving.includes(i) ? accent2 : card, color: manualMoving.includes(i) ? '#fff' : fg, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                {n.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setMode(null); setManualMoving([]); }} style={{ flex: 1, padding: 10, background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}>← Quay lại</button>
          <button onClick={castManual} style={{ flex: 2, padding: 10, background: accent, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Xem Quẻ</button>
        </div>
      </div>
    );
  }

  // RESULT
  if (result && result.chinh) {
    const c = result.chinh;
    const b = result.bien;
    const upperT = TRIGRAMS[c[3]];
    const lowerT = TRIGRAMS[c[4]];
    const finished = !luanLoading && luanResult;

    return (
      <div style={{ background: bg, color: fg, minHeight: '100dvh', fontFamily: "'Noto Sans',system-ui,sans-serif", padding: 16, maxWidth: 600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={() => { setResult(null); setMode(null); setLuanResult(''); setChatHistory([]); }}
            style={{ padding: '4px 12px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: card, color: fg, fontSize: 12 }}>← Gieo lại</button>
          <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>⚙️</button>
        </div>

        {/* Question */}
        {result.question && <div style={{ padding: 8, background: dark ? '#2a2a10' : '#fff8e1', borderRadius: 6, marginBottom: 12, fontSize: 13, border: '1px solid #e65100' }}>
          <b style={{ color: accent2 }}>Câu hỏi:</b> {result.question}
        </div>}

        {/* Hexagram display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>Quẻ Chính</div>
            {renderHexLines(result.lineValues, result.moving)}
            <div style={{ marginTop: 8, fontWeight: 'bold', fontSize: 18, color: accent }}>{c[1]}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{c[2]}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{upperT.symbol} {upperT.name} / {lowerT.symbol} {lowerT.name}</div>
          </div>
          {b && (() => {
            const bU = TRIGRAMS[b[3]], bL = TRIGRAMS[b[4]];
            const bLines = result.lineValues.map((v, i) => result.moving.includes(i) ? (v === 1 ? 0 : 1) : v);
            return (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>→ Quẻ Biến</div>
                {renderHexLines(bLines, [], 'large')}
                <div style={{ marginTop: 8, fontWeight: 'bold', fontSize: 18, color: accent2 }}>{b[1]}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{b[2]}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{bU.symbol} {bU.name} / {bL.symbol} {bL.name}</div>
              </div>
            );
          })()}
        </div>

        {/* Line details */}
        <div style={{ marginBottom: 12, padding: 10, background: card, borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>6 Hào:</div>
          {[...result.lines].reverse().map((l, ri) => {
            const i = 5 - ri;
            const isM = result.moving.includes(i);
            const label = l.value === 9 ? 'Lão Dương (động)' : l.value === 6 ? 'Lão Âm (động)' : l.value === 7 ? 'Thiếu Dương' : 'Thiếu Âm';
            return (
              <div key={i} style={{ fontSize: 12, padding: '2px 0', color: isM ? accent2 : fg }}>
                {LINE_NAMES[i]}: {label} {isM && '★'}
              </div>
            );
          })}
          <div style={{ fontSize: 12, marginTop: 4, color: '#888' }}>{c[5]}</div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={luanQue} disabled={luanLoading}
            style={{ flex: 2, padding: 10, background: accent2, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', opacity: luanLoading ? 0.5 : 1, fontSize: 14 }}>
            🔮 {luanLoading ? 'Đang luận...' : 'Luận Giải AI'}
          </button>
          <button onClick={() => { setResult(null); setMode(null); setLuanResult(''); setChatHistory([]); }}
            style={{ flex: 1, padding: 10, background: card, border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Gieo Mới</button>
        </div>

        {/* AI Result + Chat */}
        {(luanResult || chatHistory.length > 0) && (
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            {chatHistory.length === 0 && (
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {luanResult}{luanLoading && <span style={{ color: accent2 }}>▊</span>}
              </div>
            )}
            {chatHistory.length > 0 && chatHistory.map((msg, i) => (
              <div key={i} style={{ marginBottom: 10, padding: msg.role === 'user' ? '8px 12px' : 0, background: msg.role === 'user' ? card : 'transparent', borderRadius: 8, borderLeft: msg.role === 'assistant' ? '3px solid ' + accent2 : 'none', paddingLeft: msg.role === 'assistant' ? 10 : 12 }}>
                {msg.role === 'user' && i > 0 && <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>Hỏi thêm:</div>}
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {i === 0 ? '(Đã gửi data quẻ)' : msg.content}
                  {luanLoading && i === chatHistory.length - 1 && msg.role === 'assistant' && <span style={{ color: accent2 }}>▊</span>}
                </div>
              </div>
            ))}
            {finished && (
              <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 8 }}>
                <input type="text" value={followUp} onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendFollowUp() }}
                  placeholder="Hỏi thêm..." style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6, fontSize: 14, background: dark ? '#2a2a40' : '#fff', color: fg }} />
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

  // Fallback loading
  return (
    <div style={{ background: bg, color: fg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>☰</div>
        <div>Đang gieo quẻ...</div>
      </div>
    </div>
  );
}
