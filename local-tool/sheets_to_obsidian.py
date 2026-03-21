# -*- coding: utf-8 -*-
"""
sheets_to_obsidian.py
ガルちゃんスプレッドシート -> Obsidian一元管理スクリプト

取得対象:
  1. 自分チャンネル・動画管理表 -> 自分動画/動画管理リスト.md
  2. 競合チャンネル・動画管理表 -> 競合分析/競合チャンネルリスト.md

除外:
  - 各台本スプシの内容（台本はスプシのまま管理）
  - テンプレート説明行
"""

import os
import json
import requests
from pathlib import Path
from datetime import datetime, timedelta

def _load_env():
    """プロジェクトルートの .env.local から環境変数を読み込む"""
    env_path = Path(__file__).parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

_load_env()

CLIENT_ID      = os.environ["GOOGLE_CLIENT_ID"]
CLIENT_SECRET  = os.environ["GOOGLE_CLIENT_SECRET"]
REFRESH_TOKEN  = os.environ["GOOGLE_REFRESH_TOKEN"]
SPREADSHEET_ID = os.environ["SPREADSHEET_ID_GALCHAN"]
OBSIDIAN_PATH  = Path(os.environ.get(
    "OBSIDIAN_VAULT_PATH",
    r"C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる"
))
CHANNEL_ID     = os.environ.get("YOUTUBE_CHANNEL_ID_GALCHAN", "")

def p(msg):
    print(msg, flush=True)

def today():
    return datetime.now().strftime("%Y-%m-%d")

def safe(row, idx, default=""):
    if idx < len(row):
        return str(row[idx]).strip().replace("\r\n", "\n").replace("\r", "\n")
    return default

# -- Google認証 -----------------------------------------------------------
def get_token():
    resp = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN, "grant_type": "refresh_token",
    })
    resp.raise_for_status()
    return resp.json()["access_token"]

def get_values(token, range_):
    resp = requests.get(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{range_}",
        headers={"Authorization": f"Bearer {token}"}
    )
    resp.raise_for_status()
    return resp.json().get("values", [])

# -- 自分チャンネル 動画管理リスト -> MD -----------------------------------
def build_own_md(rows):
    """
    行7(index6): チャンネル情報ヘッダー
    行8(index7): チャンネル情報データ
    行10(index9): 動画ヘッダー (台本名, 台本リンク, テーマ, タイトル ...)
    行11以降: 動画データ
    """
    lines = [
        "---",
        f"updated: {today()}",
        "tags: [galchan, own-channel]",
        "---",
        "",
        "# 自分チャンネル 動画管理リスト",
        f"> 最終更新: {today()}",
        "",
    ]

    # チャンネル情報行を探す
    ch_header_idx = -1
    vid_header_idx = -1
    for i, row in enumerate(rows):
        row_str = " ".join(str(c) for c in row[:20])
        if ch_header_idx < 0 and ("チャンネル名" in row_str or "自分チャンネルURL" in row_str):
            ch_header_idx = i
        if "台本名" in row_str and ("タイトル" in row_str or "テーマ" in row_str):
            vid_header_idx = i
            break

    # チャンネル情報 (主要フィールドのみ、コンセプト全文は除外)
    if ch_header_idx >= 0:
        ch_hdr = rows[ch_header_idx]
        ch_dat = rows[ch_header_idx + 1] if ch_header_idx + 1 < len(rows) else []
        lines.append("## チャンネル情報")
        skip_keys = {"コンセプト全文", "概要欄冒頭2.3行"}
        for j, h in enumerate(ch_hdr):
            val = safe(ch_dat, j)
            h_str = str(h).strip()
            if val and h_str and h_str not in skip_keys and len(val) < 200:
                lines.append(f"- **{h_str}**: {val[:100].replace(chr(10), ' ')}")
        lines.append("")

    # 動画リスト
    if vid_header_idx >= 0:
        headers = rows[vid_header_idx]
        # 主要列のみ表示
        show = ["投稿日", "台本名", "テーマ", "タイトル", "台本リンク"]
        col_map = {}
        for kc in show:
            for j, h in enumerate(headers):
                if kc in str(h):
                    col_map[kc] = j
                    break

        lines.append("## 動画リスト")
        lines.append("")
        lines.append("| " + " | ".join(show) + " |")
        lines.append("|" + "---|" * len(show))

        for row in rows[vid_header_idx + 1:]:
            if not any(row):
                continue
            cells = []
            for kc in show:
                idx = col_map.get(kc, -1)
                val = safe(row, idx)[:60].replace("|", "｜").replace("\n", " ") if idx >= 0 else ""
                # 台本リンクはMarkdownリンクに変換
                if kc == "台本リンク" and val.startswith("http"):
                    val = f"[link]({val})"
                cells.append(val)
            lines.append("| " + " | ".join(cells) + " |")

    return "\n".join(lines) + "\n"

