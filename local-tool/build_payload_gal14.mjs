#!/usr/bin/env node
/**
 * 自ガル14 payload構築（pre_save_gate前確認用）
 *
 * 素材ファイル:
 *  - TSV: tsv_input/【自ガル14台本】100均ハイブリッド_20260507.tsv
 *  - 概要欄: Obsidian/【自ガル14】概要欄.md
 *  - 固定コメント: Obsidian/【自ガル14】固定コメント.md
 *  - メタタグ: Obsidian/【自ガル14】メタタグ.md
 *  - ワーカーメッセージ: Obsidian/【自ガル14】ワーカーメッセージ.md
 *  - 商品リスト: Obsidian/【自ガル14】商品リスト.md
 *
 * 出力: save_payload_gal14.json
 *
 * 注意:
 *  - 100均商品本体は楽天/Amazon直販なし。
 *    概要欄/固定コメに本家「類似品参考」アフィリンクを織り込む運用。
 *  - productList は本家類似品（Amazon/楽天両方アフィリンクあり）で構築。
 */
import { readFile, writeFile } from 'fs/promises';

const ROOT = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool';
const OBS_ROOT = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本';

const tsvPath        = `${ROOT}/tsv_input/【自ガル14台本】100均ハイブリッド_20260507.tsv`;
const descPath       = `${OBS_ROOT}/【自ガル14】概要欄.md`;
const pinPath        = `${OBS_ROOT}/【自ガル14】固定コメント.md`;
const metaPath       = `${OBS_ROOT}/【自ガル14】メタタグ.md`;
const workerPath     = `${OBS_ROOT}/【自ガル14】ワーカーメッセージ.md`;
const productMdPath  = `${OBS_ROOT}/【自ガル14】商品リスト.md`;

// ── 1. TSV (台本) ───────────────────────────────────────────────────────
const script = await readFile(tsvPath, 'utf8');

// ── 2. 概要欄 ───────────────────────────────────────────────────────────
// 概要欄.md は素のテキスト。先頭行はタイトルなので除外して本文だけ抽出。
const descRaw = await readFile(descPath, 'utf8');
const descBlock = descRaw.trim();

// ── 3. 固定コメント ─────────────────────────────────────────────────────
const pinRaw = await readFile(pinPath, 'utf8');
const pinBlock = pinRaw.trim();

// ── 4. メタタグ ─────────────────────────────────────────────────────────
// メタタグ.md は frontmatter + 「1. ガルちゃんまとめ」等。番号付きリストを抽出してカンマ区切りに。
const metaRaw = await readFile(metaPath, 'utf8');
const metaItems = [];
for (const line of metaRaw.split('\n')) {
  const m = line.match(/^\d+\.\s+(.+?)\s*$/);
  if (m) metaItems.push(m[1].trim());
  if (metaItems.length >= 5) break;
}
const metaBlock = metaItems.join(',');

// ── 5. ワーカーメッセージ ───────────────────────────────────────────────
const workerRaw = await readFile(workerPath, 'utf8');
const workerBlock = workerRaw.trim();

// ── 6. 商品リスト (商品リスト.md から本家類似品アフィリンクを抽出) ──────
// 商品リスト.md は「## #1: ...」「Amazonリンク（本家）: https://...」「楽天: https://...」形式。
// 100均商品本体には楽天/Amazon直販がないため、本家類似品アフィリンクを採用する。
const productRaw = await readFile(productMdPath, 'utf8');

