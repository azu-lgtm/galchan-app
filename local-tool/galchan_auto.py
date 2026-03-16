"""
galchan_auto.py
──────────────────────────────────────────────────────────────────────────────
ガルちゃん台本 TSV → VOICEVOX音声生成 → YMM4 .ymmp 自動生成ツール
+ いらすとや画像自動挿入（Gemini API でキーワード生成）

使い方:
  # ウォッチモード（フォルダを監視して自動処理）
  python galchan_auto.py

  # 手動モード（TSVファイルを直接指定）
  python galchan_auto.py path\to\台本.tsv

設定:
  - VOICEVOX が http://localhost:50021 で起動していること（YMM4内蔵）
  - 画像自動挿入には GEMINI_API_KEY 環境変数を設定すること
  - Drive監視には FOLDER_ID_GALCHAN / GOOGLE_CLIENT_ID /
    GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN を .env に設定すること
  - config 変数を必要に応じて変更する

TSV形式（4列タブ区切り）:
  話者\t本文\t(空欄)\tSE
  SE列に "SE1" または "SE2" があると直前にSE音声を挿入する

出力:
  YMMP_OUTPUT_DIR\【自ガルN台本】タイトル\【自ガルN台本】タイトル.ymmp
  YMMP_OUTPUT_DIR/【自ガルN台本】タイトル/使用画像/*.png  ← いらすとや画像
  処理済みTSVは _done を付与してリネーム
"""

import sys
import os
import json
import copy
import base64
import struct
import time
import traceback
import io
import wave
import math
import re
import urllib.request
import urllib.parse
import urllib.error


# ── .env 読み込み ──────────────────────────────────────────────────────────────

def _load_dotenv() -> None:
    """シンプルな.envローダー（stdlib）。既にos.environにある値は上書きしない"""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


_load_dotenv()

# ── 設定 ──────────────────────────────────────────────────────────────────────

config = {
    "voicevox_url": os.environ.get("VOICEVOX_URL", "http://localhost:50021"),
    "template_path": os.environ.get(
        "YMMP_TEMPLATE_PATH",
        r"E:\ガルyt\ガルちゃんYMM4テンプレート\テンプレ2026-2-25.ymmp",
    ),
    "output_dir": os.environ.get(
        "YMMP_OUTPUT_DIR",
        r"E:\ガルyt\ガルちゃん完成動画\ガルちゃん自動化完成動画・素材等",
    ),
    # ウォッチフォルダ: ここに .tsv を置くと自動処理
    "watch_dir": os.environ.get(
        "GALCHAN_WATCH_DIR",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "tsv_input"),
    ),
    "poll_interval": 5,   # 秒
    "fps": 60,
    "se1_path": r"E:\ガルyt\ガルちゃんYMM4テンプレート\セリフ切替SE1.mp3",
    "se2_path": r"E:\ガルyt\ガルちゃんYMM4テンプレート\セリフ切替SE2.mp3",
    "se_length": 63,      # フレーム数
    "se_layer": 4,
    "se_volume": 25.0,
    # ── 画像自動生成設定 ─────────────────────────────────────────
    # GEMINI_API_KEY が設定されていれば自動的に有効になる
    "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
    "image_layer": 2,      # キャラ手前・字幕背後レイヤー（Layer=1は背景VideoItemと重複するため2を使用）
    "image_zoom": 80.0,    # 表示サイズ（%）
    "image_x": 300.0,      # X位置（中心からのオフセット、右寄り）
    "image_y": 50.0,       # Y位置（中心からのオフセット）
    "image_folder_name": "使用画像",  # 画像保存サブフォルダ名
    "image_max": 20,       # いらすとや 最大使用枚数（マニュアル準拠）
    # ── Google Sheets 商品リスト設定 ─────────────────────────────────────────
    # .env から自動読み込み（GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
    # GOOGLE_REFRESH_TOKEN / SPREADSHEET_ID_GALCHAN）
    "google_client_id":     os.environ.get("GOOGLE_CLIENT_ID", ""),
    "google_client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
    "google_refresh_token": os.environ.get("GOOGLE_REFRESH_TOKEN", ""),
    "spreadsheet_id":       os.environ.get("SPREADSHEET_ID_GALCHAN", ""),
    "product_sheet_name":   "商品リスト",  # シート名（タブ名）
    # ── Google Drive 監視設定 ─────────────────────────────────────────────────
    # アプリが TSV をアップロードするフォルダID（FOLDER_ID_GALCHAN）
    "folder_id_galchan": os.environ.get("FOLDER_ID_GALCHAN", ""),
}

