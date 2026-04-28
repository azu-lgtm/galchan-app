#!/usr/bin/env node
/**
 * スプシ保存前の機械チェックゲート（galchan + health 共用）
 *
 * 使い方:
 *   node pre_save_gate.mjs <payload.json> [--channel=galchan|health]
 *
 * 1つでもチェック失敗なら exit 1。
 * ユーザー「二度とミスが起こらないように構築しろ」（2026-04-20）に対する恒久対策。
 */
import { readFile } from 'fs/promises';

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/,
  /\[\s*\]/,              // [] 空角括弧
  /{\s*}/,                 // {} 空波括弧
  /※.*ログ$/m,
  /※.*作業用/,
  /※.*ワーカー用/,
  /※.*外注さん用/,
  /^##\s*動画のポイント\s*$/m,
  /プレースホルダー/,
  /<placeholder>/i,
  /（ここから.*貼り付け）/,
  /\{\{.*\}\}/,
  /^---\ndate:/m,  // YAML frontmatter混入
  /^tags:\s*\[/m,  // frontmatter tags残り
];

const LOG_SECTION_PATTERNS = [
  /##\s*実行ゲート通過ログ/,
  /##\s*競合トーン分析レポート/,
  /##\s*薬機法チェック記録/,
  /##\s*エビデンス出典メモ/,
  /##\s*C005事実裏取り/,
  /##\s*バリデーション/,
];

const GARBLED_CHARS = /[\u0300-\u036F\uE000-\uF8FF]|[ŋɂ]/; // 結合文字・私用領域・典型ゴミ字

function fail(label, detail) {
  console.error(`❌ FAIL: ${label}`);
  if (detail) console.error(`   詳細: ${detail}`);
  process.exit(1);
}

function pass(label) {
  console.log(`✅ ${label}`);
}