# -- 競合チャンネルリスト -> MD --------------------------------------------
def build_rival_md(rows):
    lines = [
        "---",
        f"updated: {today()}",
        "tags: [galchan, rival]",
        "---",
        "",
        "# 競合チャンネル・動画リスト",
        f"> 最終更新: {today()}",
        "",
    ]

    # ヘッダー行を探す（テンプレート説明行をスキップ）
    header_idx = -1
    for i, row in enumerate(rows):
        row_str = " ".join(str(c) for c in row[:8])
        if ("チャンネル名" in row_str or "URL" in row_str) and "ベンチマーク" in row_str:
            header_idx = i
            break
        # フォールバック: 「※」がない行でURLらしきものがある
        if i > 5 and "http" in row_str and "※" not in row_str:
            header_idx = i - 1 if i > 0 else i
            break

    if header_idx < 0:
        # データが見つからない場合はそのまま出力
        for row in rows[5:]:
            if any(row):
                lines.append("| " + " | ".join(str(c)[:60] for c in row[:8]) + " |")
        return "\n".join(lines) + "\n"

    headers = rows[header_idx][:8]
    lines.append("| " + " | ".join(str(h) for h in headers) + " |")
    lines.append("|" + "---|" * len(headers))

    for row in rows[header_idx + 1:]:
        if not any(row):
            continue
        cells = [safe(row, j)[:60].replace("|", "｜").replace("\n", " ") for j in range(len(headers))]
        while len(cells) < len(headers):
            cells.append("")
        lines.append("| " + " | ".join(cells) + " |")

    return "\n".join(lines) + "\n"