# ── キャラクター → VOICEVOX マッピング ───────────────────────────────────────
# CharacterName (TSV): { style_id, layer, speed_scale, post_phoneme_length, ymmp_name }
CHARACTER_MAP = {
    "ナレーション": {
        "style_id": 2,          # 四国めたん ノーマル
        "layer": 5,
        "speed_scale": 1.15,
        "post_phoneme_length": 0.18,
        "ymmp_name": "ナレーション ",   # ymmpのCharacterName（末尾スペースあり）
    },
    "タイトル": {
        "style_id": 2,          # 四国めたん ノーマル
        "layer": 5,
        "speed_scale": 1.15,
        "post_phoneme_length": 0.18,
        "ymmp_name": "タイトル ",
    },
    "イッチ": {
        "style_id": 8,          # 春日部つむぎ ノーマル
        "layer": 3,
        "speed_scale": 1.20,
        "post_phoneme_length": 0.12,
        "ymmp_name": "イッチ ",
    },
    "スレ民1": {
        "style_id": 20,         # もち子(cv 明日葉よもぎ) ノーマル
        "layer": 3,
        "speed_scale": 1.10,
        "post_phoneme_length": 0.12,
        "ymmp_name": "スレ民1",
    },
    "スレ民2": {
        "style_id": 14,         # 冥鳴ひまり ノーマル
        "layer": 3,
        "speed_scale": 1.18,
        "post_phoneme_length": 0.12,
        "ymmp_name": "スレ民2",
    },
    "スレ民3": {
        "style_id": 8,          # 春日部つむぎ
        "layer": 3,
        "speed_scale": 1.15,
        "post_phoneme_length": 0.12,
        "ymmp_name": "スレ民3",
    },
    "スレ民4": {
        "style_id": 14,         # 冥鳴ひまり
        "layer": 3,
        "speed_scale": 1.15,
        "post_phoneme_length": 0.12,
        "ymmp_name": "スレ民4",
    },
    "スレ民5": {
        "style_id": 20,         # もち子
        "layer": 3,
        "speed_scale": 1.15,
        "post_phoneme_length": 0.12,
        "ymmp_name": "スレ民5",
    },
    "スレ民6": {
        "style_id": 8,          # 春日部つむぎ
        "layer": 3,
        "speed_scale": 1.15,
        "post_phoneme_length": 0.12,
        "ymmp_name": "スレ民6",
    },
}

# ── VOICEVOX API ──────────────────────────────────────────────────────────────

def voicevox_audio_query(text: str, speaker: int) -> dict:
    """テキストからAudioQueryを生成する"""
    params = urllib.parse.urlencode({"text": text, "speaker": speaker})
    url = f"{config['voicevox_url']}/audio_query?{params}"
    req = urllib.request.Request(url, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def voicevox_synthesis(audio_query: dict, speaker: int) -> bytes:
    """AudioQueryからWAVバイト列を生成する"""
    params = urllib.parse.urlencode({"speaker": speaker})
    url = f"{config['voicevox_url']}/synthesis?{params}"
    body = json.dumps(audio_query).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def wav_duration_seconds(wav_bytes: bytes) -> float:
    """WAVバイト列から再生時間（秒）を計算する"""
    with wave.open(io.BytesIO(wav_bytes)) as wf:
        return wf.getnframes() / wf.getframerate()


def format_voice_length(seconds: float) -> str:
    """秒数を "HH:MM:SS.FFFFFFF" (100ns単位) 形式に変換する"""
    total_100ns = round(seconds * 10_000_000)
    h = total_100ns // (3_600 * 10_000_000)
    remainder = total_100ns % (3_600 * 10_000_000)
    m = remainder // (60 * 10_000_000)
    remainder %= 60 * 10_000_000
    s = remainder // 10_000_000
    frac = remainder % 10_000_000
    return f"{h:02d}:{m:02d}:{s:02d}.{frac:07d}"


# ── ymmp 生成ヘルパー ──────────────────────────────────────────────────────────

def build_voice_item(proto: dict, char_info: dict, text: str,
                     audio_query: dict, wav_bytes: bytes,
                     frame: int) -> dict:
    """プロトタイプVoiceItemをコピーして新しい発話アイテムを生成する"""
    item = copy.deepcopy(proto)

    duration = wav_duration_seconds(wav_bytes)
    length_frames = math.ceil(duration * config["fps"])

    # 基本フィールド
    item["CharacterName"] = char_info["ymmp_name"]
    item["Serif"] = text
    item["Hatsuon"] = audio_query.get("kana", text)

    # Pronounce.AudioQuery を VOICEVOX結果で上書き
    aq = item["Pronounce"]["AudioQuery"]
    aq["accent_phrases"] = audio_query.get("accent_phrases", [])
    aq["speedScale"] = char_info["speed_scale"]
    aq["pitchScale"] = 0.0
    aq["intonationScale"] = 1.0
    aq["volumeScale"] = 1.0
    aq["prePhonemeLength"] = 0.0
    aq["postPhonemeLength"] = char_info["post_phoneme_length"]
    aq["outputSamplingRate"] = audio_query.get("outputSamplingRate", 24000)
    aq["outputStereo"] = False
    aq["kana"] = audio_query.get("kana", "")
    aq["pauseLength"] = None
    aq["pauseLengthScale"] = 1.0

    # LipSyncFrames（Pronounce内）はNoneに設定（自動再計算させる）
    item["Pronounce"]["LipSyncFrames"] = None

    # VoiceCache = base64 WAV
    item["VoiceCache"] = base64.b64encode(wav_bytes).decode("ascii")
    item["VoiceLength"] = format_voice_length(duration)
    item["LipSyncFrames"] = None

    # VoiceParameter
    vp = item.get("VoiceParameter", {})
    vp["StyleID"] = char_info["style_id"]
    vp["Speed"] = int(char_info["speed_scale"] * 100)
    vp["PostPhonemeLength"] = char_info["post_phoneme_length"]
    item["VoiceParameter"] = vp

    # 位置・長さ・折り返し
    item["Frame"] = frame
    item["Layer"] = char_info["layer"]
    item["Length"] = length_frames
    item["WordWrap"] = "Wrap"   # テンプレートのNoWrapを上書きして字幕折り返しを有効化

    return item, length_frames


def build_se_item(proto_audio: dict, se_num: int, frame: int) -> dict:
    """SE AudioItemを生成する（SE1 or SE2）"""
    item = copy.deepcopy(proto_audio)
    item["FilePath"] = config["se1_path"] if se_num == 1 else config["se2_path"]
    item["Volume"]["Values"][0]["Value"] = config["se_volume"]
    item["Frame"] = frame
    item["Layer"] = config["se_layer"]
    item["Length"] = config["se_length"]
    return item


# ── Gemini API ────────────────────────────────────────────────────────────────

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def gemini_generate_image_keywords(rows: list, api_key: str) -> list:
    """
    台本行リスト [(speaker, text, se), ...] から
    いらすとや検索キーワードを一括生成する。
    戻り値: keywords[i] は rows[i] に対応する文字列
    """
    lines = [f"【{spk}】{txt}" for spk, txt, _ in rows]
    prompt = (
        "以下の台本の各セリフに合う「いらすとや」の検索キーワードを生成してください。\n"
        "各セリフに対して、2〜5文字の日本語キーワードを1つ生成してください。\n"
        "いらすとやで実際に検索できるシンプルな名詞にしてください（例：スマホ、買い物、家電、女性）。\n"
        "出力形式：各行に1キーワードのみ。入力と同じ行数で出力すること。説明や番号は不要。\n\n"
        "台本:\n" + "\n".join(lines)
    )
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024},
    }).encode("utf-8")
    url = f"{_GEMINI_URL}?key={api_key}"
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()
    keywords = [k.strip() for k in raw.split("\n") if k.strip()]
    # 行数を入力と合わせる
    while len(keywords) < len(rows):
        keywords.append("女性")
    return keywords[:len(rows)]


