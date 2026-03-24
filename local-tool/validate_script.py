#!/usr/bin/env python3
"""
台本TSVバリデーター
台本生成ルール.md（Single Source of Truth）に基づく自動チェック。
"""

import sys
import json
import re
from pathlib import Path


def validate(tsv_path: str) -> dict:
    path = Path(tsv_path)
    if not path.exists():
        return {"passed": False, "error": f"File not found: {tsv_path}"}

    raw = path.read_text(encoding="utf-8-sig")  # BOM除去
    lines = raw.splitlines()
    issues = []
    stats = {}

    # --- 基本情報 ---
    total = len(lines)
    stats["total_lines"] = total

    if total == 0:
        return {"passed": False, "total_lines": 0, "issues": [{"rule": "空ファイル", "line": 0, "detail": "ファイルが空"}], "stats": stats}

    # --- 列パース ---
    parsed = []
    for i, line in enumerate(lines, 1):
        cols = line.split("\t")
        speaker = cols[0].strip() if len(cols) > 0 else ""
        text = cols[1].strip() if len(cols) > 1 else ""
        # SE can be in any column after text (col 2+), search for SE1/SE2
        se = ""
        for c in cols[2:]:
            c = c.strip()
            if c in ("SE1", "SE2"):
                se = c
                break
        parsed.append({"line": i, "speaker": speaker, "text": text, "se": se})

    # --- 1. 行数チェック ---
    if total < 250:
        issues.append({"rule": "行数不足（重大）", "line": 0, "detail": f"総行数{total}行。最低250行を推奨（done.tsv=292行）"})
    elif total < 285:
        issues.append({"rule": "行数やや少ない", "line": 0, "detail": f"総行数{total}行。285行以上を推奨"})

    # --- 1b. 本文文字数チェック ---
    total_chars = sum(len(cols[1].strip()) if len(line.split("\t")) > 1 else 0 for line in lines)
    stats["total_chars"] = total_chars
    if total_chars < 7500:
        issues.append({"rule": "文字数不足（重大）", "line": 0, "detail": f"本文{total_chars}字。8,600〜9,000字を目標"})
    elif total_chars < 8600:
        issues.append({"rule": "文字数やや少ない", "line": 0, "detail": f"本文{total_chars}字。8,600字以上を推奨"})
    elif total_chars > 9500:
        issues.append({"rule": "文字数超過", "line": 0, "detail": f"本文{total_chars}字。9,000字以内を推奨"})

    # --- 1c. イッチ比率チェック ---
    itchi_lines = sum(1 for line in lines if line.split("\t")[0].strip() == "イッチ")
    body_lines = total - 7 - 11  # intro(7) + ending(11) を除く概算
    if body_lines > 0:
        itchi_ratio = itchi_lines / body_lines * 100
        stats["itchi_ratio"] = round(itchi_ratio, 1)
        if itchi_ratio > 15:
            issues.append({"rule": "イッチ比率超過", "line": 0, "detail": f"イッチが{itchi_ratio:.1f}%。10%以下を推奨"})

    # --- 1d. 薄い発言チェック（最大5件報告） ---
    thin_count = 0
    for i, line in enumerate(lines, 1):
        cols = line.split("\t")
        if len(cols) > 1:
            text = cols[1].strip()
            speaker = cols[0].strip()
            if speaker not in ("ナレーション", "タイトル", "") and 0 < len(text) < 10:
                thin_count += 1
                if thin_count <= 5:
                    issues.append({"rule": "薄い発言（警告）", "line": i, "detail": f"「{text}」が{len(text)}文字。10文字以上を推奨"})
    stats["thin_lines"] = thin_count

    # --- 1e. 1行文字数チェック ---
    long_lines = 0
    short_lines = 0
    for i, line in enumerate(lines, 1):
        cols = line.split("\t")
        if len(cols) > 1:
            text = cols[1].strip()
            speaker = cols[0].strip()
            if speaker in ("ナレーション", "タイトル"):
                continue
            text_len = len(text)
            if text_len > 80:
                long_lines += 1
                if long_lines <= 3:
                    issues.append({"rule": "1行長すぎ（警告）", "line": i, "detail": f"{text_len}字。35字基本、たまに70字を推奨"})
            elif 0 < text_len < 20:
                short_lines += 1
                if short_lines <= 3:
                    issues.append({"rule": "1行短すぎ（警告）", "line": i, "detail": f"{text_len}字。35字基本を推奨"})
    stats["long_lines"] = long_lines
    stats["short_lines"] = short_lines

    # --- 1f. 体験談の年齢チェック ---
    age_pattern = re.compile(r"\d{2}歳")
    for p in parsed:
        if p["speaker"] == "ナレーション" and age_pattern.search(p["text"]):
            issues.append({"rule": "体験談に年齢（警告）", "line": p["line"], "detail": "体験談で具体的な年齢は入れない（設定ブレ防止）"})

    # --- 1g. かぎ括弧チェック（最大3件報告） ---
    bracket_count = 0
    for i, line in enumerate(lines, 1):
        cols = line.split("\t")
        if len(cols) > 1 and ("「" in cols[1] or "」" in cols[1]):
            bracket_count += 1
            if bracket_count <= 3:
                issues.append({"rule": "かぎ括弧使用（警告）", "line": i, "detail": "かぎ括弧「」は避ける（自ガル台本ルール）"})
    stats["bracket_lines"] = bracket_count

    # --- 2. 1行目チェック ---
    if parsed[0]["speaker"] != "ナレーション":
        issues.append({"rule": "1行目", "line": 1, "detail": f"1行目が「{parsed[0]['speaker']}」。「ナレーション」であるべき"})

    # --- 3. 2行目チェック ---
    if len(parsed) > 1 and parsed[1]["speaker"] != "タイトル":
        issues.append({"rule": "2行目", "line": 2, "detail": f"2行目が「{parsed[1]['speaker']}」。「タイトル」であるべき"})
    elif len(parsed) > 1:
        title_len = len(parsed[1]["text"])
        if title_len > 20:
            issues.append({"rule": "タイトル長", "line": 2, "detail": f"タイトルが{title_len}文字。10〜15文字程度を推奨"})

    # --- 4. 許可話者チェック ---
    allowed = {"ナレーション", "タイトル", "イッチ", "スレ民1", "スレ民2", "スレ民3", "スレ民4", "スレ民5", "スレ民6"}
    forbidden_old = {"ナレーター", "イチコ"}
    speakers_used = set()
    for p in parsed:
        speakers_used.add(p["speaker"])
        if p["speaker"] and p["speaker"] not in allowed:
            if p["speaker"] in forbidden_old:
                issues.append({"rule": "旧名使用（重大）", "line": p["line"], "detail": f"「{p['speaker']}」は旧名。正しい名前を使用してください"})
            else:
                issues.append({"rule": "不明な話者", "line": p["line"], "detail": f"「{p['speaker']}」は許可されていません"})

    stats["speakers_used"] = sorted(list(speakers_used))

    # スレ民の欠落チェック
    for i in range(1, 7):
        if f"スレ民{i}" not in speakers_used:
            issues.append({"rule": "スレ民欠落", "line": 0, "detail": f"スレ民{i}が一度も登場していません"})

    # --- 5. 連続同一話者チェック ---
    # イントロ（最初のナレーション連続）とエンディング（最後のナレーション連続）は除外
    # イントロ終了位置を特定
    intro_end = 0
    for i, p in enumerate(parsed):
        if p["speaker"] not in ("ナレーション", "タイトル"):
            intro_end = i
            break

    # エンディング開始位置を特定（最後から遡ってナレーション連続の開始位置）
    ending_start = total
    for i in range(len(parsed) - 1, -1, -1):
        if parsed[i]["speaker"] == "ナレーション":
            ending_start = i
        else:
            break

    consecutive_violations = []
    for i in range(intro_end + 1, min(ending_start, len(parsed))):
        if i > 0 and parsed[i]["speaker"] == parsed[i - 1]["speaker"] and parsed[i]["speaker"]:
            consecutive_violations.append(i + 1)  # 1-indexed

    stats["consecutive_violations"] = len(consecutive_violations)
    for line_num in consecutive_violations[:10]:  # 最大10件報告
        speaker = parsed[line_num - 1]["speaker"]
        issues.append({"rule": "連続同一話者（重大）", "line": line_num, "detail": f"「{speaker}」が連続"})

    # --- 6. コロンチェック ---
    colon_lines = []
    for p in parsed:
        if "：" in p["speaker"] or (p["text"] and p["text"].startswith("：")):
            colon_lines.append(p["line"])
    for ln in colon_lines[:5]:
        issues.append({"rule": "コロン使用", "line": ln, "detail": "コロン（：）は不要。タブ区切りのみ"})

    # --- 7. 第N話マーカーチェック ---
    for p in parsed:
        if re.search(r"第\d+話|エピソード\d+", p["text"]):
            issues.append({"rule": "番号マーカー", "line": p["line"], "detail": f"「{p['text'][:30]}」に番号マーカーあり。自然な流れで切り替える"})

    # --- 8. シーン転換チェック ---
    for p in parsed:
        if "シーン転換" in p["text"] or "シーン転換" in p["se"]:
            issues.append({"rule": "シーン転換", "line": p["line"], "detail": "シーン転換行は不要"})

    # --- 9. SE配置チェック ---
    se_lines = []
    for p in parsed:
        if p["se"] in ("SE1", "SE2"):
            se_lines.append({"line": p["line"], "se": p["se"]})

    stats["se_count"] = len(se_lines)

    if len(se_lines) >= 2:
        intervals = []
        for i in range(1, len(se_lines)):
            intervals.append(se_lines[i]["line"] - se_lines[i - 1]["line"])
        stats["avg_se_interval"] = round(sum(intervals) / len(intervals), 1)
        stats["se_intervals"] = intervals

        # 間隔チェック（許容: 8〜12行）
        for i, interval in enumerate(intervals):
            if interval < 6 or interval > 18:
                issues.append({"rule": "SE間隔", "line": se_lines[i + 1]["line"], "detail": f"前のSEから{interval}行間隔。8〜12行間隔を推奨"})

        # 交互チェック
        for i in range(1, len(se_lines)):
            if se_lines[i]["se"] == se_lines[i - 1]["se"]:
                issues.append({"rule": "SE交互", "line": se_lines[i]["line"], "detail": f"{se_lines[i]['se']}が連続。SE1/SE2を交互に配置"})
    elif total > 50 and len(se_lines) < 2:
        issues.append({"rule": "SE不足", "line": 0, "detail": f"SE配置が{len(se_lines)}箇所。10行に1回程度で配置してください"})

    # ナレーション・タイトル行のSEチェック
    for p in parsed:
        if p["speaker"] in ("ナレーション", "タイトル") and p["se"]:
            issues.append({"rule": "ナレーションSE", "line": p["line"], "detail": "ナレーション・タイトル行にSEは不要"})

    # --- 10. ナレーション配置チェック ---
    narration_in_body = []
    for i in range(intro_end, ending_start):
        if parsed[i]["speaker"] == "ナレーション":
            narration_in_body.append(parsed[i]["line"])

    stats["narration_in_body"] = narration_in_body
    for ln in narration_in_body[:5]:
        issues.append({"rule": "本文中ナレーション", "line": ln, "detail": "ナレーションは冒頭とエンディングのみ。本文中には使わない"})

    # --- 結果 ---
    # 重大issueがあればfail
    critical_rules = {"旧名使用（重大）", "連続同一話者（重大）", "1行目", "2行目", "行数不足（重大）"}
    has_critical = any(i["rule"] in critical_rules for i in issues)

    return {
        "passed": len(issues) == 0,
        "has_critical": has_critical,
        "total_lines": total,
        "issue_count": len(issues),
        "issues": issues,
        "stats": stats,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_script.py <tsv_file_path>")
        sys.exit(1)

    result = validate(sys.argv[1])

    # カラー出力
    if result.get("passed"):
        print("✅ ALL CHECKS PASSED")
    elif result.get("has_critical"):
        print("❌ CRITICAL ISSUES FOUND")
    else:
        print("⚠️ MINOR ISSUES FOUND")

    print(f"\nTotal lines: {result.get('total_lines', 0)}")
    print(f"Total chars: {result.get('stats', {}).get('total_chars', '?')}")
    print(f"Itchi ratio: {result.get('stats', {}).get('itchi_ratio', '?')}%")
    print(f"Issues: {result.get('issue_count', 0)}")

    if result.get("stats", {}).get("se_count"):
        print(f"SE count: {result['stats']['se_count']}")
        if "avg_se_interval" in result["stats"]:
            print(f"Avg SE interval: {result['stats']['avg_se_interval']} lines")

    if result.get("issues"):
        print("\n--- Issues ---")
        for i in result["issues"]:
            line_str = f"L{i['line']}" if i["line"] else "---"
            print(f"  [{line_str}] {i['rule']}: {i['detail']}")

    # JSON出力（パイプ処理用）
    print("\n--- JSON ---")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
