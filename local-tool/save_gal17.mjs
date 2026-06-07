/**
 * 自ガル17「物価高で手放して正解だったもの」スプシ保存（テンプレコピー方式）
 * 台本: validate has_critical:false / 252行9,097字 / レビュー88点
 */
import { readFile } from 'fs/promises';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル17台本】物価高で手放して正解だったもの_20260607.tsv';
const script = await readFile(tsvPath, 'utf8');

const fixedDescription = `このチャンネルでは、ガールズちゃんねる
https://girlschannel.net
やネット上の体験談をもとに、後悔しないための失敗回避情報を分かりやすく再構成しています。

・買って後悔した商品
・やらなくて正解だった習慣
・昔の常識で今は逆効果なこと

同世代のリアルな声に加え、私自身の体験や失敗談も交えながら、遠回りしない選択のヒントをお届けしています。

当チャンネルは、投稿内容を抽出・再編集したオリジナルコンテンツです。そのまま転載するものではありません。視聴しやすさを重視し、不適切な表現は適宜調整・省略しています。


あなたの体験談や後悔談も、ぜひコメントで教えてください。同世代のリアルな声が、誰かの役に立ちます。
少しでも参考になった方は、チャンネル登録と高評価で応援していただけると励みになります。

使用音声：VOICEVOX
・もち子
・冥鳴ひまり
・四国めたん
・春日部つむぎ
BGM：昼下がり気分
作曲：KK
音源提供：DOVA-SYNDROME
効果音：効果音ラボ ほかフリー音源サイト
イラスト素材：いらすとや
https://www.irasutoya.com
イラスト素材：イラストAC
https://www.ac-illust.com
このチャンネルは著作権を侵害する意図で運営しておりません。問題がございましたらご連絡をお願いいたします。`;

const description = `物価高で値上げが止まらない今、よかれと思って高いお金を出した家電や食品が、実は手放したほうが正解だった、ということが増えています。
この動画では、買って後悔した値上げの地雷と、こっそり乗り換えて正解だった神商品を、同世代のリアルな声と私の体験談を交えてまとめました。

#物価高 #値上げ #節約 #ガルちゃん #有益 #買って後悔 #神商品 #業務スーパー #中高年

${fixedDescription}`;

const pinComment = `【動画で出てきた、買って後悔しがちな物 / 乗り換えて正解だった物】
■後悔しがち：羽根なし扇風機／高い充電式掃除機／ホームベーカリー／高機能トースター／冷感タオル・ハンディファン／オイルヒーター／高い枕・羽毛布団／ドラム式洗濯機／高い美容家電 など
■正解だった：普通の扇風機／紙パック式掃除機／業務スーパーの冷凍うどん・ポテト・業務用ラップ・酵母パン／ワークマンの冷感シャツ・薄手ダウン／百均の収納ケース／昔ながらの石けん など

私も、おしゃれな高い家電に飛びついては、結局昔ながらの安い定番に戻す、というのを何度も繰り返してきました。
もっと早く気づいてたら、あのお金は使わなかったのにって、今でも思います。

皆さんが「高いお金を出したのに、結局これは手放した…」というもの、ぜひコメントで教えてください。
逆に「これは安いのに買って大正解だった」という神商品があれば、ぜひ共有してもらえると嬉しいです🙏`;

const workerMessage = `【編集メモ】
- テンポ：前半はゆっくり丁寧に、後半はテンポアップで畳みかけてください
- BGM：物価高・節約がテーマなので、落ち着いた中にも親しみのある雰囲気で
- CTA画像：冒頭CTA（イントロの「今のうちにチャンネル登録お願いします」）とエンディング固定文3行目（高評価・チャンネル登録）の読み上げ中に、お辞儀イラスト（おばさんが手を合わせてお辞儀・いらすとや風・紫の服）を表示してください
- サムネ：上段「物価高で買って大損…」/下段「手放して正解だったモノ」/左白枠「夏物で一番ムダだった…」/右白枠「賢い人はもう切り替えた」/8商品+左右白枠型・夏物実写混ぜ・赤+黒縁+白フチ・背景薄ピンク
- 注意：商品名は体験談ベースの会話なので、特定メーカー批判にならないトーンで`;