# ── イラストAC リンク集 HTML 生成 ────────────────────────────────────────────

def generate_ac_links_html(voice_records: list, keywords: list, out_path: str) -> None:
    """
    セリフ × キーワード一覧 HTML を生成する。
    いらすとや / イラストAC の検索リンクをワンクリックで開けるようにする。
    """
    # 重複キーワードを除去（順序保持）
    seen = {}
    for i, (_, _, speaker, text) in enumerate(voice_records):
        kw = keywords[i]
        if kw not in seen:
            seen[kw] = {"speaker": speaker, "text": text[:30], "lines": 1}
        else:
            seen[kw]["lines"] += 1

    rows_html = ""
    for idx, (kw, info) in enumerate(seen.items(), 1):
        ira_url = f"https://www.irasutoya.com/search?q={urllib.parse.quote(kw)}"
        # なのなのな作家に絞って検索
        ac_url  = (
            f"https://www.ac-illust.com/main/search_result.php"
            f"?search_word={urllib.parse.quote(kw)}"
            f"&sl=ja&creator=%E3%81%AA%E3%81%AE%E3%81%AA%E3%81%AE%E3%81%AA"
            f"&srt=-releasedate&orientation=all&format=all&crtsec=allsec=all"
        )
        ellipsis = "…" if len(info["text"]) == 30 else ""
        rows_html += (
            f'<tr>'
            f'<td class="num">{idx}</td>'
            f'<td class="kw">{kw}</td>'
            f'<td class="sp">{info["speaker"]}</td>'
            f'<td class="tx">{info["text"]}{ellipsis}</td>'
            f'<td><a href="{ira_url}" target="_blank">いらすとや 🔍</a></td>'
            f'<td><a href="{ac_url}" target="_blank">イラストAC 🔍</a></td>'
            f'</tr>\n'
        )

    # イラストAC URLリスト（JS用）
    ac_urls_js = ", ".join(
        f'"{( "https://www.ac-illust.com/main/search_result.php" + "?search_word=" + urllib.parse.quote(kw) + "&sl=ja&creator=%E3%81%AA%E3%81%AE%E3%81%AA%E3%81%AE%E3%81%AA" + "&srt=-releasedate&orientation=all&format=all" )}"'
        for kw in seen
    )

    html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>画像キーワードリスト</title>
