/**
 * 自ガル17 商品リスト 全面更新（azu指示2026-06-08「商品リストにもいれた？」）。
 * 台本の実名商品に合わせて作り直す。ネガ=アフィなし／ポジ・代案=Amazon検索+アフィタグ or 店舗注記。
 * feedback_affiliate_only_for_positive_products.md 準拠（アフィはポジ商品のみ）。
 */
import { readFile } from 'fs/promises';
import { google } from 'googleapis';

const SID = '10pcb2fGb_BQy5IayodTGRSvxsbsKsWhouq8IqiqTGt0';
const TAG = 'garuchannel22-22';
const az = (name) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(name)}&tag=${TAG}`;

const envText = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
for (const line of envText.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

// [商品名, 型番/区分, Amazon, 楽天]
const NEG = '※買って後悔系（紹介のみ・アフィなし）';
const neg = (n, model = '') => [n, model || NEG, '', ''];
const posAmz = (n, model = '') => [n, model || '神商品・代案', az(n), ''];
const posShop = (n, shop) => [n, shop, '', ''];

const items = [
  // ── ネガ（買って後悔・実名・アフィなし）──
  neg('ダイソン 羽根なし扇風機'),
  neg('ダイソン コードレス掃除機'),
  neg('ソーダストリーム（炭酸水メーカー）'),
  neg('バイタミックス（高級ミキサー）'),
  neg('バルミューダ トースター'),
  neg('ミラブル（シャワーヘッド）'),
  neg('ダイソン ドライヤー'),
  neg('ソニッケアー（電動歯ブラシ）'),
  neg('デロンギ オイルヒーター'),
  neg('パナソニック 食洗機'),
  neg('ルンバ（ロボット掃除機）'),
  neg('テンピュール 枕'),
  neg('西川 高級羽毛布団'),
  neg('アイリスオーヤマ 布団乾燥機'),
  neg('タニタ 体組成計'),
  neg('ダウニー（柔軟剤）'),
  neg('ホームベーカリー'),
  neg('冷感タオル・ネッククーラー・ハンディファン', '※夏物後悔系（紹介のみ）'),
  neg('置き型“エアコン”風 冷却グッズ', '※国民生活センター注意喚起(2026/3/11)'),
  neg('ステルス値上げ食品（ガリガリ君90円/ミンティア140円/赤いきつね248円/板チョコ/きのこの山66g/マヨ559円/サラダ油/食パン）', '※値上げ実例（紹介のみ）'),
  neg('トイレットペーパー・ゴミ袋（値上げ実例）', '※日用品値上げ（紹介のみ）'),
  // ── ポジ・代案（買って正解・アフィあり or 店舗）──
  posAmz('山善 扇風機'),
  posAmz('マキタ 紙パック式コードレス掃除機'),
  posAmz('ニトリ 着る毛布'),
  posAmz('キャンメイク マシュマロフィニッシュパウダー'),
  posAmz('サーモス 水筒'),
  posShop('業務スーパー 冷凍讃岐うどん', '※業務スーパー店舗で購入'),
  posShop('業務スーパー ベルギー産冷凍ポテト', '※業務スーパー店舗で購入'),
  posShop('業務スーパー 緑の業務用ラップ（日本製）', '※業務スーパー店舗で購入'),
  posShop('業務スーパー ビール酵母パン', '※業務スーパー店舗で購入'),
  posShop('ワークマン 氷撃冷感シャツ（約580円）', '※ワークマン店舗/公式で購入'),
  posShop('ワークマン 薄手ダウン', '※ワークマン店舗/公式で購入'),
  posShop('ドン・キホーテ 焼き芋', '※ドンキ店舗で購入'),
  posShop('ダイソー 収納ケース', '※ダイソー店舗で購入'),
  posAmz('昔ながらの固形石けん'),
  posShop('保冷剤＋薄いハンカチ（首に当てる）', '※家にある物で代用'),
];

const rows = items.map((it, i) => [String(i + 1), ...it]);

console.log('🚀 商品リスト全面更新...', rows.length, '商品');
await sheets.spreadsheets.values.clear({ spreadsheetId: SID, range: '商品リスト!A2:E100' });
await sheets.spreadsheets.values.update({ spreadsheetId: SID, range: '商品リスト!A2', valueInputOption: 'USER_ENTERED', requestBody: { values: rows } });

// 読み戻し検証
const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: '商品リスト!A1:E60' });
const v = r.data.values || [];
let aff = 0, neg2 = 0, shop = 0, garbage = 0;
v.slice(1).forEach((row) => {
  const amz = row[3] || '';
  if (amz.includes('tag=' + TAG)) aff++;
  if ((row[2] || '').includes('後悔') || (row[2] || '').includes('値上げ') || (row[2] || '').includes('注意喚起')) neg2++;
  if ((row[2] || '').includes('店舗') || (row[2] || '').includes('購入')) shop++;
  if (/[̂̀-ͯ�□]/.test((row[1] || '') + amz)) garbage++;
});
console.log('📖 読み戻し:', v.length - 1, '行 / アフィ付き', aff, '/ ネガ(アフィなし)', neg2, '/ 店舗系', shop, '/ 文字化け', garbage);
console.log('--- 先頭5 ---');
v.slice(1, 6).forEach((row) => console.log(' ', (row || []).map(x => (x || '').slice(0, 30)).join(' | ')));
console.log('--- ポジ先頭3(アフィ) ---');
v.slice(1).filter(row => (row[3] || '').includes('tag=')).slice(0, 3).forEach((row) => console.log(' ', row[1], '|', row[3]));
console.log(garbage === 0 ? '✅ 文字化けなし・更新完了' : '⚠️ 文字化けあり');
