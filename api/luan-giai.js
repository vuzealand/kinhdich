// Edge Runtime proxy - supports long streaming without timeout
export const config = { runtime: 'edge' };

const SHARED_SECRET = process.env.KB_SECRET || 'tuvi-default-secret-change-me';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT_PER_USER || '30', 10);

// Upstash REST API (Edge-compatible, no SDK needed)
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  } catch (e) { return null; }
}

async function kvSet(key, value, exSeconds) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    const args = exSeconds ? `EX/${exSeconds}` : '';
    await fetch(`${KV_URL}/set/${key}/${args}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  } catch (e) {}
}

const PRICING = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
};

const today = () => new Date().toISOString().slice(0, 10);

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-kb-secret, x-user',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });

  const secret = req.headers.get('x-kb-secret');
  if (secret !== SHARED_SECRET) {
    return new Response(JSON.stringify({ error: 'Cần nhập KB Secret trong ⚙️ Cài Đặt' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'Server chưa cấu hình ANTHROPIC_API_KEY' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  const user = (req.headers.get('x-user') || 'anonymous').slice(0, 40);
  const day = today();

  // Rate limit
  try {
    const rateKey = `rate:${user}:${day}`;
    const count = (await kvGet(rateKey)) || 0;
    if (count >= DAILY_LIMIT) {
      return new Response(JSON.stringify({ error: `Đã đạt giới hạn ${DAILY_LIMIT} luận giải/ngày. Reset vào 0h.` }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    await kvSet(rateKey, count + 1, 60 * 60 * 26);
  } catch (e) {}

  try {
    const body = await req.json();
    const model = body.model || 'claude-sonnet-4-20250514';

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(errText, { status: upstream.status, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // Create a TransformStream to pass through + parse usage
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    const enc = new TextEncoder();

    // Stream in background
    (async () => {
      let inputTokens = 0, outputTokens = 0;
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          await writer.write(enc.encode(chunk));
          // Parse usage info
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const obj = JSON.parse(line.slice(6));
              if (obj.type === 'message_start' && obj.message?.usage) inputTokens = obj.message.usage.input_tokens || 0;
              if (obj.type === 'message_delta' && obj.usage) outputTokens = obj.usage.output_tokens || 0;
            } catch (e) {}
          }
        }
      } finally {
        await writer.close();
        // Log usage after stream ends
        try {
          const price = PRICING[model] || PRICING['claude-sonnet-4-20250514'];
          const costUsd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
          const monthKey = `usage:${day.slice(0, 7)}`;
          const monthly = (await kvGet(monthKey)) || [];
          monthly.push({ user, day, model, inputTokens, outputTokens, costUsd: Math.round(costUsd * 10000) / 10000, ts: new Date().toISOString() });
          await kvSet(monthKey, monthly.slice(-1000), 60 * 60 * 24 * 90);
        } catch (e) {}
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: { ...headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
}