<style>
  body {{ font-family: sans-serif; padding: 20px; background: #f8f5f0; }}
  h1 {{ font-size: 18px; color: #3D3530; margin-bottom: 6px; }}
  p.note {{ color: #666; font-size: 13px; margin-bottom: 12px; }}
  .btn-wrap {{ margin-bottom: 16px; display: flex; gap: 10px; align-items: center; }}
  .btn {{
    padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;
    font-size: 14px; font-weight: bold; white-space: nowrap;
  }}
  .btn-ac {{ background: #e8562a; color: white; }}
  .btn-ac:hover {{ background: #c94520; }}
  .btn-ira {{ background: #4caf50; color: white; }}
  .btn-ira:hover {{ background: #388e3c; }}
  .btn-note {{ font-size: 12px; color: #888; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th {{ background: #8C7B6E; color: white; padding: 8px 12px; text-align: left; }}
  td {{ padding: 7px 12px; border-bottom: 1px solid #ddd; font-size: 14px; }}
  tr:hover td {{ background: #f0ebe5; }}
  .num {{ width: 40px; color: #999; }}
  .kw {{ font-weight: bold; color: #3D3530; width: 100px; }}
  .sp {{ color: #8C7B6E; width: 90px; }}
  .tx {{ color: #555; }}
  a {{ color: #2563eb; text-decoration: none; white-space: nowrap; }}
  a:hover {{ text-decoration: underline; }}
</style>
</head>
<body>
<h1>🖼 画像キーワードリスト</h1>
<p class="note">
  ✅ <b>いらすとや</b>：ymmpに自動挿入済み　／　🖊 <b>イラストAC（なのなのな）</b>：下のボタンで一括検索 → DL → <code>使用画像/</code> に保存 → YMM4で差し替え
</p>
<div class="btn-wrap">
  <button class="btn btn-ac" onclick="openAllAC()">🔍 イラストAC（なのなのな）を全キーワードで一括検索</button>
  <span class="btn-note">※ポップアップブロックを解除してください</span>
</div>
<table>
<tr>
  <th>#</th><th>キーワード</th><th>話者</th><th>セリフ（冒頭）</th>
  <th>いらすとや</th><th>イラストAC（なのなのな）</th>
</tr>
{rows_html}
</table>
<script>
const acUrls = [{ac_urls_js}];
function openAllAC() {{
  acUrls.forEach((url, i) => {{
    setTimeout(() => window.open(url, '_blank'), i * 300);
  }});
}}
</script>
</body>
</html>"""

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)


# ── Google Sheets / Amazon 商品画像 ──────────────────────────────────────────

def google_get_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    """リフレッシュトークンからGoogleアクセストークンを取得する"""
    body = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["access_token"]


def sheets_read_product_list(spreadsheet_id: str, sheet_name: str, access_token: str) -> list:
    """
    Google Sheetsの「商品リスト」シートを読み込む。
    列構成: A=No. / B=商品名型番（代表例）/ C=商品リンク
    戻り値: [(商品名, Amazon_URL), ...]
    """
    encoded_sheet = urllib.parse.quote(sheet_name)
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
        f"/values/{encoded_sheet}!A:C"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [商品リスト取得失敗] {e}")
        return []

    rows = data.get("values", [])
    products = []
    for row in rows[1:]:  # 1行目はヘッダーとしてスキップ
        if len(row) >= 3:
            name = row[1].strip()   # B列: 商品名型番
            link = row[2].strip()   # C列: 商品リンク
            if name and link:
                products.append((name, link))
    return products


def amazon_asin_from_url(url: str) -> str | None:
    """Amazon URLからASIN（10桁英数字）を抽出する"""
    m = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', url)
    return m.group(1) if m else None


def amazon_image_download(amazon_url: str, dest_dir: str, product_name: str) -> str | None:
    """
    Amazon商品URLから商品画像をダウンロードしてローカルパスを返す。
    同一商品は再ダウンロードしない（キャッシュ）。
    """
    asin = amazon_asin_from_url(amazon_url)
    if not asin:
        print(f"  [Amazon画像スキップ] ASINが取得できません: {amazon_url}")
        return None

    safe = re.sub(r'[\\/:*?"<>|]', '_', product_name)[:40]
    out_path = os.path.join(dest_dir, f"amz_{safe}.jpg")

    # キャッシュ確認
    if os.path.exists(out_path):
        return out_path

    # Amazon画像URL（ASINから直接組み立て）
    img_url = f"https://m.media-amazon.com/images/P/{asin}.01._SL500_.jpg"
    req = urllib.request.Request(
        img_url,
        headers={"User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            img_data = resp.read()
        if len(img_data) < 1000:
            print(f"  [Amazon画像取得失敗] 画像が空です: {product_name}")
            return None
        with open(out_path, "wb") as f:
            f.write(img_data)
        print(f"  [Amazon画像DL] {product_name} (ASIN:{asin}) → {os.path.basename(out_path)}")
        return out_path
    except Exception as e:
        print(f"  [Amazon画像DL失敗] {product_name}: {e}")
        return None


def find_product_in_text(text: str, products: list) -> tuple | None:
    """
    セリフテキストに商品名が含まれるか確認する。
    戻り値: マッチした (商品名, Amazon_URL) または None
    """
    for name, link in products:
        if name in text:
            return (name, link)
    return None


# ── Google Drive 監視 ────────────────────────────────────────────────────────

_DRIVE_API = "https://www.googleapis.com/drive/v3"


def drive_list_new_tsvs(folder_id: str, access_token: str) -> list:
    """
    DriveフォルダからTSVファイル（未処理）一覧を取得する。
    _done.tsv は除外。
    戻り値: [(file_id, name), ...]
    """
    q = (
        f"'{folder_id}' in parents "
        "and name contains '.tsv' "
        "and not name contains '_done' "
        "and trashed = false"
    )
    params = urllib.parse.urlencode({
        "q": q,
        "fields": "files(id,name)",
        "orderBy": "createdTime",
    })
    url = f"{_DRIVE_API}/files?{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return [(f["id"], f["name"]) for f in data.get("files", [])]
    except Exception as e:
        print(f"  [Drive一覧取得失敗] {e}")
        return []


def drive_download_file(file_id: str, dest_path: str, access_token: str) -> None:
    """DriveファイルをローカルにDLする"""
    url = f"{_DRIVE_API}/files/{file_id}?alt=media"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        with open(dest_path, "wb") as f:
            f.write(resp.read())


def drive_rename_file(file_id: str, new_name: str, access_token: str) -> None:
    """DriveファイルをリネームするPATCHリクエスト"""
    url = f"{_DRIVE_API}/files/{file_id}?fields=name"
    body = json.dumps({"name": new_name}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


# ── いらすとや スクレイピング ─────────────────────────────────────────────────

_IRASUTOYA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def irasutoya_download(keyword: str, dest_dir: str) -> str | None:
    """
    いらすとやを検索して最初の画像をダウンロードし、ローカルパスを返す。
    同一キーワードは再ダウンロードしない（キャッシュ）。
    失敗した場合は None を返す。
    """
    safe = re.sub(r'[\\/:*?"<>|]', '_', keyword)[:40]

    # キャッシュ確認（拡張子問わず）
    for fname in os.listdir(dest_dir):
        if os.path.splitext(fname)[0] == safe:
            return os.path.join(dest_dir, fname)

    # いらすとや検索
    query = urllib.parse.quote(keyword)
    search_url = f"https://www.irasutoya.com/search?q={query}"
    req = urllib.request.Request(search_url, headers=_IRASUTOYA_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"    [画像検索失敗] {keyword}: {e}")
        return None

    # blogspot CDN サムネURL抽出
    thumb_matches = re.findall(
        r'//[0-9]+\.bp\.blogspot\.com/[^"\'>\s]+\.(?:png|jpg|gif)',
        html, re.IGNORECASE
    )
    if not thumb_matches:
        print(f"    [画像なし] 「{keyword}」: 検索結果なし")
        return None

    # サムネ → フルサイズURL（/s200/ や /s320/ → /s0/）
    thumb_url = "https:" + thumb_matches[0]
    full_url = re.sub(r'/s\d+(-[a-z])?/', '/s0/', thumb_url)

    ext = os.path.splitext(urllib.parse.urlparse(full_url).path)[-1] or ".png"
    out_path = os.path.join(dest_dir, f"{safe}{ext}")

    req2 = urllib.request.Request(
        full_url, headers={**_IRASUTOYA_HEADERS, "Referer": search_url}
    )
    try:
        with urllib.request.urlopen(req2, timeout=15) as resp:
            with open(out_path, "wb") as f:
                f.write(resp.read())
        return out_path
    except Exception as e:
        print(f"    [画像DL失敗] 「{keyword}」({full_url}): {e}")
        return None


# ── ImageItem 生成 ────────────────────────────────────────────────────────────

def _make_anim_param(value: float) -> dict:
    """アニメーションパラメータ（AnimationType=なし）を生成する"""
    bezier = {
        "Points": [
            {
                "Point": {"X": 0.0, "Y": 0.0},
                "ControlPoint1": {"X": -0.3, "Y": -0.3},
                "ControlPoint2": {"X": 0.3, "Y": 0.3},
            },
            {
                "Point": {"X": 1.0, "Y": 1.0},
                "ControlPoint1": {"X": -0.3, "Y": -0.3},
                "ControlPoint2": {"X": 0.3, "Y": 0.3},
            },
        ],
        "IsQuadratic": False,
    }
    return {
        "Values": [{"Value": value}],
        "AnimationType": "なし",
        "Span": 0.0,
        "Bezier": bezier,
    }


def _make_repeat_zoom_effect() -> dict:
    """RepeatZoomEffect（反復拡大縮小）エフェクトを生成する"""
    return {
        "$type": "YukkuriMovieMaker.Project.Effects.RepeatZoomEffect, YukkuriMovieMaker",
        "Zoom": _make_anim_param(95.0),    # 95〜100% で繰り返しズーム
        "ZoomX": _make_anim_param(100.0),
        "ZoomY": _make_anim_param(100.0),
        "Span": _make_anim_param(2.0),     # 2秒周期
        "EasingType": "Sine",
        "EasingMode": "InOut",
        "IsCentering": True,
        "IsEnabled": True,
        "Remark": "",
    }


def build_image_item(proto_image: dict, file_path: str, frame: int, length: int) -> dict:
    """
    テンプレートのImageItemをプロトタイプとして
    いらすとや画像のImageItemを生成する。
    """
    item = copy.deepcopy(proto_image)
    item["FilePath"] = file_path
    item["Frame"] = frame
    item["Length"] = length
    item["Layer"] = config["image_layer"]
    item["Zoom"] = _make_anim_param(config["image_zoom"])
    item["X"] = _make_anim_param(config["image_x"])
    item["Y"] = _make_anim_param(config["image_y"])
    item["Rotation"] = _make_anim_param(0.0)
    item["VideoEffects"] = [_make_repeat_zoom_effect()]
    return item


# ── TSV読み込み ───────────────────────────────────────────────────────────────

def read_tsv(tsv_path: str) -> list:
    """
    TSVを読み込んで (speaker, text, se) のリストを返す
    se は "" / "SE1" / "SE2"
    """
    rows = []
    with open(tsv_path, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.rstrip("\n\r")
            if not line:
                continue
            parts = line.split("\t")
            speaker = parts[0].strip() if len(parts) > 0 else ""
            text    = parts[1].strip() if len(parts) > 1 else ""
            se      = parts[3].strip() if len(parts) > 3 else ""
            if speaker and text:
                rows.append((speaker, text, se))
    return rows


# ── メイン処理 ────────────────────────────────────────────────────────────────

def process_tsv(tsv_path: str) -> None:
    """TSVファイルを読み込んでymmpを生成する"""
    tsv_path = os.path.abspath(tsv_path)
    print(f"\n[処理開始] {os.path.basename(tsv_path)}")

    # ── 1. TSV読み込み
    rows = read_tsv(tsv_path)
    if not rows:
        print("  [スキップ] TSVが空です")
        return

    # ── 2. テンプレート読み込み
    print("  テンプレート読み込み中...")
    with open(config["template_path"], "r", encoding="utf-8-sig") as f:
        ymmp = json.load(f)

    timeline = ymmp["Timelines"][0]
    all_items = timeline["Items"]

    # ── 3. 既存アイテムを分類
    voice_type = "YukkuriMovieMaker.Project.Items.VoiceItem, YukkuriMovieMaker"
    audio_type = "YukkuriMovieMaker.Project.Items.AudioItem, YukkuriMovieMaker"
    image_type = "YukkuriMovieMaker.Project.Items.ImageItem, YukkuriMovieMaker"

    # プロトタイプVoiceItemを抽出（CharacterName.strip() → item）
    proto_voice: dict = {}
    for item in all_items:
        if item.get("$type") == voice_type:
            name = item["CharacterName"].strip()
            if name not in proto_voice:
                proto_voice[name] = item

    # プロトタイプAudioItemを抽出（SE用）
    proto_audio = None
    for item in all_items:
        if item.get("$type") == audio_type:
            fp = item.get("FilePath", "")
            if "セリフ切替SE" in fp or "SE1" in fp or "SE2" in fp:
                proto_audio = item
                break
    if proto_audio is None:
        for item in all_items:
            if item.get("$type") == audio_type:
                proto_audio = item
                break

    # プロトタイプImageItemを抽出（Layer=2 のキャラ画像を優先）
    # ※ image_layer=2 に合わせてLayer=2を優先。なければ任意のImageItemを使用
    proto_image = None
    for item in all_items:
        if item.get("$type") == image_type and item.get("Layer") == 2:
            proto_image = item
            break
    if proto_image is None:
        for item in all_items:
            if item.get("$type") == image_type:
                proto_image = item
                break

    # VoiceItem（Frame>=524のみ）とSE AudioItemを除いたベースアイテム
    # ※イントロVoiceItem（Frame<524: ナレーション/タイトル/「それでは行ってみよう」）は残す
    base_items = [
        item for item in all_items
        if not (item.get("$type") == voice_type and item.get("Frame", 0) >= 524)
        and not (item.get("$type") == audio_type
                 and ("セリフ切替SE" in item.get("FilePath", "")
                      or ("SE1" in item.get("FilePath", ""))
                      or ("SE2" in item.get("FilePath", ""))))
    ]

    # ── 4. 各行のVoiceItem生成
    print(f"  音声生成中... ({len(rows)}行)")
    new_items = []
    voice_records = []   # (start_frame, length_frames, speaker, text)
    current_frame = 524  # イントロ終了後（Frame=524）から本文配置を開始

    for idx, (speaker, text, se) in enumerate(rows):
        char_key = speaker.strip()
        if char_key not in CHARACTER_MAP:
            print(f"  [警告] 未知の話者「{char_key}」をスキップします")
            continue

        char_info = CHARACTER_MAP[char_key]
        style_id = char_info["style_id"]
        speed = char_info["speed_scale"]
        post = char_info["post_phoneme_length"]

        # プロトタイプを探す（同名のymmp_nameでマッチ）
        proto_key = char_info["ymmp_name"].strip()
        proto = proto_voice.get(proto_key)
        if proto is None:
            layer = char_info["layer"]
            for pk, pv in proto_voice.items():
                if pv.get("Layer") == layer:
                    proto = pv
                    break
        if proto is None:
            proto = next(iter(proto_voice.values()))

        # VOICEVOX呼び出し
        print(f"  [{idx+1}/{len(rows)}] {char_key}: {text[:20]}{'...' if len(text)>20 else ''}")
        try:
            aq = voicevox_audio_query(text, style_id)
            aq["speedScale"] = speed
            aq["pitchScale"] = 0.0
            aq["intonationScale"] = 1.0
            aq["volumeScale"] = 1.0
            aq["prePhonemeLength"] = 0.0
            aq["postPhonemeLength"] = post
            aq["pauseLength"] = None
            aq["pauseLengthScale"] = 1.0

            wav_bytes = voicevox_synthesis(aq, style_id)
        except Exception as e:
            raise RuntimeError(f"VOICEVOX APIエラー（{char_key}: {text[:20]}）: {e}")

        voice_item, length_frames = build_voice_item(
            proto, char_info, text, aq, wav_bytes, current_frame
        )
        new_items.append(voice_item)
        voice_records.append((current_frame, length_frames, speaker, text))
        current_frame += length_frames

        # SE挿入
        if se in ("SE1", "SE2"):
            se_num = 1 if se == "SE1" else 2
            if proto_audio is not None:
                se_item = build_se_item(proto_audio, se_num, current_frame)
                new_items.append(se_item)
            current_frame += config["se_length"]

    # ── 5. タイムライン更新（一旦VoiceItemのみで出力フォルダを確定）
    tsv_basename = os.path.basename(tsv_path)
    stem = re.sub(r"(_\d{8})?\.tsv$", "", tsv_basename, flags=re.IGNORECASE)
    if not stem:
        stem = os.path.splitext(tsv_basename)[0]

    out_folder = os.path.join(config["output_dir"], stem)
    os.makedirs(out_folder, exist_ok=True)
    out_path = os.path.join(out_folder, f"{stem}.ymmp")

    # ── 6. 画像自動挿入（GEMINI_API_KEY が設定されていて、プロトImageItemがある場合）
    image_items = []
    gemini_key = config.get("gemini_api_key", "")
    if gemini_key and proto_image is not None and voice_records:
        print(f"  画像キーワード生成中... (Gemini API, {len(voice_records)}件)")
        try:
            rows_for_kw = [(spk, txt, "") for _, _, spk, txt in voice_records]
            keywords = gemini_generate_image_keywords(rows_for_kw, gemini_key)

            images_dir = os.path.join(out_folder, config["image_folder_name"])
            os.makedirs(images_dir, exist_ok=True)

            # ── 商品リスト読み込み（Sheets API）
            product_list = []
            g_client_id     = config.get("google_client_id", "")
            g_client_secret = config.get("google_client_secret", "")
            g_refresh       = config.get("google_refresh_token", "")
            sheets_id       = config.get("spreadsheet_id", "")
            if sheets_id and g_client_id and g_client_secret and g_refresh:
                try:
                    print("  商品リスト読み込み中 (Google Sheets)...")
                    access_token = google_get_access_token(g_client_id, g_client_secret, g_refresh)
                    product_list = sheets_read_product_list(
                        sheets_id, config["product_sheet_name"], access_token
                    )
                    if product_list:
                        print(f"  商品リスト: {len(product_list)}件 "
                              f"({', '.join(n for n, _ in product_list[:3])}{'...' if len(product_list)>3 else ''})")
                    else:
                        print("  商品リスト: 0件（このスクリプトに商品なし）")
                except Exception as e:
                    print(f"  [商品リスト取得失敗] {e} → いらすとやのみで続行")

            # イラストAC リンク集 HTML を生成（キーワード確定後すぐ）
            ac_html_path = os.path.join(out_folder, "イラストACリンク集.html")
            generate_ac_links_html(voice_records, keywords, ac_html_path)
            print(f"  リンク集生成: {ac_html_path}")

            img_cache = {}  # key → local path (None = DL失敗 or スキップ)
            max_images = config.get("image_max", 20)
            dl_count = 0   # いらすとやのダウンロード済み枚数

            for i, (frame, length, speaker, text) in enumerate(voice_records):
                kw = keywords[i]

                # ── 商品マッチング確認
                matched = find_product_in_text(text, product_list)
                if matched:
                    p_name, p_link = matched
                    cache_key = f"__amz__{p_name}"
                    if cache_key not in img_cache:
                        print(f"  [{i+1}/{len(voice_records)}] 商品画像: 「{p_name}」")
                        img_cache[cache_key] = amazon_image_download(p_link, images_dir, p_name)
                    img_path = img_cache.get(cache_key)
                else:
                    # ── いらすとや（従来通り）
                    if kw not in img_cache:
                        if dl_count >= max_images:
                            print(f"  [上限到達] {max_images}枚でいらすとや挿入を終了")
                            img_cache[kw] = None
                        else:
                            print(f"  [{i+1}/{len(voice_records)}] 画像検索: 「{kw}」({dl_count+1}/{max_images})")
                            img_cache[kw] = irasutoya_download(kw, images_dir)
                            if img_cache[kw]:
                                dl_count += 1
                    img_path = img_cache.get(kw)

                if img_path and os.path.exists(img_path):
                    img_item = build_image_item(proto_image, img_path, frame, length)
                    image_items.append(img_item)

            print(f"  画像挿入: {len(image_items)}件 (Amazon商品画像 + いらすとや)")
        except Exception as e:
            print(f"  [画像生成スキップ] エラーが発生しました: {e}")
            traceback.print_exc()
    elif not gemini_key:
        print("  [画像スキップ] GEMINI_API_KEY が設定されていません")
    elif proto_image is None:
        print("  [画像スキップ] テンプレートにImageItemが見つかりません")

    # ── 7. 背景ビデオ延長・エンディング移動
    # コンテンツ終端フレーム（VoiceItem配置後）
    content_end = current_frame
    video_type = "YukkuriMovieMaker.Project.Items.VideoItem, YukkuriMovieMaker"

    # バブル背景VideoItem と エンディングVideoItemを特定
    bg_bubble = None
    ending_video = None
    for item in base_items:
        if item.get("$type") == video_type:
            fp = item.get("FilePath", "")
            fr = item.get("Frame", 0)
            if "バブル" in fp or fr == 524:
                if bg_bubble is None:
                    bg_bubble = item
            elif fr >= 1845:
                if ending_video is None:
                    ending_video = item

    # バブル背景をタイリングしてcontent_endまで延長
    if bg_bubble is not None:
        tile_length = bg_bubble.get("Length", 1321)
        tile_start = bg_bubble.get("Frame", 524)
        next_frame = tile_start + tile_length
        while next_frame < content_end:
            new_tile = copy.deepcopy(bg_bubble)
            new_tile["Frame"] = next_frame
            new_tile["Length"] = min(tile_length, content_end - next_frame + tile_length)
            base_items.append(new_tile)
            next_frame += tile_length

    # エンディングVideoItemをコンテンツ終端に移動
    ending_length = 904  # デフォルト値
    if ending_video is not None:
        ending_length = ending_video.get("Length", 904)
        ending_video["Frame"] = content_end

    # ── 8. タイムライン更新・保存
    timeline["Items"] = base_items + new_items + image_items
    timeline["Length"] = content_end + ending_length

    print(f"  ymmp保存中... → {out_path}")
    with open(out_path, "w", encoding="utf-8-sig") as f:
        json.dump(ymmp, f, ensure_ascii=False, separators=(",", ":"))

    # ── 8. TSVを _done にリネーム
    done_path = re.sub(r"\.tsv$", "_done.tsv", tsv_path, flags=re.IGNORECASE)
    os.rename(tsv_path, done_path)

    print(f"  [完了] 処理済み: {os.path.basename(done_path)}")
    print(f"         出力: {out_path}")
    if image_items:
        print(f"         画像: {os.path.join(out_folder, config['image_folder_name'])}")
        ac_html = os.path.join(out_folder, "イラストACリンク集.html")
        if os.path.exists(ac_html):
            print(f"         イラストACリンク集: {ac_html}")
            # ブラウザで自動オープン（Windowsのみ）
            try:
                os.startfile(ac_html)
                print(f"  [ブラウザ起動] イラストACリンク集を開きました")
            except Exception:
                pass


# ── ウォッチモード ─────────────────────────────────────────────────────────────

def watch_mode() -> None:
    """ローカルフォルダ + Google Drive を監視して新しいTSVを自動処理する"""
    watch_dir = config["watch_dir"]
    os.makedirs(watch_dir, exist_ok=True)

    gemini_status = "有効" if config.get("gemini_api_key") else "無効（GEMINI_API_KEY未設定）"
    folder_id = config.get("folder_id_galchan", "")
    drive_enabled = bool(
        folder_id
        and config.get("google_client_id")
        and config.get("google_client_secret")
        and config.get("google_refresh_token")
    )
    drive_status = f"有効（{folder_id[:20]}...）" if drive_enabled else "無効（FOLDER_ID_GALCHAN または Google認証情報が未設定）"

    print(f"[ウォッチモード] ローカル監視: {watch_dir}")
    print(f"                 Drive 監視: {drive_status}")
    print(f"                 画像自動挿入: {gemini_status}")
    print("Ctrl+C で終了")

    drive_access_token: str | None = None
    drive_token_expires: float = 0.0  # unixtime

    while True:
        try:
            # ── Google Drive から新しいTSVをダウンロード ──────────────────
            if drive_enabled:
                now = time.time()
                if drive_access_token is None or now >= drive_token_expires:
                    try:
                        drive_access_token = google_get_access_token(
                            config["google_client_id"],
                            config["google_client_secret"],
                            config["google_refresh_token"],
                        )
                        drive_token_expires = now + 3500  # ~1時間
                    except Exception as e:
                        print(f"  [Drive認証失敗] {e}")
                        drive_access_token = None

                if drive_access_token:
                    new_tsvs = drive_list_new_tsvs(folder_id, drive_access_token)
                    for file_id, name in new_tsvs:
                        dest = os.path.join(watch_dir, name)
                        if not os.path.exists(dest):
                            print(f"  [Drive→ローカル] {name}")
                            try:
                                drive_download_file(file_id, dest, drive_access_token)
                                # Drive側を _done にリネーム（再DL防止）
                                done_name = re.sub(r"\.tsv$", "_done.tsv", name, flags=re.IGNORECASE)
                                drive_rename_file(file_id, done_name, drive_access_token)
                                print(f"  [Drive リネーム] {name} → {done_name}")
                            except Exception as e:
                                print(f"  [Drive DL失敗] {name}: {e}")

            # ── ローカルフォルダのTSVを処理 ──────────────────────────────
            tsv_files = [
                os.path.join(watch_dir, f)
                for f in os.listdir(watch_dir)
                if f.lower().endswith(".tsv") and not f.lower().endswith("_done.tsv")
            ]
            for tsv_path in sorted(tsv_files):
                try:
                    process_tsv(tsv_path)
                except Exception as e:
                    print(f"\n[エラー] {os.path.basename(tsv_path)}: {e}")
                    traceback.print_exc()
                    _show_error_popup(str(e))

        except KeyboardInterrupt:
            print("\n[終了]")
            break
        except Exception as e:
            print(f"[予期せぬエラー] {e}")
            traceback.print_exc()

        time.sleep(config["poll_interval"])


def _show_error_popup(message: str) -> None:
    """Windowsのエラーポップアップ表示（オプション）"""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(
            0, message, "galchan_auto エラー", 0x10
        )
    except Exception:
        pass


# ── エントリーポイント ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # 手動モード: 引数にTSVパスを指定
        tsv_path = sys.argv[1]
        if not os.path.isfile(tsv_path):
            print(f"[エラー] ファイルが見つかりません: {tsv_path}")
            sys.exit(1)
        try:
            process_tsv(tsv_path)
        except Exception as e:
            print(f"[エラー] {e}")
            traceback.print_exc()
            _show_error_popup(str(e))
            sys.exit(1)
    else:
        # ウォッチモード
        watch_mode()