// 各「## #N: 商品名」セクションを切り出して、本家アフィリンクを取得する
const productSections = productRaw.split(/^##\s+#\d+:\s+/m).slice(1);
const productList = [];

// 本家品のアフィリンクをハードコード抽出（商品リスト.md記載のものを採用）
// 100均商品10個に対して、それぞれ本家類似品のAmazon/楽天両方リンクを設定
const productMapping = [
  {
    name: 'ダイソー ステンレスボトル720mL（本家サーモス類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/dp/B0D9XXQSM6?tag=garuchannel22-22',
    rakutenLink: 'https://item.rakuten.co.jp/irodorikukan/40210435/',
  },
  {
    name: 'ダイソー D-TRAX 知育パーツ',
    amazonLink: 'https://www.amazon.co.jp/s?k=%E3%83%94%E3%82%BF%E3%82%B4%E3%83%A9%E3%82%B9%E3%82%A4%E3%83%83%E3%83%81+%E3%82%B3%E3%83%BC%E3%82%B9&tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E3%83%94%E3%82%BF%E3%82%B4%E3%83%A9%E3%82%B9%E3%82%A4%E3%83%83%E3%83%81%20%E3%82%B3%E3%83%BC%E3%82%B9/',
  },
  {
    name: 'ダイソー 流せるトイレブラシ（本家スクラビングバブル類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/s?k=%E3%82%B9%E3%82%AF%E3%83%A9%E3%83%93%E3%83%B3%E3%82%B0%E3%83%90%E3%83%96%E3%83%AB+%E6%B5%81%E3%81%9B%E3%82%8B%E3%83%88%E3%82%A4%E3%83%AC%E3%83%96%E3%83%A9%E3%82%B7&tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E3%82%B9%E3%82%AF%E3%83%A9%E3%83%93%E3%83%B3%E3%82%B0%E3%83%90%E3%83%96%E3%83%AB+%E6%B5%81%E3%81%9B%E3%82%8B%E3%83%88%E3%82%A4%E3%83%AC%E3%83%96%E3%83%A9%E3%82%B7/',
  },
  {
    name: 'セリア 透明になるペン型のり（本家トンボ消えいろピット類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/dp/B0016GF5T8?tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E6%B6%88%E3%81%88%E3%81%84%E3%82%8D%E3%83%94%E3%83%83%E3%83%88+%E7%B4%B0%E5%A1%97%E3%82%8A/',
  },
  {
    name: 'セリア リボン×パール ヘアアクセ（お呼ばれ用類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/s?k=%E3%81%8A%E5%91%BC%E3%81%B0%E3%82%8C+%E3%83%98%E3%82%A2%E3%82%A2%E3%82%AF%E3%82%BB+%E3%83%91%E3%83%BC%E3%83%AB+%E3%83%AA%E3%83%9C%E3%83%B3&tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E3%81%8A%E5%91%BC%E3%81%B0%E3%82%8C%20%E3%83%98%E3%82%A2%E3%82%A2%E3%82%AF%E3%82%BB%20%E3%83%91%E3%83%BC%E3%83%AB%20%E3%83%AA%E3%83%9C%E3%83%B3/',
  },
  {
    name: 'ダイソー リフレッシュボール（本家トリガーポイントMB1類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/dp/B07SVNWLF1?tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E3%83%88%E3%83%AA%E3%82%AC%E3%83%BC%E3%83%9D%E3%82%A4%E3%83%B3%E3%83%88+%E3%83%9C%E3%83%BC%E3%83%AB+MB1/',
  },
  {
    name: 'ダイソー シャワードリップ（本家ハリオV60類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/s?k=%E3%83%8F%E3%83%AA%E3%82%AA+V60+%E3%83%89%E3%83%AA%E3%83%83%E3%83%91%E3%83%BC&tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E3%83%8F%E3%83%AA%E3%82%AA+V60+%E3%83%89%E3%83%AA%E3%83%83%E3%83%91%E3%83%BC/',
  },
  {
    name: 'ダイソー ゴミ袋ホルダー45L（本家山崎実業tower類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/dp/B0BD7JLMNN?tag=garuchannel22-22',
    rakutenLink: 'https://item.rakuten.co.jp/yamayuu/yj-5838/',
  },
  {
    name: 'ダイソー シリコーンおにぎりパック（市販類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/s?k=%E3%82%B7%E3%83%AA%E3%82%B3%E3%83%BC%E3%83%B3+%E3%81%8A%E3%81%AB%E3%81%8E%E3%82%8A+%E3%83%91%E3%83%83%E3%82%AF&tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E3%82%B7%E3%83%AA%E3%82%B3%E3%83%BC%E3%83%B3+%E3%81%8A%E3%81%AB%E3%81%8E%E3%82%8A+%E3%83%91%E3%83%83%E3%82%AF/',
  },
  {
    name: 'ダイソー 幼児用知育ドリル（くもん/学研類似品参考）',
    amazonLink: 'https://www.amazon.co.jp/s?k=%E3%81%8F%E3%82%82%E3%82%93+%E3%81%B2%E3%82%89%E3%81%8C%E3%81%AA+%E3%83%89%E3%83%AA%E3%83%AB+%E5%B9%BC%E5%85%90&tag=garuchannel22-22',
    rakutenLink: 'https://search.rakuten.co.jp/search/mall/%E3%81%8F%E3%82%82%E3%82%93+%E3%81%B2%E3%82%89%E3%81%8C%E3%81%AA+%E3%83%89%E3%83%AA%E3%83%AB+%E5%B9%BC%E5%85%90/',
  },
];

for (const m of productMapping) {
  productList.push({
    name: m.name,
    category: 'ポジ',
    scriptQuote: '',
    amazonLink: m.amazonLink,
    rakutenLink: m.rakutenLink,
  });
}

// ── 7. payload構築 ──────────────────────────────────────────────────────
const payload = {
  topic: {
    title: '【知らないと損】40代以降が100均で買ってる危ない商品10選＋本当に買うべき神商品10選（消費者庁回収/MG66発火/マザーズ大賞）【有益ガルちゃん】',
    description: 'ダイソー・セリアで実際に回収・規制された危ない商品10選と、110円〜770円で買って正解の神商品10選をハイブリッドでまとめた、消費者庁・経産省・厚労省ベースの公的機関警告×100均の家庭の知恵×ハイブリッド10NG+10OK型',
    angle: '消費者庁・経産省・厚労省警告ベース×100均で買って正解の神商品10×ハイブリッド10NG+10OK',
    emotionWords: ['消費者庁', 'リコール', '回収', '神商品', 'マザーズ大賞'],
    source: 'ガルちゃんスレ + 消費者庁/国民生活センター/経済産業省/厚生労働省 + 各メーカー公式',
    category: '注意喚起×代替ハイブリッド型(100均特化)',
  },
  style: 'product',
  script,
  materials: {
    titles: [
      '【知らないと損】40代以降が100均で買ってる危ない商品10選＋本当に買うべき神商品10選（消費者庁回収/MG66発火/マザーズ大賞）【有益ガルちゃん】',
    ],
    thumbnails: [
      '上段: 知らないと損 / 下段: 100均の危ない物と神商品 / 白枠1: 消費者庁が67,817台回収 / 白枠2: マザーズ大賞2021受賞 / 白枠3: 770円で本家3000円超え / 白枠4: 110円のあのドリル',
    ],
    description: descBlock,
    metaTags: metaBlock,
    pinComment: pinBlock,
    workerMessage: workerBlock,
    productList,
    serialNumber: '【自ガル14】',
    managementMemo: '【企画理由】消費者庁/国民生活センター/経産省/厚労省の公的機関警告と、100均で買って正解の神商品10選のハイブリッド型。買って後悔シリーズに連なる検索流入と、神商品10選で実用情報も満たす両軸構成。\n【セッション記録】2026-05-07ネタ確定→台本完成、2026-05-09スプシ保存実行。\n【媒体】ガルちゃんスレ + 消費者庁リコール情報サイト + 国民生活センター + 経済産業省 + 厚生労働省ポジティブリスト + 各メーカー公式発表。\n【競合】100均失敗系チャンネルの「危ない100均」系動画と、神商品10選チャンネルのレビュー動画を統合差別化したハイブリッド型ポジショニング。',
  },
};

// ── 8. 保存 ─────────────────────────────────────────────────────────────
const outPath = `${ROOT}/save_payload_gal14.json`;
await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');

console.log(`✅ payload保存: ${outPath}`);
console.log(`   productList: ${productList.length}件`);
console.log(`   description: ${descBlock.length}字`);
console.log(`   pinComment: ${pinBlock.length}字`);
console.log(`   workerMessage: ${workerBlock.length}字`);
console.log(`   metaTags: ${metaBlock}`);
console.log(`   script: ${script.length}字 (${script.split('\n').length}行)`);
