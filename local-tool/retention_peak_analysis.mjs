#!/usr/bin/env node
/**
 * 両ch視聴維持率ピーク分析・自動化スクリプト
 * 毎朝7時Windowsタスクスケジューラで起動
 *
 * 動作:
 * 1. 両ch動画管理シート読込
 * 2. 投稿日+2日経過・R列空欄の動画を対象に
 *    YouTube Analytics APIで秒単位の audienceWatchRatio 取得
 * 3. ピーク時刻トップ3を特定
 * 4. Google Doc（台本）から該当秒数付近のテキスト抽出
 * 5. R列に「{peak_sec}s: {excerpt}」を書込
 * 6. Obsidian DB `視聴維持率ピーク_DB.md` に追記
 * 7. Discord両chへレポート送信
 */
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';
import { existsSync } from 'fs';

// ══════════════════════════════════════════
// 環境読込（両ch分）
// ══════════════════════════════════════════
async function loadEnv(envPath) {
  try {
    const raw = await readFile(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[key]) process.env[key] = v;
    }
  } catch {
    /* optional file */
  }
}

await loadEnv('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local');
await loadEnv('C:/Users/meiek/Desktop/ClaudeCode-projects/youtube-health-app/youtube-health-app/.env');
await loadEnv('C:/Users/meiek/Desktop/ClaudeCode-projects/youtube-health-app/youtube-health-app/.env.local');
await loadEnv('C:/Users/meiek/.claude/channels/discord/.env');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GALCHAN_CHANNEL_DISCORD = '1488435327570939995';
const HEALTH_CHANNEL_DISCORD = '1488770692777513052';

const CHANNELS = [
  {
    key: 'galchan',
    name: 'ガルちゃんねる',
    spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
    sheetName: '自分チャンネル・動画管理表',
    ytChannelId: process.env.YOUTUBE_CHANNEL_ID_GALCHAN,
    obsidianDbPath: 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/ガル分析/視聴維持率ピーク_DB.md',
    discordChatId: GALCHAN_CHANNEL_DISCORD,
  },
  {
    key: 'health',
    name: '健康雑学',
    spreadsheetId: process.env.SPREADSHEET_ID_CHANNEL_A,
    sheetName: '健康雑学',
    ytChannelId: process.env.YOUTUBE_CHANNEL_ID,
    obsidianDbPath: 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/健康雑学/分析結果/視聴維持率ピーク_DB.md',
    discordChatId: HEALTH_CHANNEL_DISCORD,
  },
];

// ══════════════════════════════════════════
// Google 認証
// ══════════════════════════════════════════
function getAuth() {
  const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return c;
}
const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });
const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth });
const youtube = google.youtube({ version: 'v3', auth });
const docs = google.docs({ version: 'v1', auth });