async function main() {
  const payloadPath = process.argv[2];
  const channel = (process.argv.find(a => a.startsWith('--channel=')) || '--channel=galchan').split('=')[1];
  if (!payloadPath) fail('payload path required', 'node pre_save_gate.mjs <payload.json>');

  const raw = await readFile(payloadPath, 'utf8');
  const payload = JSON.parse(raw);

  console.log(`\n🔒 Pre-save Gate [${channel}] ${payloadPath}`);

  // ─── 共通 ───
  const materials = payload.materials || payload;
  const script = payload.script;

  // 0. 強制テンプレファイルRead確認（ガル/健康両方）
  const { readFile: _rf } = await import('fs/promises');
  const templateFiles = channel === 'galchan' ? [
    'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/ガル概要欄固定文.md',
    'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/DB/rules/ワーカーメッセージテンプレ.md',
  ] : [
    'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/健康雑学/DB/rules/ワーカーメッセージテンプレ.md',
  ];
  for (const tf of templateFiles) {
    try {
      await _rf(tf, 'utf8');
      pass(`テンプレファイル存在確認: ${tf.split('/').pop()}`);
    } catch {
      fail(`テンプレファイル読込失敗: ${tf}`, 'このファイルが存在してRead可能でないと保存できない');
    }
  }

  // 1. workerMessage 必須
  if (!materials.workerMessage && !payload.workerInstructions) {
    fail('workerMessage/workerInstructions', '空または未設定');
  }
  pass('workerMessage/workerInstructions 非空');

  // 1.5 健康: ワーカーメッセージがスリム版テンプレ準拠か
  if (channel === 'health') {
    const wm = payload.workerMessage || '';
    if (wm && !/この度はご契約ありがとうございます/.test(wm)) {
      fail('健康ワーカーメッセージがスリム版テンプレ未準拠', 'DB/rules/ワーカーメッセージテンプレ.mdの「この度はご契約ありがとうございます。...」形式必須');
    }
    if (wm) pass('健康ワーカーメッセージ スリム版テンプレ準拠');
  }

  // 1.6 ガル: ワーカーメッセージがスリム版テンプレ準拠か（2026-04-21更新・両ch統一）
  if (channel === 'galchan') {
    const wm = materials.workerMessage || '';
    // 自作独自構造NG
    if (wm && /## 編集メモ|### テンポ|### BGM指示/.test(wm)) {
      fail('ガル ワーカーメッセージに自作独自構造混入', '「## 編集メモ」「### テンポ」等NG');
    }
    // スリム版テンプレ必須文言
    if (wm && !/この度はご契約ありがとうございます/.test(wm)) {
      fail('ガル ワーカーメッセージがスリム版未準拠', 'DB/rules/ワーカーメッセージテンプレ.md「この度はご契約ありがとうございます。」必須');
    }
    if (wm && !/あずき\s*$/m.test(wm)) {
      fail('ガル ワーカーメッセージに署名「あずき」なし', '最終行に署名「あずき」必須');
    }
    // 長文版の禁止パターン（自ガル9型）
    if (wm && /納期は本日より\d+日後/.test(wm)) {
      fail('ガル ワーカーメッセージに納期の長文明記混入', 'スリム版では納期はチャットワーク固定タスクで管理・メッセージに直記載NG');
    }
    if (wm && /https:\/\/xgf\.nu|パスワード：?\d+/.test(wm)) {
      fail('ガル ワーカーメッセージにギガファイル便URL/パスワード混入', 'スリム版ではチャットワーク固定タスク参照・直記載NG');
    }
    if (wm && /♢/.test(wm)) {
      fail('ガル ワーカーメッセージに素材一覧列挙混入', '「♢テンプレプロジェクトファイル」等の列挙NG・チャットワーク一元管理');
    }
    if (wm && /マニュアル\s*（Google ドキュメント）/.test(wm)) {
      fail('ガル ワーカーメッセージにマニュアルURL直接記載混入', 'スリム版ではチャットワーク固定タスク参照・直記載NG');
    }
    if (wm) pass('ガル ワーカーメッセージ スリム版テンプレ準拠');
  }

  // 2. description プレースホルダー・ログ残りチェック
  const desc = materials.description || payload.description || '';
  if (!desc) fail('description', '空');
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.test(desc)) fail('description プレースホルダー残存', p.toString());
  }
  if (GARBLED_CHARS.test(desc)) fail('description 文字化け', 'ŋ ɂ □ 等検出');
  pass('description プレースホルダー/文字化けなし');

  // 3. pinComment 同チェック
  const pin = materials.pinComment || payload.pinComment || '';
  if (!pin) fail('pinComment', '空');
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.test(pin)) fail('pinComment プレースホルダー残存', p.toString());
  }
  pass('pinComment プレースホルダーなし');

  // 3.1 ガル固定コメント禁止フレーズ
  if (channel === 'galchan') {
    if (/ブランド一覧|動画内で紹介した.*ブランド/.test(pin)) fail('固定コメントにブランド一覧混入', 'ユーザー指示「コメント誘導のみ」違反');
    if (/次回は/.test(pin)) fail('固定コメントに次回予告混入', 'ユーザー指示「次回予告削除」違反');
    pass('固定コメント 禁止フレーズなし');
  }

  // 3.5 概要欄5000字以内チェック
  if (desc.length > 5000) {
    fail('description 文字数超過', `${desc.length}字 > 5000字上限`);
  }
  pass(`description 文字数 ${desc.length}字 ≤ 5000字`);

  // 3.54 ガル: ネガ訴求時の免責文言必須
  if (channel === 'galchan') {
    const hasNegPush = /絶対買うな|やめろ|危険な|ゾッとした|暴露|告発|警告|禁止/.test(desc) ||
                       /絶対買うな|やめろ|危険な|告発/.test((payload.materials?.titles || []).join(' '));
    if (hasNegPush) {
      if (!/個人の感想|貶める目的|貶める意図|攻撃する意図/.test(desc)) {
        fail('ガル概要欄: ネガ訴求時の免責文言欠落', '「個人の感想」「貶める目的ではなく」等の免責必須');
      }
      pass('ガル ネガ訴求時の免責文言あり');
    }
    // Amazonアソシエイト表記
    const hasAffiliate = /tag=garuchannel22-22|amazon\.co\.jp.*tag=/.test(desc);
    if (hasAffiliate) {
      if (!/Amazonアソシエイト|Amazon アソシエイト/.test(desc)) {
        fail('Amazonアソシエイト表記欠落', 'アフィリンクあり・「Amazonアソシエイトとして...適格販売により収入」必須');
      }
      pass('Amazonアソシエイト表記あり');
    }
  }

  // 3.54b Q列メモ形式チェック（ガル）
  if (channel === 'galchan' && materials.managementMemo) {
    const memo = materials.managementMemo;
    const required = ['企画理由', 'セッション記録', '媒体', '競合'];
    for (const r of required) {
      if (!memo.includes(`【${r}】`)) {
        fail(`Q列メモ構成違反`, `【${r}】ラベル欠落・企画理由/セッション記録/媒体/競合の4項目必須`);
      }
    }
    // 内部略語混入チェック
    if (/\bC00[0-9]\b|\bS0\d{2}\b|\bT0\d{2}\b/.test(memo)) {
      fail(`Q列メモに内部略語混入`, 'C005/S015/T001等の内部knowledge番号はユーザー視点で不明瞭・削除必須');
    }
    pass('Q列メモ 4項目ラベル+略語なし');
  }

  // 3.55 ガル固定文テンプレ遵守チェック
  if (channel === 'galchan') {
    const requiredPhrases = [
      'girlschannel.net',
      '・買って後悔した商品',
      '・やらなくて正解だった習慣',
      '使用音声：VOICEVOX',
      'DOVA-SYNDROME',
      'いらすとや',
    ];
    const forbidden = [/権威機関情報/, /期間限定情報/, /検疫機関/];
    for (const p of requiredPhrases) {
      if (!desc.includes(p)) fail('ガル概要欄固定文テンプレ未使用', `必須文言「${p}」欠落・ガル概要欄固定文.md一字一句コピー必須`);
    }
    for (const p of forbidden) {
      if (p.test(desc)) fail('概要欄に自作発明文言混入', `${p.toString()} - 固定文以外の勝手文言禁止`);
    }
    pass('ガル概要欄固定文テンプレ遵守');
  }

  // 3.6 タイムスタンプ混入チェック（健康の固定コメント/ワーカー指示）
  if (channel === 'health') {
    const tsPattern = /\b\d{1,2}:\d{2}\b/;
    if (tsPattern.test(pin)) fail('pinComment にタイムスタンプ', '健康chは0:00等のタイムスタンプ不要');
    if (tsPattern.test(payload.workerInstructions || '')) fail('workerInstructions にタイムスタンプ', '健康chは0:00等のタイムスタンプ不要');
    pass('pinComment/workerInstructions タイムスタンプなし');
  }

  // 4. 台本本文のログセクション混入チェック
  if (script) {
    for (const p of LOG_SECTION_PATTERNS) {
      if (p.test(script)) fail('script ログセクション混入', `${p.toString()} が台本本文に含まれている`);
    }
    pass('script ログセクション混入なし');

    // 5. 冒頭S015混入チェック（ガルのみ）
    if (channel === 'galchan') {
      const firstLines = script.split('\n').slice(0, 5).join('\n');
      if (/悪いのは.*あなたじゃ(なくて|ない)/.test(firstLines)) {
        fail('台本冒頭5行にS015責任転嫁出口混入', '「悪いのはあなたじゃなくて」は冒頭NG・エンディングのコメント誘導に移動せよ');
      }
      pass('台本冒頭5行にS015混入なし');
    }
  }

  // 6. ガル: thumbnails は上段/下段/白枠1-4 の6項目必要
  if (channel === 'galchan') {
    const thumbs = materials.thumbnails || [];
    if (!Array.isArray(thumbs) || thumbs.length < 1) fail('thumbnails 空');
    const thumbStr = thumbs.join(' ');
    const hasAllParts = /上段|下段|白枠/.test(thumbStr) || thumbs.length >= 6;
    if (thumbs.length === 1) {
      // 単一文字列で上段/下段/白枠4枚の情報が含まれているかチェック
      const parts = thumbs[0].split(/\s*\/\s*|\n/);
      if (parts.length < 6) {
        fail('thumbnails 構成不完全', `上段/下段/白枠4枚の6要素必要・現在${parts.length}要素: ${thumbs[0]}`);
      }
    } else if (thumbs.length < 6 && !hasAllParts) {
      fail('thumbnails 構成不完全', '上段/下段/白枠4枚の計6要素が必要');
    }
    pass('thumbnails 6要素（上段/下段/白枠1-4）チェック');
  }

  // 6.5 健康: サムネはメイン+左上のシンプル構造のみ・ガル白枠4枚NG（2026-04-21追加）
  if (channel === 'health') {
    const thumbs = (payload.thumbnailTexts || materials.thumbnails || []);
    const thumbText = Array.isArray(thumbs) ? thumbs.join(' ') : String(thumbs || '');
    if (thumbText) {
      // ガル仕様の白枠4枚パターン混入NG
      if (/白枠[1-4]|whitebox[1-4]/i.test(thumbText)) {
        fail('健康サムネにガル仕様の「白枠1-4」混入', '健康chサムネは「メイン+左上サブ」のシンプル構造のみ・サムネタイトルルール.md 11章準拠');
      }
      // 「上段/下段」のガル特有のラベル混入もNG（健康の左上/メインとは違う）
      if (/上段[:：]/.test(thumbText) && /下段[:：]/.test(thumbText) && /白枠/.test(thumbText)) {
        fail('健康サムネにガル仕様の「上段/下段/白枠」構造混入', '健康chは「メイン文言+左上サブ訴求」のみ');
      }
      pass('健康サムネ ガル白枠混入なし（シンプル構造準拠）');
    }
  }

  if (channel === 'galchan') {

    // 7. ガル: productList はポジ商品のみ・アフィリンク必須
    const products = materials.productList || [];
    const negProducts = products.filter(p => (p.category || '').includes('ネガ'));
    if (negProducts.length > 0) {
      fail('productList にネガ商品混入', `商品リストはポジ商品のみ。ネガ${negProducts.length}件混入（例: ${negProducts[0].name}）`);
    }
    const posProducts = products.filter(p => (p.category || '').includes('ポジ'));
    if (posProducts.length > 0) {
      for (const p of posProducts) {
        if (!p.amazonLink && !p.rakutenLink) {
          fail('productList ポジ商品のアフィリンク空', `${p.name} にアフィリンクなし`);
        }
      }
      pass(`productList ポジ${posProducts.length}件のみ・全件アフィリンク設定済`);
    }

    // 7.1 🆕 概要欄アフィリンク密度チェック（2026-04-24追加・自ガル11事故受け）
    if (products.length > 0 && desc) {
      const affiliateCount = (desc.match(/tag=garuchannel22-22/g) || []).length;
      const expectedMin = Math.floor(products.length * 0.8);
      if (affiliateCount < expectedMin) {
        fail(`概要欄アフィリンク件数不足`, `concat=${affiliateCount}件 < productList${products.length}件の80%=${expectedMin}件。アフィリンク抜け事故防止`);
      }
      pass(`概要欄アフィリンク ${affiliateCount}件 >= 閾値${expectedMin}件（productList80%）`);
    }

    // 7.2 🆕 固定コメント Amazon+楽天ペア確認（2026-04-24追加）
    if (pin) {
      const amazonCount = (pin.match(/amazon\.co\.jp/g) || []).length;
      const rakutenCount = (pin.match(/rakuten\.co\.jp/g) || []).length;
      if (amazonCount < 10) {
        fail('固定コメント Amazonリンク不足', `${amazonCount}件 < 最低10件・固定コメントは商品紹介の集約場所`);
      }
      if (rakutenCount < amazonCount * 0.5) {
        fail('固定コメント 楽天リンク不足', `楽天${rakutenCount}件 < Amazon${amazonCount}件の半分。両方並列で並べる運用`);
      }
      pass(`固定コメント Amazon${amazonCount}件+楽天${rakutenCount}件 ペア設置済`);
    }

    // 7.3 🆕 ワーカーメッセージにプレースホルダー残存検出（2026-04-25 WARN化）
    // 保存前の段階では新スプシURLが未確定なので、プレースホルダーは想定内。
    // 保存後の update-materials API（src/lib/google.ts）で実URLに上書きする運用前提。
    // ⚠️ ただし、保存後に必ずN列ワーカーメッセージを実URLで差替えること。
    if (materials.workerMessage) {
      if (/\{SPREADSHEET_URL\}|\{\{.*\}\}|\{[A-Z_]+\}/.test(materials.workerMessage)) {
        console.log('⚠️ 警告: workerMessage にプレースホルダー残存（{SPREADSHEET_URL}等）。保存後の update-materials で実URLに上書き必須・放置NG');
      } else {
        pass('workerMessage プレースホルダー残存なし');
      }
    }
  }

  // 7.5 健康: 固定コメント構造（外健44/45準拠テンプレ）
  if (channel === 'health') {
    if (!/【質問と補足】|【質問】/.test(pin)) {
      fail('固定コメント構造違反', '【質問と補足】見出し必須（外健44/45正規テンプレ）');
    }
    if (!/【[^】]+】\s*\n\s*[①❶1]/.test(pin) && !/【[^】]+】\n[・■]/.test(pin)) {
      fail('固定コメント構造違反', '【動作名】+①/②手順箇条書き形式必須（外健44/45正規テンプレ）');
    }
    pass('固定コメント 外健44/45正規テンプレ準拠');
  }

  // 7.6 健康: サムネ数字と台本整合（秒/分/回）+ 合計時間計算
  if (channel === 'health' && script) {
    // サムネ本体のみ検査（関連動画リストは除外）
    const thumbText = (payload.thumbnailTexts || []).join(' ');
    const thumbNums = [...thumbText.matchAll(/(\d+)\s*(秒|分|回)/g)];
    for (const m of thumbNums) {
      const [full, num, unit] = m;
      const pattern = new RegExp(`${num}\\s*${unit}`);
      if (!pattern.test(script)) {
        fail(`サムネ「${full}」が台本本文に見つからない`, '外健57批判の再発防止・サムネと台本の数字整合必須');
      }
    }

    // サムネが「○分」の場合、台本に「合計○分」等の明示があるか確認
    const thumbMinutes = thumbText.match(/(\d+)\s*分/);
    if (thumbMinutes) {
      const target = thumbMinutes[1];
      const totalPattern = new RegExp(`(?:合計|およそ|約)\\s*${target}\\s*分|${target}\\s*分で(?:合計|完結|完了|終わる|できる)`);
      if (!totalPattern.test(script)) {
        fail(`サムネ「${target}分」と台本内の合計時間明示が一致しない`, `台本に「合計${target}分」「およそ${target}分」「約${target}分」等の明示必須`);
      }
      pass(`サムネ${target}分 ⇔ 台本合計${target}分 明示あり`);

      // 台本内部計算の整合チェック: 実測 <= サムネ値（超えたらFAIL）
      // 基本段階（1段目）のみを対象にする。2段目/3段目はオプション扱いで合算しない
      const targetSeconds = parseInt(target) * 60;
      // 【基本のやり方】セクションのみ抽出（2段目/3段目は除外）
      const basicMatch = script.match(/【基本のやり方】([\s\S]*?)(?=【(?:もっと効果|もっと負荷|より効果|より負荷|よくある間違い|続けるコツ|1週間|始める前|実践|応用|ステップアップ)|\Z)/);
      const basicSection = basicMatch ? basicMatch[1] : script;
      let calcSec = 0;
      const keepPattern = /(\d+)\s*秒(?:キープ|止める|×左右)/g;
      for (const m of basicSection.matchAll(keepPattern)) calcSec += parseInt(m[1]) * 2;
      const repPattern = /(?:右|左右)\s*(\d+)\s*回[、。\s]*左?(?:\s*(\d+)\s*回)?/g;
      for (const m of basicSection.matchAll(repPattern)) {
        const right = parseInt(m[1]);
        const left = m[2] ? parseInt(m[2]) : right;
        calcSec += (right + left) * 2; // 2秒/回
      }
      if (calcSec > 0) {
        if (calcSec > targetSeconds) {
          fail(`台本基本段実測(${calcSec}秒)がサムネ約束(${target}分=${targetSeconds}秒)を超過`, '視聴者裏切り防止・基本段階の実測≤サムネ時間 必須。2段目/3段目は対象外');
        }
        pass(`台本基本段実測 ${calcSec}秒 ≤ サムネ${target}分=${targetSeconds}秒（${targetSeconds - calcSec}秒余裕）`);
      }
    }

    // サムネに「およそ」「約」混入チェック
    if (/およそ|約\s*\d/.test(thumbText)) {
      fail('サムネに「およそ/約」混入', 'サムネは明確な数値のみ（「2分」「30秒」等）・ぼかし表現NG');
    }
    pass('サムネ 「およそ/約」混入なし');
  }

  // 7.7 健康: 有名人引用時の出典表記チェック
  if (channel === 'health' && script) {
    const celebs = ['大谷翔平', 'イチロー', '白鵬', '内村航平', '羽生結弦', '福原愛', '元一ノ矢', '井上尚弥', '為末大', '美木良介', '小林弘幸', 'なかやまきんにくん', 'ケンハラクマ'];
    const foundCelebs = celebs.filter(c => script.includes(c));
    if (foundCelebs.length > 0) {
      const sourcePatterns = [/によると/, /書籍/, /記事/, /インタビュー/, /発言/, /分析/];
      const hasSource = sourcePatterns.some(p => p.test(script));
      if (!hasSource) {
        console.log(`⚠️ 警告: 有名人引用（${foundCelebs.join(',')}）あるが出典表記（○○によると/書籍/記事等）が不足・外健57批判「書籍の丸コピー」再発防止`);
      } else {
        pass(`有名人引用 ${foundCelebs.length}名・出典表記あり`);
      }
    }
  }

  // 8. 健康: 台本末尾にワーカー向け商品リストがあるか（商品メンション時）
  // 🆕 2026-04-25 修正: 「マッサージ」単独（比喩・行為）は商品扱いせず、合成語（マッサージ機/ガン/クッション/器/ローラー/ベッド/ボール/スティック/ピロー/チェア）のみ商品とみなす
  if (channel === 'health' && script) {
    const hasProductMentions = /ストレッチポール|骨盤底筋|ヨガマット|バランスディスク|ダンベル|サポーター|(?<![腸内|肌|首|肩|腰|脚|足|筋肉|顔|頭|背中|お腹|胃])クッション(?:カバー)?|マッサージ(?:機|ガン|チェア|クッション|器|ローラー|ベッド|ボール|スティック|ピロー)/.test(script);
    const hasWorkerProductList = /▼今回ご紹介・関連アイテム|▼関連アイテム|ワーカー.*商品リスト/.test(script) ||
                                  /▼今回ご紹介・関連アイテム|▼関連アイテム/.test(desc);
    if (hasProductMentions && !hasWorkerProductList) {
      fail('健康台本/概要欄にワーカー向け商品リストなし', '商品メンションあり・末尾にアフィリンク付き商品リスト必須');
    }
    pass('健康台本/概要欄 ワーカー向け商品リストチェック（マッサージ比喩・クッション単独は除外）');
  }

  // ═══ 9. 冒頭専用ゲート（2026-04-21追加）═══
  if (script) {
    const scriptLines = script.split('\n').filter(l => l.trim());

    // 9.1 冒頭3行型（健康のみ）: 開始6行以内に共感表現
    if (channel === 'health') {
      const sympathyPatterns = [/気持ち[^。]*わかる/, /同じ[^。]*だった/, /同じ[^。]*悩/, /同じ[^。]*経験/, /同じ[^。]*来た/];
      const firstSixLines = scriptLines.slice(0, 6).join('\n');
      const hasSympathy = sympathyPatterns.some(p => p.test(firstSixLines));
      if (!hasSympathy) {
        fail('冒頭6行以内に共感表現なし', '台本ルールL205-208 冒頭3行型: 自分事化→共感（気持ちわかる/同じだった等）→自分語り必須');
      }
      pass('冒頭6行以内に共感表現あり');

      // 9.2 60秒以内本題（健康のみ）: 冒頭から【見出し】までが500字以内
      const firstSectionIdx = script.indexOf('【');
      if (firstSectionIdx > 0) {
        const openingText = script.slice(0, firstSectionIdx);
        const openingChars = openingText.replace(/\s/g, '').length;
        if (openingChars > 500) {
          fail(`冒頭から最初の【見出し】まで${openingChars}字（60秒=300字目安）超過`, '本題60秒以内ルール・長い前置きはNG・3回指摘済み');
        }
        pass(`冒頭から最初の【見出し】まで${openingChars}字（60秒以内相当）`);
      }
    }

    // 9.3 薬機法効能断定検出（緩和版・2026-04-25）
    // ❌ FAIL: 病気名+治療系（薬機法違反・確実NG）
    const diseaseEffectPattern = /(?:がん|癌|糖尿病|高血圧|うつ病|うつ|認知症|腰痛|膝痛|アルツハイマー)[^。]{0,30}(?:治っ|治る|根治|完治|降圧|解消|消えた|治療)(?!可能性|よう|と言われ|とされ|らしい|報告|話題|ことが|かもしれ)/g;
    const diseaseMatches = [...script.matchAll(diseaseEffectPattern)];
    if (diseaseMatches.length > 0) {
      const samples = diseaseMatches.slice(0, 3).map(m => m[0]).join(' / ');
      fail(`薬機法: 病気治療系断定 ${diseaseMatches.length}件`, `${samples}。安全表現に言い換え必須（治る→「変化を感じやすい」/降圧→「数値が落ち着いた」等）`);
    }
    pass('薬機法: 病気治療系断定なし');

    // ⚠ WARN: 症状語+断定（数字+伝聞なら除外）
    // 「研究で30%下がると報告」「○○4.8倍と話題」等は数字+伝聞でPASS
    const symptomBareAssertion = /(?<!研究で|報告では|データで|調査で|事例では)(?:中性脂肪|血糖値|血圧|コレステロール|認知機能|物忘れ)[^。]{0,15}(?:下がっ|下がる|正常範囲に戻)(?!\s*\d+%|\s*\d+割|可能性|よう|と言われ|とされ|報告|話題|ことが|かもしれ|傾向)/g;
    const symptomMatches = [...script.matchAll(symptomBareAssertion)];
    if (symptomMatches.length > 0) {
      const samples = symptomMatches.slice(0, 3).map(m => m[0]).join(' / ');
      console.log(`⚠️ 警告: 症状語+断定 ${symptomMatches.length}件・主語ずらし推奨（「研究で30%下がると報告」「○○と話題」等）: ${samples}`);
    } else {
      pass('薬機法: 症状語+断定（数字+伝聞なし）検出なし');
    }

    // 痩せる断定（緩和版・2026-04-25）
    // ❌ FAIL: 効果保証系（絶対○kg/必ず痩せる/劇的に痩せる）
    const dietGuarantee = /(?:絶対|必ず|確実に|劇的に|誰でも)\s*(?:痩せる|痩せた|\d+\s*(?:kg|キロ)\s*(?:痩せる|減る|落ちる))|(?:\d+\s*(?:kg|キロ)\s*(?:絶対|必ず|確実)に?\s*(?:痩せる|減る|落ちる))/g;
    const dietGuaranteeMatches = [...script.matchAll(dietGuarantee)];
    if (dietGuaranteeMatches.length > 0) {
      const samples = dietGuaranteeMatches.slice(0, 3).map(m => m[0]).join(' / ');
      fail(`薬機法: 痩せる効果保証 ${dietGuaranteeMatches.length}件`, `${samples}。「絶対○kg痩せる」等の効果保証はFAIL・「体重管理しやすい」等に言い換え必須`);
    }
    pass('薬機法: 痩せる効果保証なし');

    // ⚠ WARN: 痩せる単独（数字+伝聞なら除外・引用/CM文脈なら除外）
    const dietBare = /(?<!研究で|報告では|データで|事例では)(?:痩せる|痩せた|\-\d+\s*kg|\d+\s*キロ減|\d+\s*kg\s*落ち)(?!\s*\d+%|可能性|よう|と言われ|とされ|らしい|報告|話題|と感じ|ことが|かもしれ|傾向)/g;
    const dietMatches = [...script.matchAll(dietBare)];
    if (dietMatches.length > 0) {
      // ガルちゃんの食品詐欺など批判文脈で他社の広告文言引用する場合はOK（引用符内・CM/広告の文字列前後）
      const safeContext = dietMatches.filter(m => {
        const idx = m.index;
        const before = script.slice(Math.max(0, idx - 30), idx);
        const after = script.slice(idx + m[0].length, idx + m[0].length + 30);
        return /広告|CM|表示|うた|景表法|措置命令|宣伝|配信|テレビ|SNS/.test(before + after);
      });
      if (safeContext.length < dietMatches.length) {
        const unsafe = dietMatches.length - safeContext.length;
        console.log(`⚠️ 警告: 痩せる断定 ${unsafe}件（引用/批判文脈以外・数字+伝聞なし）・薬機法トーン注意。「研究で○%減と報告」「体重管理しやすい」等に言い換え推奨`);
      }
    }

    // 単独「効く」（緩衝語なし）
    const effectBare = /(?<!と言われ|とされ|らしい|かもしれ|と感じ|可能性|ない|ないって)効く(?!みたい|らしい|とされ|と言われ|かも)/g;
    const effectMatches = [...script.matchAll(effectBare)];
    if (effectMatches.length > 2) {
      console.log(`⚠️ 警告: 単独「効く」${effectMatches.length}件・緩衝語(らしい/とされ)なし・薬機法トーン注意`);
    }

    // 9.4 自分語り視点整合
    const oreCount = (script.match(/俺/g) || []).length;
    const shiriaiCount = (script.match(/知り合い/g) || []).length;
    if (oreCount > 0 && shiriaiCount > 0) {
      fail(`自分語り視点の複合「俺」${oreCount}+「知り合い」${shiriaiCount}`, '1台本につき「俺」or「知り合い」どちらか一方のみ・動画ごとに交互ローテ');
    }
    if (oreCount >= 3) {
      console.log(`⚠️ 警告: 「俺」${oreCount}回・多用注意（1-2回推奨・毎回俺だと信頼性低下）`);
    }
    if (oreCount === 1 || oreCount === 2 || shiriaiCount === 1 || shiriaiCount === 2) {
      pass(`自分語り視点 統一: 俺=${oreCount} / 知り合い=${shiriaiCount}（複合なし）`);
    }

    // 9.5 エンディング主語なしチェック（最終10行に俺/知り合い出現NG）
    const lastTenLines = scriptLines.slice(-10).join('\n');
    const endingOre = (lastTenLines.match(/俺/g) || []).length;
    const endingShiriai = (lastTenLines.match(/知り合い/g) || []).length;
    if (endingOre > 0 || endingShiriai > 0) {
      fail(`エンディング最終10行に自分語り「俺」${endingOre}+「知り合い」${endingShiriai}出現`, '台本ルールL177「説明パートでは消える・主語なしの断定文に切替」・エンディングは主語なし必須');
    }
    pass('エンディング主語なし（最終10行に俺/知り合いなし）');
  }

  // ═══ 10. 🆕 ガル台本 文字数+重複+整合性ゲート（2026-04-25追加・自ガル11 v8反省を機に）═══
  if (channel === 'galchan' && script) {
    const tsvLines = script.split('\n').filter(l => l.includes('\t'));

    // 10.1 1行70字上限・30字下限（イッチ・タイトル・ナレーション除く）
    // 2026-04-25 修正: ナレーションをも除外（イントロ「皆さんこんにちは！今回は、」13字、エンディング固定文「それではいってみよう！！」12字、「このチャンネルでは〜」26字 が誤FAIL扱いになる問題を修正）
    const tooLong = [];
    const tooShort = [];
    for (let i = 0; i < tsvLines.length; i++) {
      const parts = tsvLines[i].split('\t');
      const speaker = parts[0];
      const body = parts[1] || '';
      if (body.length > 70) tooLong.push({line: i + 1, speaker, len: body.length, body: body.slice(0, 50)});
      if (body.length < 30 && speaker !== 'イッチ' && speaker !== 'タイトル' && speaker !== 'ナレーション' && body.length > 0) {
        tooShort.push({line: i + 1, speaker, len: body.length, body});
      }
    }
    if (tooLong.length > 0) {
      const samples = tooLong.slice(0, 3).map(v => `L${v.line}[${v.speaker}]${v.len}字`).join(' / ');
      fail(`70字超え行 ${tooLong.length}件`, `${samples}。台本ルール「1行最大70字」厳守・分割必須`);
    }
    if (tooShort.length > 0) {
      const samples = tooShort.slice(0, 3).map(v => `L${v.line}[${v.speaker}]${v.len}字「${v.body}」`).join(' / ');
      fail(`30字未満行 ${tooShort.length}件（イッチ・タイトル除く）`, `${samples}。台本ルール「1行最低30字」厳守`);
    }
    pass(`ガル台本 文字数チェック (70字超: 0件 / 30字未満: 0件)`);

    // 10.2 重複フレーズ上限（台本臭防止）
    const dupRules = [
      {pattern: /売り場にいた頃|仕入れ担当の頃|20年働いた/g, max: 6, label: '元店員言及（売り場にいた頃/仕入れ担当の頃/20年働いた）'},
      {pattern: /SNSでも|インスタでも/g, max: 2, label: 'SNS証言（SNSでも/インスタでも）'},
      {pattern: /ママ友(の間)?でも|知り合いでも|同僚でも/g, max: 2, label: '周辺証言（ママ友/知り合い/同僚）'},
      {pattern: /家族にはすすめない|家族に絶対(使わせない|すすめない)/g, max: 3, label: '家族にはすすめない'},
      {pattern: /家族の命を守る最小投資|医療費より(?:よっぽど)?(?:高い|安い)/g, max: 3, label: '医療費・最小投資フレーズ'},
      {pattern: /値段は\s*[2-9]倍.*(?:結局)?(?:安い|お得)/g, max: 3, label: '値段は2倍だけど結局安い系'},
      // 🆕 2026-04-25 11:36ユーザー追加指摘・後半失速防止
      {pattern: /本当に(?:怖|油断|危ない|助かる|楽|泣ける|鳥肌|これだけは|やめにしよう|焦|痛|大事|ありがた|大変)/g, max: 3, label: '「本当に〜」系の連発（後半失速防止・3回まで・2026-04-25 11:36+競合分析を踏まえ厳格化）'},
      {pattern: /今夜.*(?:確認|見|チェック|見直し|まで|勝負|帰)|今日.*(?:帰ったら|チェック|確認|見直)/g, max: 3, label: '「今夜〜確認/今日帰ったら〜」系の行動喚起連発（サーキュレーター/LED/最後のまとめのみ）'},
      {pattern: /家族(?:の)?命(?!を守る最小投資)|家族を守る|家族みんな(?:を|で)?守|命に直結/g, max: 3, label: '「家族の命/家族を守る/命に直結」系派生（耐震/LED/サーキュレーターのみ）'},
    ];
    for (const r of dupRules) {
      const matches = [...script.matchAll(r.pattern)];
      if (matches.length > r.max) {
        fail(`重複フレーズ上限超過: ${r.label}`, `${matches.length}回出現 > 上限${r.max}回。台本臭防止のため分散・言い換え必須`);
      }
    }
    pass(`ガル台本 重複フレーズ上限チェック（${dupRules.length}パターン全て上限内）`);

    // 10.2c 同一煽り語3回上限（2026-04-25・競合分析準拠で新規）
    const sensationWords = ['怖い', '危ない', 'ヤバい', '危険', 'ゾッと', '震え', '鳥肌', '泣ける', '油断', '本当に怖'];
    const exceededWords = [];
    for (const word of sensationWords) {
      const matches = (script.match(new RegExp(word, 'g')) || []).length;
      if (matches > 3) {
        exceededWords.push(`${word}: ${matches}回`);
      }
    }
    if (exceededWords.length > 0) {
      fail(`同一煽り語3回上限超過`, `${exceededWords.join(' / ')}。競合分析（5/5本が3回まで）に合わせて厳格化・分散・言い換え必須`);
    }
    pass(`ガル台本 同一煽り語上限チェック（10語×各3回上限内）`);

    // 10.2b 素材断定NG（C4補強・2026-04-25 11:36指摘）
    const materialAssertions = [
      {pattern: /(?:杉|ヒノキ|国産材|国産木材|国産杉|国産ヒノキ).{0,15}(?:反らない|曲がらない|割れない|ぐらつかない)/g, label: '国産木材「反らない/曲がらない」断定NG（→「反りにくい」「ロットによって反ることもあるが少ない」等に置換）'},
      {pattern: /絶対(?:に)?(?:大丈夫|安全|安心|問題ない|失敗しない|壊れない|事故起き)/g, label: '「絶対大丈夫/絶対安全」断定NG（→「失敗しにくい」「安心して使える」等に置換）'},
      {pattern: /(?<![にも])(?:ビクともしない|びくともしない)/g, label: '「ビクともしない」断定NG（→「揺るぎなく使える」「長く使える」等に置換）'},
    ];
    for (const a of materialAssertions) {
      const matches = [...script.matchAll(a.pattern)];
      if (matches.length > 0) {
        const samples = matches.slice(0, 3).map(m => m[0]).join(' / ');
        console.log(`⚠️ 警告: ${a.label} - ${matches.length}件検出: ${samples}`);
      }
    }
    pass(`ガル台本 素材断定NG表現チェック（WARNモード）`);

    // 10.3 「代わりに何買えばいいの？」同形チェック（WARN）
    const alternativeQuestion = (script.match(/代わりに何買えばいいの？/g) || []).length;
    if (alternativeQuestion > 2) {
      console.log(`⚠️ 警告: 「代わりに何買えばいいの？」同形 ${alternativeQuestion}回・上限2回。残りはバリエーション化推奨（「じゃあ選ぶ時はどこ見ればいい？」「これ、今から買う人はどうすればいい？」等）`);
    }

    // 10.4 タイトル「〇〇選」と商品リスト件数整合
    // 2026-04-25 改修: ネガ訴求語（買うな/絶対買うな/ワースト/やめろ等）直前の数字は除外し、
    // ポジ訴求語直近の数字のみと商品リスト（ポジ）件数を比較する。
    // 「絶対買うな10選＋神商品まとめ」のような複合タイトルでネガ10vsポジ実件数のFAIL誤検出を防止。
    const titles = (materials.titles || []).join(' ');
    if (/(\d+)\s*選/.test(titles)) {
      const products = materials.productList || [];
      const posProducts = products.filter(p => (p.category || '').includes('ポジ'));

      // 「〇〇選」を全件抽出し、直前のネガ訴求語/ポジ訴求語を判定
      const NEG_TRIGGERS = /(?:買うな|絶対買うな|ワースト|やめろ|危険|捨てて|失敗|後悔|やめた方がいい|ダメ|NG)/;
      const POS_TRIGGERS = /(?:神|大正解|オススメ|おすすめ|買うべき|正解|ベスト|愛用|推し|本当に良い|本当にいい|名品|優秀)/;

      const titleNumWithCtx = [];
      const re = /(\d+)\s*選/g;
      let m;
      while ((m = re.exec(titles)) !== null) {
        const idx = m.index;
        const before = titles.slice(Math.max(0, idx - 25), idx);
        const isNeg = NEG_TRIGGERS.test(before);
        const isPos = POS_TRIGGERS.test(before);
        titleNumWithCtx.push({num: parseInt(m[1]), neg: isNeg, pos: isPos, ctx: before});
      }

      // ポジ訴求語直近の数字のみを抽出
      const posNums = titleNumWithCtx.filter(t => t.pos && !t.neg).map(t => t.num);
      // ポジでもネガでもない単独「〇〇選」も比較対象（旧仕様互換）
      const neutralNums = titleNumWithCtx.filter(t => !t.pos && !t.neg).map(t => t.num);
      const compareNums = posNums.length > 0 ? posNums : neutralNums;

      if (posProducts.length > 0 && compareNums.length > 0) {
        const mismatch = compareNums.filter(n => n !== posProducts.length);
        if (mismatch.length > 0) {
          fail(`タイトル数字「${mismatch.join('/')}選」と商品リスト件数（${posProducts.length}件）不一致`,
               'タイトル/概要欄/固定コメント/商品リストの4箇所一致必須・ネガ訴求語直前の数字は除外済み');
        }
      }
      pass(`タイトル数字「〇〇選」と商品リスト整合チェック（ネガ/ポジ区別）`);
    }

    // 10.5 リコール販売チャネル断定チェック（電気敷毛布「ホームセンターで売ってた」等）
    const channelRecallTerms = [
      {pattern: /ホームセンターで売ってた[^。]*?電気敷毛布/, product: '電気敷毛布', note: '星テックは楽天通販主体・HC販売の証拠なし'},
    ];
    for (const t of channelRecallTerms) {
      if (t.pattern.test(script)) {
        console.log(`⚠️ 警告: リコール商品「${t.product}」の販売チャネル断定検出。${t.note}。「ネット通販で売られていた」「見かけたかもしれない」等の包括表現推奨`);
      }
    }

    // 10.6 エンディングトーン検証（断定・教訓調検出）
    const lastTenLinesText = tsvLines.slice(-12).map(l => l.split('\t')[1] || '').join('\n');
    const tonNgPatterns = [
      {pattern: /時代になりました|時代です/, label: '断定・教訓調「〜時代になりました」'},
      {pattern: /すべきです|ねばなりません|なくてはいけません/, label: '断定・教訓調「〜すべき」'},
      {pattern: /必ず確認してください|ぜひ確認してください/, label: '上から目線「みなさん確認してください」'},
    ];
    for (const t of tonNgPatterns) {
      if (t.pattern.test(lastTenLinesText)) {
        fail(`エンディングトーン違反: ${t.label}`, '台本ルール「エンディングトーンガイド」NGリスト該当・低姿勢・寄り添い・労いトーンに修正必須');
      }
    }
    // ねぎらい締めの存在チェック
    if (!/ありがとうございました|ここまで見てくださって|ご視聴ありがとう/.test(lastTenLinesText)) {
      fail('エンディングにねぎらい締めなし', '「家事や育児、お仕事の合間に〜本当にありがとう」型のねぎらい締め必須');
    }
    pass('ガル台本 エンディングトーンチェック');
  }

  // ═══ 11. 🆕 ガル 視聴者誘導NG表現＋免責文言検出（2026-04-25追加・自ガル11制作セッション26件指摘恒久化）═══
  if (channel === 'galchan') {
    // 11.1 アフィリンク表現検出（B1）
    // 「アフィリンク」「アフィ一覧」等は視聴者誘導感が強くNG。
    // 「Amazonアソシエイト・楽天アフィリエイト」のクレジット表記は除外。
    const affiNgRe = /アフィリンク|アフィ一覧|アフィエイト一覧|アフィエイト|アフィリエイト一覧/g;
    const checkTexts = [
      {label: '概要欄', text: desc},
      {label: '固定コメント', text: pin},
    ];
    for (const t of checkTexts) {
      if (!t.text) continue;
      // 「Amazonアソシエイト」「楽天アフィリエイト」のクレジット部分を除いた本文で検査
      const cleaned = t.text
        .replace(/Amazonアソシエイト|Amazon アソシエイト/g, '')
        .replace(/楽天アフィリエイト|Rakutenアフィリエイト/g, '');
      const matches = [...cleaned.matchAll(affiNgRe)];
      if (matches.length > 0) {
        const samples = matches.slice(0, 2).map(m => m[0]).join(' / ');
        fail(`${t.label}に視聴者誘導NG表現「${samples}」混入`,
             '「アフィリンク」「アフィ一覧」は視聴者誘導感が強くNG。「動画で紹介したオススメ一覧」等の中立表現に置換必須（Amazonアソシエイト規約クレジットはOK）');
      }
    }
    pass('ガル 視聴者誘導NG表現（アフィリンク/アフィ一覧）検出なし');

    // 11.2 概要欄ブランド一覧混入検出（B2・3.1ガード拡張）
    const brandListRe = /動画内で紹介した[^。\n]*ブランド|ブランド一覧|商品まとめ一覧/;
    if (desc && brandListRe.test(desc)) {
      fail('概要欄にブランド一覧混入', 'ユーザー指示「ブランド一覧は概要欄から削除・固定コメ運用」違反');
    }
    pass('ガル 概要欄ブランド一覧混入なし');
  }

  // ═══ 12. 🆕 ガル ネガ商品の店舗名・メーカー実名検出（公式リコール除外）═══
  if (channel === 'galchan' && script) {
    // 公式リコール許可リスト（一次ソースで自主回収・使用中止・消費者庁警告が確認できているもののみ）
    // 一般体験（壊れた・反った・骨折）の被害紐付けでは店舗名・メーカー実名禁止。公式リコールのみ実名OK。
    const OFFICIAL_RECALL_PRODUCTS = [
      'カインズ.{0,15}サーキュレーター',  // カインズ自主回収サーキュレーター
      '星テック.{0,15}電気敷毛布',         // 星テック電気敷毛布リコール
      '星テック.{0,15}敷毛布',
    ];
    const recallRe = new RegExp(OFFICIAL_RECALL_PRODUCTS.join('|'), 'g');

    // 12.1 店舗名 + 被害動詞（ネガ被害の店舗名実名検出・B3）
    const STORE_NAMES = ['コーナン', 'DCM', 'カインズ', 'ビバホーム', 'ナフコ', 'ジョイフル本田',
                          'ロイヤルホームセンター', 'ホーマック', 'ケーヨーデイツー'];
    const HARM_VERBS = '(?:骨折|火災|破損|壊れた|倒壊|ケガ|怪我|発火|燃え|事故|爆発|割れた|変形)';
    const channelHarmIssues = [];
    for (const store of STORE_NAMES) {
      const pattern = new RegExp(
        `${store}[^。\\n]{0,60}(?:で買った|で売ってた|で売っている|で買い|で見かけた)[^。\\n]{0,60}${HARM_VERBS}|` +
        `${HARM_VERBS}[^。\\n]{0,60}${store}(?:で買った|で売ってた|で買い)`,
        'g'
      );
      const found = [...script.matchAll(pattern)];
      for (const m of found) {
        // 公式リコール商品とマッチするか確認
        if (recallRe.test(m[0])) continue; // 公式リコールはOK
        channelHarmIssues.push(`${store}: ${m[0].slice(0, 60)}`);
      }
    }
    if (channelHarmIssues.length > 0) {
      fail(`ネガ被害の店舗名実名検出 ${channelHarmIssues.length}件`,
           `${channelHarmIssues.slice(0, 2).join(' / ')}。公式リコール（カインズサーキュレーター/星テック電気敷毛布等）以外で店舗名+被害動詞の組み合わせは禁止。「ホームセンターで買った安いやつが壊れた」等の包括表現に置換必須`);
    }
    pass('ガル ネガ被害の店舗名実名検出なし（公式リコール除外）');

    // 12.2 メーカー名+被害動詞（B4）
    // 一般体験の架空被害でメーカー実名はNG。公式リコール対象メーカーのみOK。
    const MAKER_NAMES_NEG_CHECK = ['アイリスオーヤマ', 'パナソニック', 'シャープ', '日立',
                                    '三菱', 'ツインバード', 'ニトリ', '無印良品', 'ヤマゼン',
                                    'コイズミ', '山善', 'ドウシシャ'];
    const makerHarmIssues = [];
    for (const maker of MAKER_NAMES_NEG_CHECK) {
      const pattern = new RegExp(
        `${maker}[^。\\n]{0,40}(?:の|製の)[^。\\n]{0,40}${HARM_VERBS}|` +
        `${HARM_VERBS}[^。\\n]{0,40}${maker}(?:の|製の)`,
        'g'
      );
      const found = [...script.matchAll(pattern)];
      for (const m of found) {
        // 公式リコールならOK
        if (recallRe.test(m[0])) continue;
        // 「○○のサーキュレーター（公式リコール対象品）」のような併記もOK
        if (/(自主回収|リコール|使用中止|消費者庁.{0,10}警告)/.test(m[0])) continue;
        makerHarmIssues.push(`${maker}: ${m[0].slice(0, 60)}`);
      }
    }
    if (makerHarmIssues.length > 0) {
      console.log(`⚠️ 警告: ネガ被害でメーカー実名検出 ${makerHarmIssues.length}件: ${makerHarmIssues.slice(0, 2).join(' / ')}。一般体験（壊れた・骨折等）の被害紐付けでメーカー実名はNG。公式リコール（NITE/消費者庁掲載）のみOK・要確認`);
    } else {
      pass('ガル ネガ被害のメーカー実名検出なし（公式リコール除外）');
    }

    // 12.3 個人体験の医療診断断定検出（B5）
    const medicalAssertion = /(?:皮膚科|医師|医者|診療所|内科|整形外科|眼科)[^。\n]{0,40}(?:診断された|断定された|確定診断|判定された|断言された)/g;
    const medMatches = [...script.matchAll(medicalAssertion)];
    if (medMatches.length > 0) {
      const samples = medMatches.slice(0, 2).map(m => m[0]).join(' / ');
      console.log(`⚠️ 警告: 個人体験の医療診断断定 ${medMatches.length}件: ${samples}。「皮膚科で〜と診断された」等の医療診断断定は薬機法/誤情報リスク・「〜と言われたの」「〜と聞いた」等の伝聞表現推奨`);
    } else {
      pass('ガル 個人体験の医療診断断定検出なし');
    }

    // 12.4 公的機関データ年代チェック（B6・WARN）
    // 古いデータ（5年以上前）の言及をWARN（人間レビューで最新値確認推奨）
    const currentYear = new Date().getFullYear();
    const oldDataRe = /(20\d{2})\s*年/g;
    const oldDataYears = new Set();
    for (const m of script.matchAll(oldDataRe)) {
      const y = parseInt(m[1]);
      if (y > 1990 && y < currentYear - 4) oldDataYears.add(y);
    }
    if (oldDataYears.size > 0) {
      const yearsStr = [...oldDataYears].sort().join('/');
      console.log(`⚠️ 警告: 古い年代データ言及 [${yearsStr}年]（基準: ${currentYear - 4}年以前）・NITE/消費者庁等の公的データは過去5年以内が望ましい・WebFetchで最新公表値確認推奨`);
    }

    // 12.5 価格と商品の整合性チェック（B7・WARN）
    // 商品ジャンルごとの想定価格レンジを定義し、範囲外なら WARN
    const PRICE_RANGES = [
      {keywords: ['羽毛布団', '羽毛ふとん'], min: 10000, max: 200000, label: '羽毛布団'},
      {keywords: ['ネクタイ'], min: 1000, max: 30000, label: 'ネクタイ'},
      {keywords: ['ダウンジャケット', 'ダウンコート'], min: 8000, max: 200000, label: 'ダウン'},
      {keywords: ['革靴', 'ビジネスシューズ'], min: 5000, max: 100000, label: '革靴'},
      {keywords: ['炊飯器'], min: 5000, max: 100000, label: '炊飯器'},
      {keywords: ['電子レンジ'], min: 8000, max: 80000, label: '電子レンジ'},
    ];
    const priceIssues = [];
    for (const r of PRICE_RANGES) {
      for (const kw of r.keywords) {
        const re = new RegExp(`(\\d{1,3}(?:,?\\d{3})*|\\d+)\\s*円[^。\\n]{0,20}${kw}|${kw}[^。\\n]{0,20}(\\d{1,3}(?:,?\\d{3})*|\\d+)\\s*円`, 'g');
        for (const m of script.matchAll(re)) {
          const priceStr = (m[1] || m[2] || '').replace(/,/g, '');
          const price = parseInt(priceStr);
          if (!isNaN(price) && (price < r.min || price > r.max)) {
            priceIssues.push(`${r.label} ${price}円（想定 ${r.min}-${r.max}円）`);
          }
        }
      }
    }
    if (priceIssues.length > 0) {
      console.log(`⚠️ 警告: 商品ジャンル想定価格レンジ外 ${priceIssues.length}件: ${priceIssues.slice(0, 3).join(' / ')}。商品名と価格の不整合可能性あり・要確認（例: 4,000円分の羽毛布団等）`);
    } else {
      pass('ガル 商品ジャンル想定価格レンジ整合チェック');
    }
  }

  // ═══ 13. 🆕 動画管理シート Garbage detection（2026-04-25追加・row34長文ゴミ事件再発防止）═══
  // 動画管理シート保存時に、タイトル/台本名/シリアル番号などのフィールドに
  // 長文テキスト（100字超 or 改行3+）が混入していないか検証
  if (channel === 'galchan') {
    const garbageTargets = [
      { val: payload.topic?.title || materials.topicTitle || '', label: 'topic.title' },
      { val: payload.serialNumber || materials.serialNumber || '', label: 'serialNumber' },
      { val: payload.scriptName || materials.scriptName || '', label: 'scriptName' },
      { val: (materials.titles || [])[0] || '', label: 'titles[0]' },
    ];
    let garbageHit = false;
    for (const t of garbageTargets) {
      const text = String(t.val);
      if (!text) continue;
      const lines = text.split('\n').length;
      if (text.length > 100) {
        console.log(`⚠️ 警告: ${t.label} に長文混入の可能性 (${text.length}字 > 100字): 「${text.slice(0, 50)}...」`);
        garbageHit = true;
      }
      if (lines >= 4) {
        console.log(`⚠️ 警告: ${t.label} に改行${lines}個混入の可能性: 動画管理シート不定型データ事件再発防止のため要確認`);
        garbageHit = true;
      }
      // 「下記X本まとめ」「以下〜」等のまとめ記述の混入検出
      if (/下記[\s\d]*本(?:まとめ|分|について|です)|以下のとおり|■.*■.*■/.test(text)) {
        fail(`${t.label} に「下記X本まとめ」型の長文テキスト混入`, `動画管理シートrow34事件型・${t.label}は単一タイトル/シリアル番号のみ・複数動画まとめ記述はNG`);
      }
    }
    if (!garbageHit) {
      pass('動画管理シート Garbage detection (長文/改行混入なし)');
    }
  }

  // ═══ 15. 🆕 健康ch ファクト安全5原則 NGワード検出（2026-04-26追加・外健60事故再発防止）═══
  // 出典: feedback_health_fact_safety_5_principles.md / 台本ルール.md G11
  if (channel === 'health' && script) {
    const factSafetyIssues = [];

    // NG1: 死亡率○倍/寿命直結断定
    const ng1Pattern = /死亡率\s*[\d\.]+\s*倍|寿命と直結|寿命直結|早く死ぬ|死亡リスク\s*[\d\.]+\s*倍/g;
    const ng1Matches = [...script.matchAll(ng1Pattern)];
    if (ng1Matches.length > 0) {
      factSafetyIssues.push(`NG1 死亡率/寿命直結断定 ${ng1Matches.length}件: ${ng1Matches.slice(0, 2).map(m => m[0]).join(' / ')}`);
    }

    // NG2: 効果範囲広げすぎ（合体技で全部解決断定）
    const ng2Pattern = /(?:全部(?:変わる|解決|覆された|変える)|すべて(?:変わる|解決)|全身が変わる|まとめて(?:変わる|変える|解決)|全部.{0,10}変わる)/g;
    const ng2Matches = [...script.matchAll(ng2Pattern)];
    if (ng2Matches.length > 0) {
      factSafetyIssues.push(`NG2 効果範囲広げすぎ ${ng2Matches.length}件: ${ng2Matches.slice(0, 2).map(m => m[0]).join(' / ')}`);
    }

    // NG4: 医療領域踏み込み（湿布より原因消す/睡眠薬減らす/○○病が治る）
    const ng4Pattern = /(?:湿布(?:より|を貼り続け).{0,20}原因(?:を)?消し|睡眠薬(?:の量)?を?減ら|薬(?:の量)?を?減らせる|薬を減らすきっかけ|原因を消しに行く)/g;
    const ng4Matches = [...script.matchAll(ng4Pattern)];
    if (ng4Matches.length > 0) {
      factSafetyIssues.push(`NG4 医療領域踏み込み ${ng4Matches.length}件: ${ng4Matches.slice(0, 2).map(m => m[0]).join(' / ')}`);
    }

    // NG5: 視聴者効果断定（「必ず変わる」型）
    const ng5Pattern = /(?:必ず(?:変わる|効く|治る|改善|落ちる|減る|なる)|全部覆された|これで止められる|これで治る|絶対に?(?:変わる|効く|治る|改善|落ちる|減る))/g;
    const ng5Matches = [...script.matchAll(ng5Pattern)];
    if (ng5Matches.length > 0) {
      factSafetyIssues.push(`NG5 視聴者効果断定 ${ng5Matches.length}件: ${ng5Matches.slice(0, 2).map(m => m[0]).join(' / ')}`);
    }

    if (factSafetyIssues.length > 0) {
      fail(`健康ch ファクト安全5原則違反 ${factSafetyIssues.length}カテゴリ`,
           `${factSafetyIssues.join(' | ')}。台本ルール.md G11参照・「研究で言える事実は強く言う・視聴者効果は約束しすぎない」原則で言い換え必須`);
    }
    pass('健康ch ファクト安全5原則 NGワード検出なし（G11準拠）');
  }

  // ═══ 16. 🆕 健康ch エビデンス確認ゲート（2026-04-26追加・出典URL記録必須）═══
  // 出典: feedback_health_evidence_verification_gate.md / 台本ルール.md G13
  // 「○○大学」「○○年の研究で」等のパターンが本文にあれば、台本末尾の「エビデンス出典メモ」セクションに記録必須
  if (channel === 'health' && script) {
    // 検出パターン（本文中のエビデンス言及）
    const universityPattern = /([一-龥ァ-ヴー]{2,10})(大学|医科大学|研究所|医療センター|病院)(?:が|の|で)?(?:研究|発表|報告|示し|示した|明らか)/g;
    const yearResearchPattern = /(\d{4})\s*年(?:の|に発表|に行われた|に実施)?\s*(?:研究|論文|報告|調査|実験)/g;
    const reportPattern = /([一-龥ァ-ヴー]{2,10})\s*が\s*報告/g;

    const evidenceMentions = [];
    for (const m of script.matchAll(universityPattern)) {
      evidenceMentions.push(`大学/研究機関: ${m[0]}`);
    }
    for (const m of script.matchAll(yearResearchPattern)) {
      evidenceMentions.push(`年号研究: ${m[0]}`);
    }
    for (const m of script.matchAll(reportPattern)) {
      evidenceMentions.push(`報告: ${m[0]}`);
    }

    if (evidenceMentions.length > 0) {
      // エビデンス出典メモセクションが台本末尾にあるか確認
      const hasEvidenceMemo = /##\s*エビデンス出典メモ/.test(script) ||
                              /##\s*出典メモ/.test(script) ||
                              /エビデンス出典メモ.*G13/.test(script);
      if (!hasEvidenceMemo) {
        // OUTPUT_REQUIRES_VERIFICATION フラグ表示
        console.log(`\n⚠️ OUTPUT_REQUIRES_VERIFICATION: エビデンス言及 ${evidenceMentions.length}件検出・出典URL記録必須`);
        console.log(`   検出パターン: ${evidenceMentions.slice(0, 5).join(' / ')}`);
        fail(`健康ch エビデンス出典メモ未記載 ${evidenceMentions.length}件`,
             `${evidenceMentions.slice(0, 3).join(' / ')}。台本末尾に「## エビデンス出典メモ（G13）」セクションを追加し、各引用に出典URL/PMID/データ出典を記録必須・G13参照`);
      }
      pass(`健康ch エビデンス言及 ${evidenceMentions.length}件・出典メモセクションあり（G13準拠）`);
    } else {
      pass('健康ch エビデンス言及なし（裏取り対象なし）');
    }
  }

  // ═══ 17. 🆕 健康ch ワーカーメッセージ スリム版遵守ガード（2026-04-26追加・外健60で違反→ユーザー指摘）═══
  // 出典: feedback_health_worker_msg_script_purity.md / DB/rules/ワーカーメッセージテンプレ.md
  // 補足セクション（特記事項/もし○分未満なら/ちなみに/【補足】等）の追加禁止
  if (channel === 'health') {
    const wm = payload.workerMessage || materials.workerMessage || '';
    if (wm) {
      const wmAdditionPatterns = [
        { pattern: /【今回の特記事項】|【特記事項】|【今回の/, label: '【今回の特記事項】系セクション' },
        { pattern: /【もし\d+分(?:未満|超え|以上|以下)/, label: '【もし○分】系条件分岐セクション' },
        { pattern: /【\d+分超え】|【\d+分未満】/, label: '【○分超え】【○分未満】系セクション' },
        { pattern: /【補足】/, label: '【補足】セクション' },
        { pattern: /※特記事項|※今回は|※○○の場合|※もし/, label: '※特記事項系の追加注釈' },
        { pattern: /^ちなみに/m, label: '「ちなみに」系の補足追加（行頭）' },
      ];
      const wmIssues = [];
      for (const r of wmAdditionPatterns) {
        if (r.pattern.test(wm)) {
          wmIssues.push(r.label);
        }
      }
      if (wmIssues.length > 0) {
        fail(`健康ワーカーメッセージ スリム版テンプレ違反 ${wmIssues.length}件`,
             `${wmIssues.join(' / ')}。DB/rules/ワーカーメッセージテンプレ.mdの「補足追加禁止」違反・スリム版固定文言（{docUrl}+{workerInstructions}のみ動的）厳守`);
      }
      pass('健康ワーカーメッセージ 補足セクション追加なし（スリム版遵守）');
    }
  }

  // ═══ 18. 🆕 健康ch 台本本文「根拠N。」ラベルNG（2026-04-26追加・ナレーション違和感）═══
  // 出典: feedback_health_worker_msg_script_purity.md / 隙間雑学型抽象化「根拠ナンバリング」誤解防止
  // 「根拠1。下腹凹み。」型 → 「まず1つ目、下腹凹み。」「2つ目、」に置換推奨
  if (channel === 'health' && script) {
    const konkyoLabelPattern = /根拠\s*\d+\s*[。\.]/g;
    const konkyoMatches = [...script.matchAll(konkyoLabelPattern)];
    if (konkyoMatches.length > 0) {
      const samples = konkyoMatches.slice(0, 3).map(m => m[0]).join(' / ');
      console.log(`⚠️ 警告: 「根拠N。」ラベル ${konkyoMatches.length}件検出: ${samples}。ナレーション読み上げで違和感・「Nつ目、」「まずN個目、」型に置換推奨（隙間雑学型「根拠ナンバリング」は構造概念であってラベル文言ではない）`);
    } else {
      pass('健康台本 「根拠N。」ラベル検出なし');
    }
  }

  // ═══ 19. 🆕 健康ch 台本ファイルに「ワーカー調整指示」セクション置かないFAIL（2026-04-26追加）═══
  // 出典: feedback_health_worker_msg_script_purity.md
  // ワーカーへの調整指示・削除候補❶〜❻はチャットワーク固定タスク（マニュアル）に置く運用。台本ファイルは台本本文+メタ情報のみ
  if (channel === 'health' && script) {
    const workerAdjustmentPatterns = [
      /##\s*🔧?\s*ワーカーへの調整指示/,
      /##\s*ワーカー(?:への|向け)?\s*(?:調整|削除)?\s*指示/,
      /削除候補\s*[❶❷❸❹❺❻⓵⓶⓷⓸⓹⓺①②③④⑤⑥]/,
      /##\s*削除候補/,
      /##\s*ワーカー調整/,
    ];
    const workerAdjustmentHits = [];
    for (const p of workerAdjustmentPatterns) {
      if (p.test(script)) {
        workerAdjustmentHits.push(p.toString());
      }
    }
    if (workerAdjustmentHits.length > 0) {
      fail(`健康台本ファイルに「ワーカー調整指示」セクション混入 ${workerAdjustmentHits.length}件`,
           `${workerAdjustmentHits.slice(0, 2).join(' / ')}。台本ファイルは台本本文+メタ情報のみ。ワーカー調整指示・削除候補❶〜❻はチャットワーク固定タスク（マニュアル）参照に置き換え必須・feedback_health_worker_msg_script_purity.md参照`);
    }
    pass('健康台本 ワーカー調整指示セクション混入なし');
  }

  // ═══ 19. 🆕 アルファベット略語禁止（2026-04-28追加・自ガル12「PB」事件→2026-04-28拡張） ═══
  // VOICEVOX読み上げで「ピービー」「エヌビー」等になる全略語を網羅的に検出
  // ハードコード既知NG + 正規表現 \b[A-Z]{2,5}\b で全アルファベット略語をキャッチ
  if (script && channel === 'galchan') {
    // 既知NG: 必ず置換指示が出る
    const KNOWN_FORBIDDEN_ABBR = [
      { word: 'PB', full: 'プライベートブランド' },
      { word: 'NB', full: 'ナショナルブランド' },
      { word: 'OEM', full: '他社ブランド供給品' },
      { word: 'ODM', full: '設計まで他社委託品' },
      { word: 'PSE', full: '電気用品安全法マーク' },
      { word: 'QC', full: '品質管理' },
      { word: 'HC', full: 'ホームセンター' },
      { word: 'DS', full: 'ドラッグストア' },
      { word: 'SC', full: 'ショッピングセンター' },
      { word: 'GMS', full: '総合スーパー' },
      { word: 'EC', full: '通販/ネット通販' },
    ];
    // 例外（読み上げOKと判明済の略語のみ・ここにある略語のみ通す）
    const ALLOWED_ABBR = new Set([
      'JR', 'NTT', 'KDDI', 'NHK', 'JA', 'JT', 'TV',
      'KFC', 'IKEA', 'GAP', 'CD', 'DVD', 'OK', 'NG', 'NO',
      'JIS', 'JAS', 'NITE', 'PMDA', // 公的機関・規格（カタカナ読み定着）
      'AI', 'IT', 'PC', 'USB', 'SD', 'HD', 'TV', 'PR', 'CM',
      'GW', // ゴールデンウィーク慣習化
    ]);

    const tsvLinesA = script.split('\n').filter(l => l.includes('\t'));
    const knownHits = [];
    const unknownHits = []; // 既知NG以外の検出された略語（ALLOWEDにないもの）

    for (let i = 0; i < tsvLinesA.length; i++) {
      const cols = tsvLinesA[i].split('\t');
      const body = cols[1] ?? '';

      // (a) 既知NG検出
      for (const { word, full } of KNOWN_FORBIDDEN_ABBR) {
        const re = new RegExp(`\\b${word}\\b`);
        if (re.test(body)) {
          knownHits.push(`L${i + 1}「${word}」→「${full}」に置換: ${body.substring(0, 50)}`);
        }
      }

      // (b) 正規表現で全 [A-Z]{2,5} を抽出 → ALLOWEDになければNG扱い
      const matches = body.match(/\b[A-Z]{2,5}\b/g) ?? [];
      for (const m of matches) {
        if (ALLOWED_ABBR.has(m)) continue;
        // 既知NGに含まれてればそっちで報告済み
        if (KNOWN_FORBIDDEN_ABBR.some(k => k.word === m)) continue;
        unknownHits.push(`L${i + 1}「${m}」: ${body.substring(0, 50)}`);
      }
    }

    if (knownHits.length > 0 || unknownHits.length > 0) {
      const all = [...knownHits, ...unknownHits];
      const detail = `VOICEVOX読み上げで不自然になる。\n` +
        (knownHits.length > 0 ? `【既知NG ${knownHits.length}件】\n${knownHits.slice(0, 5).join('\n')}\n` : '') +
        (unknownHits.length > 0 ? `【未登録略語 ${unknownHits.length}件・カタカナ化 or ALLOWLIST追加】\n${unknownHits.slice(0, 5).join('\n')}\n` : '') +
        `合計${all.length}件・feedback_galchan_no_abbreviation_and_tail_repetition.md 参照`;
      fail(`アルファベット略語禁止違反 ${all.length}件`, detail);
    }
    pass('アルファベット略語禁止 違反なし（既知NG+未登録略語 共にゼロ）');
  }

  // ═══ 20. 🆕 語尾連続/「〜の。」連発禁止（2026-04-28追加・自ガル12「〜の。」事件） ═══
  // 「〜の。」連続2行まで・同一末尾2文字3行連続禁止
  if (script && channel === 'galchan') {
    const tsvLinesB = script.split('\n').filter(l => l.includes('\t'));
    const bodies = tsvLinesB.map(l => (l.split('\t')[1] ?? '').trim());
    const speakers = tsvLinesB.map(l => (l.split('\t')[0] ?? '').trim());
    const isMainBody = (i) =>
      speakers[i] !== 'ナレーション' && speakers[i] !== 'タイトル' && bodies[i].length > 0;

    // 末尾2文字（句点除く）取得
    const tailOf = (s) => {
      const stripped = s.replace(/[。！？!?]+$/u, '');
      return stripped.slice(-2);
    };

    // (a) 「〜の。」終わり連続3行検出
    const noEndings = [];
    let consecNo = 0;
    for (let i = 0; i < bodies.length; i++) {
      if (!isMainBody(i)) { consecNo = 0; continue; }
      const isNoEnd = /の[。！？!?]?$/u.test(bodies[i]);
      if (isNoEnd) {
        consecNo++;
        if (consecNo >= 3) {
          noEndings.push(`L${i - 1}〜L${i + 1}「〜の。」連続${consecNo}行: ${bodies[i].substring(0, 30)}`);
        }
      } else {
        consecNo = 0;
      }
    }
    if (noEndings.length > 0) {
      fail(`「〜の。」終わり連続3行以上 ${noEndings.length}件`,
           `${noEndings.slice(0, 3).join('\n')}\n別語尾(〜なんだよ/〜だしね/〜って思った/〜なんだよね)に置換`);
    }
    pass('「〜の。」連続3行 違反なし');

    // (b) 同一末尾2文字 連続3行検出（ナレーション・タイトル・空行は除外）
    const tailHits = [];
    let lastTail = '';
    let consecTail = 0;
    let consecStart = -1;
    for (let i = 0; i < bodies.length; i++) {
      if (!isMainBody(i)) {
        consecTail = 0;
        lastTail = '';
        continue;
      }
      const t = tailOf(bodies[i]);
      if (t.length >= 2 && t === lastTail) {
        consecTail++;
        if (consecTail >= 3) {
          tailHits.push(`L${consecStart + 1}〜L${i + 1}「${t}」末尾連続${consecTail}行: ${bodies[i].substring(0, 30)}`);
        }
      } else {
        consecTail = 1;
        lastTail = t;
        consecStart = i;
      }
    }
    if (tailHits.length > 0) {
      fail(`同一末尾2文字 連続3行以上 ${tailHits.length}件`,
           `${tailHits.slice(0, 3).join('\n')}\n語尾バリエーション必須(台本ルール.md「語尾バリエーションルール」参照)`);
    }
    pass('同一末尾2文字 連続3行 違反なし');

    // (c) 「〜の。」終わり全体出現率 20%超 → WARN
    const totalMain = bodies.filter((_, i) => isMainBody(i)).length;
    const noEndCount = bodies.filter((b, i) => isMainBody(i) && /の[。！？!?]?$/u.test(b)).length;
    const ratio = totalMain > 0 ? (noEndCount / totalMain) : 0;
    if (ratio > 0.2) {
      console.warn(`⚠️  WARN: 「〜の。」終わり率 ${(ratio * 100).toFixed(1)}%（上限20%・${noEndCount}/${totalMain}行）→ 別語尾に分散推奨`);
    } else {
      pass(`「〜の。」終わり率 ${(ratio * 100).toFixed(1)}%（上限20%以内）`);
    }
  }

  console.log(`\n🟢 PASS: 全チェック通過`);
}

main().catch(e => {
  console.error('Gate error:', e);
  process.exit(1);
});