# -- YouTube Analytics ----------------------------------------------------
def get_channel_analytics(token):
    """
    YouTube Analytics API で過去90日のチャンネル全体データを取得。
    戻り値: dict (views, watchTimeMinutes, subscribers, estimatedRevenue など)
    スコープ不足時は None を返す（スキップ）
    """
    end = datetime.now().date()
    start = end - timedelta(days=90)
    resp = requests.get(
        "https://youtubeanalytics.googleapis.com/v2/reports",
        params={
            "ids": f"channel=={CHANNEL_ID}",
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "metrics": "views,estimatedMinutesWatched,subscribersGained,subscribersLost",
            "dimensions": "day",
            "sort": "day",
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    if resp.status_code == 403:
        return None  # スコープ未付与
    resp.raise_for_status()
    return resp.json()

def get_video_analytics(token, video_ids):
    """動画別の直近30日アナリティクス。戻り値: {videoId: {views, watchTime, ...}}"""
    if not video_ids or not CHANNEL_ID:
        return {}
    ids_str = ",".join(video_ids[:50])
    end = datetime.now().date()
    start = end - timedelta(days=30)
    resp = requests.get(
        "https://youtubeanalytics.googleapis.com/v2/reports",
        params={
            "ids": f"channel=={CHANNEL_ID}",
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "metrics": "views,estimatedMinutesWatched,averageViewDuration,subscribersGained",
            "dimensions": "video",
            "filters": f"video=={ids_str}",
            "sort": "-views",
            "maxResults": 50,
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    if resp.status_code == 403:
        return {}
    resp.raise_for_status()
    data = resp.json()
    result = {}
    headers = [h["name"] for h in data.get("columnHeaders", [])]
    for row in data.get("rows", []):
        row_dict = dict(zip(headers, row))
        vid_id = row_dict.get("video", "")
        if vid_id:
            result[vid_id] = row_dict
    return result

def build_analytics_md(channel_data, video_data):
    """アナリティクスデータをMarkdownに変換"""
    lines = [
        "---",
        f"updated: {today()}",
        "tags: [galchan, analytics]",
        "---",
        "",
        "# YouTubeアナリティクス",
        f"> 最終更新: {today()} / 過去90日データ",
        "",
    ]
    if channel_data:
        rows = channel_data.get("rows", [])
        if rows:
            total_views = sum(r[1] for r in rows)
            total_watch = sum(r[2] for r in rows)
            total_gained = sum(r[3] for r in rows)
            total_lost = sum(r[4] for r in rows) if len(rows[0]) > 4 else 0
            lines += [
                "## チャンネル全体（過去90日）",
                f"- 総再生回数: {int(total_views):,}",
                f"- 総視聴時間: {int(total_watch):,} 分",
                f"- 登録者増加: +{int(total_gained)} / -{int(total_lost)}",
                "",
                "## 日別推移",
                "",
                "| 日付 | 再生数 | 視聴時間(分) | 登録者増 |",
                "|---|---|---|---|",
            ]
            for r in rows[-30:]:  # 直近30日
                lines.append(f"| {r[0]} | {int(r[1]):,} | {int(r[2]):,} | +{int(r[3])} |")
            lines.append("")
    else:
        lines += [
            "## チャンネル全体",
            "> ⚠️ YouTube Analytics スコープ未付与のため取得不可。get_token.py を再実行してください。",
            "",
        ]
    if video_data:
        lines += [
            "## 動画別（過去30日）",
            "",
            "| 動画ID | 再生数 | 視聴時間(分) | 平均視聴時間(秒) | 登録者増 |",
            "|---|---|---|---|---|",
        ]
        for vid_id, d in video_data.items():
            lines.append(
                f"| {vid_id} | {int(d.get('views',0)):,} | "
                f"{int(d.get('estimatedMinutesWatched',0)):,} | "
                f"{int(d.get('averageViewDuration',0))} | "
                f"+{int(d.get('subscribersGained',0))} |"
            )
        lines.append("")
    return "\n".join(lines) + "\n"

# -- メイン ---------------------------------------------------------------
def main():
    p("=== sheets_to_obsidian.py start ===")

    p("1. Getting access token...")
    token = get_token()
    p("   OK")

    p("2. Getting spreadsheet data...")
    own_rows   = get_values(token, "自分チャンネル・動画管理表!A1:AK200")
    rival_rows = get_values(token, "競合チャンネル・動画管理表!A1:AB200")
    p(f"   own: {len(own_rows)} rows, rival: {len(rival_rows)} rows")

    p("3. Creating folders...")
    for folder in ["自分動画", "競合分析", "分析結果", "ネタ候補", "台本ルール"]:
        (OBSIDIAN_PATH / folder).mkdir(parents=True, exist_ok=True)

    p("4. Writing own channel list...")
    out = OBSIDIAN_PATH / "自分動画" / "動画管理リスト.md"
    out.write_text(build_own_md(own_rows), encoding="utf-8")
    p(f"   OK: {out.name}")

    p("5. Writing rival channel list...")
    out = OBSIDIAN_PATH / "競合分析" / "競合チャンネルリスト.md"
    out.write_text(build_rival_md(rival_rows), encoding="utf-8")
    p(f"   OK: {out.name}")

    p("6. Getting YouTube Analytics...")
    channel_analytics = get_channel_analytics(token)
    if channel_analytics is None:
        p("   SKIP: YouTube Analytics scope not granted yet")
    else:
        p(f"   OK: {len(channel_analytics.get('rows', []))} days")
    out = OBSIDIAN_PATH / "自分動画" / "アナリティクス.md"
    out.write_text(build_analytics_md(channel_analytics, {}), encoding="utf-8")
    p(f"   OK: {out.name}")

    # スタブファイル作成
    stubs = {
        "分析結果/勝ちパターン.md": "# 勝ちパターン\n\n※ 分析後ここに蓄積します。\n",
        "台本ルール/台本生成ルール.md": "# 台本生成ルール\n\n※ 分析結果から抽出したルールを蓄積します。\n",
        "ネタ候補/ネタ候補リスト.md": "# ネタ候補リスト\n\n※ ネタ出し後ここに追記します。\n",
    }
    for rel, content in stubs.items():
        path = OBSIDIAN_PATH / rel
        if not path.exists():
            path.write_text(content, encoding="utf-8")
            p(f"   stub: {rel}")

    p("")
    p("=== Done ===")

if __name__ == "__main__":
    main()
