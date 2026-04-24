// Seed + manage book knowledge base on Vercel KV
import { kv } from '@vercel/kv';

const SHARED_SECRET = process.env.KB_SECRET || 'tuvi-default-secret-change-me';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-kb-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: load all book chunks + user notes
    if (req.method === 'GET') {
      const [books, notes, charts] = await Promise.all([
        kv.get('kb:books').catch(() => null),
        kv.get('kb:notes').catch(() => null),
        kv.get('kb:charts').catch(() => null),
      ]);
      return res.status(200).json({
        ok: true,
        books: books || [],
        notes: notes || [],
        charts: charts || [],
        totalBooks: (books || []).length,
        totalNotes: (notes || []).length,
        totalCharts: (charts || []).length,
      });
    }

    // Write operations require secret
    const secret = req.headers['x-kb-secret'];
    if (secret !== SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: 'Invalid secret' });
    }

    // POST: add items (type=books for seed, type=notes for user)
    if (req.method === 'POST') {
      const { type = 'notes', items, item } = req.body;
      const key = `kb:${type}`;
      const current = (await kv.get(key).catch(() => null)) || [];

      if (items && Array.isArray(items)) {
        // Bulk seed (for initial upload of book chunks)
        const merged = [...items, ...current];
        // Deduplicate by id
        const seen = new Set();
        const deduped = merged.filter(x => {
          if (seen.has(x.id)) return false;
          seen.add(x.id);
          return true;
        });
        await kv.set(key, deduped.slice(0, 2000));
        return res.status(200).json({ ok: true, count: deduped.length, action: 'bulk_seed' });
      }

      if (item && typeof item === 'object') {
        // Single add
        const updated = [{ ...item, id: item.id || Date.now(), ts: item.ts || new Date().toISOString() }, ...current].slice(0, 2000);
        await kv.set(key, updated);
        return res.status(200).json({ ok: true, count: updated.length, action: 'add' });
      }

      return res.status(400).json({ ok: false, error: 'Need items[] or item{}' });
    }

    // DELETE: remove by id or clear all
    if (req.method === 'DELETE') {
      const { type = 'notes', id, clearAll } = req.query;
      const key = `kb:${type}`;

      if (clearAll === 'true') {
        await kv.del(key);
        return res.status(200).json({ ok: true, cleared: true });
      }

      if (id) {
        const current = (await kv.get(key).catch(() => null)) || [];
        const updated = current.filter(x => String(x.id) !== String(id));
        await kv.set(key, updated);
        return res.status(200).json({ ok: true, count: updated.length });
      }

      return res.status(400).json({ ok: false, error: 'Need id or clearAll=true' });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
