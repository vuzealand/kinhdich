#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function seed() {
  const baseUrl = process.argv[2] || 'https://kinhdich.vercel.app';
  const secret = process.argv[3] || '';
  if (!secret) { console.error('Usage: node tools/seed-kb.cjs <url> <secret>'); process.exit(1); }

  const kbPath = path.join(__dirname, '..', 'data', 'kinhdich-kb.json');
  if (!fs.existsSync(kbPath)) { console.error('File not found:', kbPath); process.exit(1); }

  const chunks = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
  console.log(`Loaded ${chunks.length} chunks`);

  const batchSize = 50;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`  Uploading batch ${Math.floor(i/batchSize)+1}...`);
    const res = await fetch(`${baseUrl}/api/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kb-secret': secret },
      body: JSON.stringify({ type: 'books', items: batch }),
    });
    const data = await res.json();
    if (!data.ok) { console.error('Error:', data.error); process.exit(1); }
    console.log(`  → Total: ${data.count}`);
  }
  console.log('Done!');
}

seed().catch(e => { console.error(e); process.exit(1); });
