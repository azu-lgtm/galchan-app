#!/usr/bin/env node
/**
 * Google Docs内容取得（既存Drive scope経由・読み取り専用）
 * 使い方: node fetch_doc_content.mjs <docId>
 */
import { readFile } from 'fs/promises';
import { google } from 'googleapis';

const envRaw = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
for (const line of envRaw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v;
}

const docId = process.argv[2];
if (!docId) {
  console.error('usage: node fetch_doc_content.mjs <docId>');
  process.exit(1);
}

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: c });

// Google Docs を text/plain でエクスポート
try {
  const res = await drive.files.export({
    fileId: docId,
    mimeType: 'text/plain',
  }, { responseType: 'arraybuffer' });
  const text = Buffer.from(res.data).toString('utf8');
  console.log(text);
} catch (e) {
  console.error('❌ Docs取得失敗:', e.message);
  process.exit(1);
}