const productList = [
  { name: '羽根なし扇風機（高級）', category: '家電', scriptQuote: '五万くらいしたのに思ったほど涼しくない', amazonLink: '', rakutenLink: '' },
  { name: '普通の扇風機', category: '家電', scriptQuote: '三千円くらいの昔ながらの扇風機に戻したら涼しかった', amazonLink: '', rakutenLink: '' },
  { name: '高い充電式コードレス掃除機', category: '家電', scriptQuote: 'すぐ充電が切れて使い物にならない', amazonLink: '', rakutenLink: '' },
  { name: '紙パック式掃除機', category: '家電', scriptQuote: '吸引力が落ちにくく手も汚れない', amazonLink: '', rakutenLink: '' },
  { name: 'ホームベーカリー', category: '調理家電', scriptQuote: '材料費を考えたら食パン買うほうが安い', amazonLink: '', rakutenLink: '' },
  { name: '炭酸水メーカー', category: '家電', scriptQuote: 'ガスがすぐ無くなり交換が面倒', amazonLink: '', rakutenLink: '' },
  { name: '高級トースター', category: '調理家電', scriptQuote: '値段のわりに普通だった', amazonLink: '', rakutenLink: '' },
  { name: '高いミキサー', category: '調理家電', scriptQuote: '洗うのが面倒で棚の奥', amazonLink: '', rakutenLink: '' },
  { name: '普通のフライパン（千円）', category: '調理器具', scriptQuote: '高いやつより長持ち', amazonLink: '', rakutenLink: '' },
  { name: '高級シャワーヘッド', category: '美容家電', scriptQuote: '水漏れがすごくて戻した', amazonLink: '', rakutenLink: '' },
  { name: '高風量ドライヤー', category: '美容家電', scriptQuote: '強すぎて顔に髪が張り付く', amazonLink: '', rakutenLink: '' },
  { name: '冷感タオル', category: '夏物', scriptQuote: 'すぐぬるくなり服も濡れる', amazonLink: '', rakutenLink: '' },
  { name: 'ネッククーラーリング', category: '夏物', scriptQuote: '外に出たら五分でただの輪っか', amazonLink: '', rakutenLink: '' },
  { name: 'ハンディファン', category: '夏物', scriptQuote: '真夏は熱風しか出ない', amazonLink: '', rakutenLink: '' },
  { name: '保冷剤＋薄いハンカチ', category: '夏物', scriptQuote: 'お金もかからず確実に冷たい', amazonLink: '', rakutenLink: '' },
  { name: 'オイルヒーター', category: '暖房家電', scriptQuote: '効かないのに電気代が飛ぶ', amazonLink: '', rakutenLink: '' },
  { name: '着る毛布', category: '防寒', scriptQuote: '数千円なのに一晩じゅう暖かい', amazonLink: '', rakutenLink: '' },
  { name: '業務スーパー 冷凍讃岐うどん', category: '食品', scriptQuote: '安いのにモチモチで家族に好評', amazonLink: '', rakutenLink: '' },
  { name: '業務スーパー ベルギー産冷凍ポテト', category: '食品', scriptQuote: 'カリッと揚がって量もたっぷり', amazonLink: '', rakutenLink: '' },
  { name: '業務スーパー 緑の業務用ラップ', category: '日用品', scriptQuote: '日本製で長持ち切れ味もよい', amazonLink: '', rakutenLink: '' },
  { name: '業務スーパー ビール酵母パン', category: '食品', scriptQuote: '国産小麦でほんのり甘い', amazonLink: '', rakutenLink: '' },
  { name: 'キャンメイク マシュマロフィニッシュパウダー', category: '化粧品', scriptQuote: '千円くらいで肌に合う', amazonLink: '', rakutenLink: '' },
  { name: '縦型洗濯機', category: '家電', scriptQuote: '安くて置きやすく洗浄力も十分', amazonLink: '', rakutenLink: '' },
  { name: 'ワークマン 冷感シャツ（約500円）', category: '衣類', scriptQuote: '部屋着にも運動にも使えて夏に助かる', amazonLink: '', rakutenLink: '' },
  { name: 'ワークマン 薄手ダウン', category: '衣類', scriptQuote: '安いのに暖かく家で洗える', amazonLink: '', rakutenLink: '' },
  { name: 'ディスカウント店の焼き芋', category: '食品', scriptQuote: '良心的な値段なのに甘い', amazonLink: '', rakutenLink: '' },
  { name: '百円ショップ 収納ケース', category: '日用品', scriptQuote: '安いのに丈夫で片付けが進む', amazonLink: '', rakutenLink: '' },
  { name: '昔ながらの石けん', category: '日用品', scriptQuote: '顔も体もこれ一個で済み安い', amazonLink: '', rakutenLink: '' },
];

const payload = {
  topic: {
    title: '物価高で買って後悔した物と手放して正解だった神商品',
    description: '物価高・ステルス値上げの今、高い家電や食品を買って後悔した地雷と、定番に戻して正解だった神商品をまとめる回帰物語型',
    angle: '値上げ×後悔×神商品（やめろ+こっち使え型）',
    emotionWords: ['後悔', '大損', '損', '裏切られた'],
    source: 'ガルちゃん 買って後悔した家電/もう二度と買わん商品 + 直近2ヶ月競合実績',
    sourceUrl: 'https://girlschannel.net/topics/6091739/',
    category: 'product',
  },
  style: 'product',
  script,
  materials: {
    titles: [
      '【2026物価高】これ買うと大損…賢い人が手放したものと買って正解だった神商品',
      '【知らないと損】値上げで買って後悔する地雷商品＆本当に買うべき神商品',
      '【2026物価高】これ買うと大損…賢い人が手放したものと買って正解だった神商品',
    ],
    thumbnails: [
      '上段:物価高で買って大損… / 下段:手放して正解だったモノ / 左白枠:夏物で一番ムダだった… / 右白枠:賢い人はもう切り替えた',
      '物価高で買って大損…／手放して正解だったモノ',
      '物価高で買って大損…／手放して正解だったモノ',
    ],
    description,
    metaTags: '物価高,値上げ,節約,買って後悔,神商品,業務スーパー,ワークマン,中高年,失敗回避',
    pinComment,
    workerMessage,
    productList,
    serialNumber: '【自ガル17】',
  },
};

console.log('🚀 自ガル17 スプシ保存（テンプレコピー）実行...');
console.log('   script chars:', payload.script.length, '/ productList:', payload.materials.productList.length, '件');
const res = await fetch('http://127.0.0.1:3001/api/google/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Cookie': 'gc_auth_token=authenticated' },
  body: JSON.stringify(payload),
});
const json = await res.json();
console.log('\n📦 API応答:');
console.log(JSON.stringify(json, null, 2));
if (!res.ok || json.error) { console.log('\n❌ 保存失敗'); process.exit(1); }
console.log('\n✅ 保存成功');
