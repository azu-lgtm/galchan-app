#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { google } from 'googleapis';

const envRaw = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
for (const line of envRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const ID = process.env.SPREADSHEET_ID_GALCHAN;

const memo = `【企画理由】消費者庁・農林水産省関東農政局・国民生活センターの公的機関データを軸に、6店舗（業務スーパー/ドン・キホーテ/コストコ/ロピア/イオン/カルディ）の危険食品×神食品ネガポジペア型（24商品）保存版有益まとめ。自ガル15「Amazon×日用品」型を「店舗別×食品×家族の安全」軸で再構成。
【セッション記録】2026-05-13ネタ出し→2026-05-15分析・ペルソナ→2026-05-16台本生成v1〜v8レビュー反映（9話者固定/連続話者0/SE22/70字超0/9398字）→2026-05-18最終QA全機械ゲートPASS→スプシ保存row41。
【数値根拠】業務スーパー中国産冷凍ピーマン4万5648個自主回収(消費者庁2025-05-30)・ロピア18商品73店舗64万5994パック販売是正指示(農林水産省関東農政局2024-06-11)・コストコモッツァロール2025-11賞味期限内ロット回収。`;

const res = await sheets.spreadsheets.values.update({
  spreadsheetId: ID,
  range: '自分チャンネル・動画管理表!Q41',
  valueInputOption: 'RAW',
  requestBody: { values: [[memo]] },
});
console.log('✅ Q41(メモ)更新:', res.data.updatedCells, '字数:', memo.length);
