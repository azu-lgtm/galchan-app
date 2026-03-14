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
  - VOICEVOX が http://localhost:50021 で起動していること
  - 画像自動挿入には GEMINI_API_KEY 環境変数を設定すること
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
    "image_layer": 1,      # 背景レイヤー
    "image_zoom": 80.0,    # 表示サイズ（%）
    "image_x": 300.0,      # X位置（中心からのオフセット、右寄り）
    "image_y": 50.0,       # Y位置（中心からのオフセット）
    "image_folder_name": "使用画像",  # 画像保存サブフォルダ名
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

    # 位置・長さ
    item["Frame"] = frame
    item["Layer"] = char_info["layer"]
    item["Length"] = length_frames

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

    # プロトタイプImageItemを抽出（Layer=1 の背景画像を優先）
    proto_image = None
    for item in all_items:
        if item.get("$type") == image_type and item.get("Layer") == 1:
            proto_image = item
            break
    if proto_image is None:
        for item in all_items:
            if item.get("$type") == image_type:
                proto_image = item
                break

    # VoiceItemとSE AudioItemを除いたベースアイテム
    base_items = [
        item for item in all_items
        if item.get("$type") != voice_type
        and not (item.get("$type") == audio_type
                 and ("セリフ切替SE" in item.get("FilePath", "")
                      or ("SE1" in item.get("FilePath", ""))
                      or ("SE2" in item.get("FilePath", ""))))
    ]

    # ── 4. 各行のVoiceItem生成
    print(f"  音声生成中... ({len(rows)}行)")
    new_items = []
    voice_records = []   # (start_frame, length_frames, speaker, text)
    current_frame = 0

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

            img_cache = {}  # keyword → local path (None = DL失敗)
            for i, (frame, length, speaker, text) in enumerate(voice_records):
                kw = keywords[i]
                if kw not in img_cache:
                    print(f"  [{i+1}/{len(voice_records)}] 画像検索: 「{kw}」")
                    img_cache[kw] = irasutoya_download(kw, images_dir)
                img_path = img_cache.get(kw)
                if img_path and os.path.exists(img_path):
                    img_item = build_image_item(proto_image, img_path, frame, length)
                    image_items.append(img_item)

            print(f"  画像挿入: {len(image_items)}件")
        except Exception as e:
            print(f"  [画像生成スキップ] エラーが発生しました: {e}")
            traceback.print_exc()
    elif not gemini_key:
        print("  [画像スキップ] GEMINI_API_KEY が設定されていません")
    elif proto_image is None:
        print("  [画像スキップ] テンプレートにImageItemが見つかりません")

    # ── 7. タイムライン更新・保存
    timeline["Items"] = base_items + new_items + image_items
    timeline["Length"] = max(current_frame, timeline.get("Length", 0))

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


# ── ウォッチモード ─────────────────────────────────────────────────────────────

def watch_mode() -> None:
    """フォルダを監視して新しいTSVを自動処理する"""
    watch_dir = config["watch_dir"]
    os.makedirs(watch_dir, exist_ok=True)
    gemini_status = "有効" if config.get("gemini_api_key") else "無効（GEMINI_API_KEY未設定）"
    print(f"[ウォッチモード] フォルダ監視中: {watch_dir}")
    print(f"                 画像自動挿入: {gemini_status}")
    print("Ctrl+C で終了")

    while True:
        try:
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