// ══════════════════════════════════════════
// Discord送信（Bot REST API）
// ══════════════════════════════════════════
async function sendDiscord(chatId, text) {
  if (!DISCORD_BOT_TOKEN) {
    console.log(`[Discord skip ${chatId}] ${text.slice(0, 100)}...`);
    return;
  }
  const chunks = [];
  let s = text;
  while (s.length > 1900) {
    chunks.push(s.slice(0, 1900));
    s = s.slice(1900);
  }
  chunks.push(s);
  for (const c of chunks) {
    const resp = await fetch(`https://discord.com/api/v10/channels/${chatId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: c }),
    });
    if (!resp.ok) console.error(`Discord送信失敗 ${chatId}: ${resp.status} ${await resp.text()}`);
  }
}

// ══════════════════════════════════════════
// 対象動画特定（投稿日+2日経過・R列空欄）
// ══════════════════════════════════════════
function parseJpDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

async function findTargetVideos(ch) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ch.spreadsheetId,
    range: `${ch.sheetName}!A:R`,
  });
  const rows = res.data.values || [];
  const header = rows[0] || [];
  const now = Date.now();
  const targets = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[6] || row[2] || ''; // G列=台本タイトル
    const postDateStr = row[4] || ''; // E列=投稿日
    const videoUrl = row[5] || row[7] || ''; // F or H列
    const rCol = row[17] || ''; // R列
    const postDate = parseJpDate(postDateStr);
    if (!postDate) continue;
    if ((now - postDate.getTime()) < 2 * 24 * 3600 * 1000) continue; // 2日未満
    if (rCol && rCol.trim()) continue; // 既に記入済み
    // YouTube Video ID抽出
    const videoIdMatch = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
    if (!videoIdMatch) continue;
    targets.push({
      rowNum: i + 1,
      title,
      postDateStr,
      videoId: videoIdMatch[1],
      videoUrl,
    });
  }
  return targets;
}

// ══════════════════════════════════════════
// YouTube Analytics 維持率取得
// ══════════════════════════════════════════
async function getRetention(videoId, ytChannelId) {
  try {
    const resp = await ytAnalytics.reports.query({
      ids: `channel==${ytChannelId}`,
      startDate: '2020-01-01',
      endDate: '2099-12-31',
      metrics: 'audienceWatchRatio,relativeRetentionPerformance',
      dimensions: 'elapsedVideoTimeRatio',
      filters: `video==${videoId}`,
      maxResults: 101,
    });
    return resp.data;
  } catch (e) {
    console.error(`YouTube Analytics エラー ${videoId}: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════
// 動画の長さ取得
// ══════════════════════════════════════════
async function getVideoDuration(videoId) {
  try {
    const resp = await youtube.videos.list({ part: ['contentDetails'], id: [videoId] });
    const iso = resp.data.items?.[0]?.contentDetails?.duration || '';
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
  } catch {
    return 0;
  }
}

// ══════════════════════════════════════════
// Google Doc 台本の該当秒テキスト抽出
// ══════════════════════════════════════════
async function getDocTextAtSecond(docUrl, peakSec, totalSec) {
  if (!docUrl || !totalSec) return '';
  const docIdMatch = docUrl.match(/document\/d\/([A-Za-z0-9_-]+)/);
  if (!docIdMatch) return '';
  try {
    const doc = await docs.documents.get({ documentId: docIdMatch[1] });
    const full = (doc.data.body?.content || [])
      .flatMap(c => c.paragraph?.elements || [])
      .map(e => e.textRun?.content || '')
      .join('');
    if (!full) return '';
    const ratio = peakSec / totalSec;
    const centerIdx = Math.floor(full.length * ratio);
    const start = Math.max(0, centerIdx - 80);
    const end = Math.min(full.length, centerIdx + 80);
    return full.slice(start, end).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

// ══════════════════════════════════════════
// ピーク秒特定（トップ3）
// ══════════════════════════════════════════
function findPeaks(analyticsData) {
  if (!analyticsData?.rows) return [];
  // dimensions: elapsedVideoTimeRatio (0.0-1.0, 101 points)
  // metrics: audienceWatchRatio, relativeRetentionPerformance
  return analyticsData.rows
    .map(r => ({ ratio: r[0], watch: r[1], relative: r[2] }))
    .filter(r => r.ratio > 0.05) // 最初の5%は除外（冒頭の通常高水準）
    .sort((a, b) => b.watch - a.watch)
    .slice(0, 3);
}

// ══════════════════════════════════════════
// メイン処理
// ══════════════════════════════════════════
async function processChannel(ch) {
  const report = [];
  report.push(`\n═══ ${ch.name} ═══`);
  try {
    const targets = await findTargetVideos(ch);
    if (targets.length === 0) {
      report.push('対象動画なし（投稿+2日経過・R列空欄なし）');
      return report.join('\n');
    }
    report.push(`対象${targets.length}本`);
    for (const t of targets) {
      const analytics = await getRetention(t.videoId, ch.ytChannelId);
      if (!analytics) {
        report.push(`❌ ${t.title}: Analytics取得失敗`);
        continue;
      }
      const duration = await getVideoDuration(t.videoId);
      const peaks = findPeaks(analytics);
      if (peaks.length === 0) {
        report.push(`❌ ${t.title}: ピーク検出失敗`);
        continue;
      }
      const docUrl = ''; // TODO: シートから G列Doc URL読み込み
      const peakLines = [];
      for (const p of peaks) {
        const sec = Math.floor(p.ratio * duration);
        const mm = Math.floor(sec / 60);
        const ss = sec % 60;
        const excerpt = await getDocTextAtSecond(docUrl, sec, duration);
        peakLines.push(`${mm}:${String(ss).padStart(2, '0')} (維持率${(p.watch * 100).toFixed(1)}%): ${excerpt || '(台本抽出なし)'}`);
      }
      // R列書込
      const rValue = peakLines.join('\n');
      await sheets.spreadsheets.values.update({
        spreadsheetId: ch.spreadsheetId,
        range: `${ch.sheetName}!R${t.rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[rValue]] },
      });
      // Obsidian DB追記
      const dbEntry = `\n## ${new Date().toISOString().slice(0, 10)} ${t.title}\n- 投稿日: ${t.postDateStr}\n- 動画URL: ${t.videoUrl}\n${peakLines.map(l => `- ${l}`).join('\n')}\n`;
      try {
        const dbDir = path.dirname(ch.obsidianDbPath);
        if (!existsSync(dbDir)) await mkdir(dbDir, { recursive: true });
        if (!existsSync(ch.obsidianDbPath)) {
          await writeFile(ch.obsidianDbPath, `# 視聴維持率ピーク DB（${ch.name}）\n\n`, 'utf8');
        }
        await appendFile(ch.obsidianDbPath, dbEntry, 'utf8');
      } catch (e) {
        console.error(`Obsidian書込失敗: ${e.message}`);
      }
      report.push(`✅ ${t.title} row${t.rowNum}\n${peakLines.map(l => `  ${l}`).join('\n')}`);
    }
  } catch (e) {
    report.push(`❌ チャンネル処理エラー: ${e.message}`);
  }
  return report.join('\n');
}

// ══════════════════════════════════════════
// 実行
// ══════════════════════════════════════════
const header = `🌅 視聴維持率ピーク分析レポート (${new Date().toLocaleString('ja-JP')})`;
const reports = [];
for (const ch of CHANNELS) {
  try {
    const r = await processChannel(ch);
    reports.push(r);
    await sendDiscord(ch.discordChatId, `${header}\n${r}`);
  } catch (e) {
    const err = `❌ ${ch.name}: ${e.message}`;
    reports.push(err);
    await sendDiscord(ch.discordChatId, `${header}\n${err}`);
  }
}
console.log(`${header}\n${reports.join('\n')}`);
