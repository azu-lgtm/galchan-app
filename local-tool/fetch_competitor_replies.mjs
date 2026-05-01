#!/usr/bin/env node
/**
 * 競合23chのコメ返信状況リサーチ
 * 各chの最新動画3本のコメントスレッドを取得し、
 * authorChannelId が channelId と一致する返信（=運営者返信）を抽出する
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

// .env.local 読込
let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1);
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || !line.includes('=') || line.startsWith('#')) continue;
  const eqIdx = line.indexOf('=');
  const k = line.slice(0, eqIdx).trim();
  let v = line.slice(eqIdx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v;
}
const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) { console.error('YOUTUBE_API_KEY not found'); process.exit(1); }

// 23ch リスト（手動抽出済）
const competitors = [
  { name: 'ガルちゃん芸能新聞', url: 'https://youtube.com/@geinoushimbun', handle: '@geinoushimbun', channelId: null },
  { name: 'ガル姫の商品紹介【有益ガルちゃんまとめ】', url: 'https://youtube.com/channel/UC-Qz5zpSt-Qm-B7j2LCUApg', handle: null, channelId: 'UC-Qz5zpSt-Qm-B7j2LCUApg' },
  { name: 'ガルの有益ライフ【ガルちゃんまとめ】', url: 'https://m.youtube.com/@GirlsCH_BeautyLife', handle: '@GirlsCH_BeautyLife', channelId: null },
  { name: 'ガルちゃん民へ届け‼有益スレ', url: 'https://m.youtube.com/@garuchanmin', handle: '@garuchanmin', channelId: null },
  { name: 'がるラッコちゃん', url: 'https://m.youtube.com/@garurakkochan', handle: '@garurakkochan', channelId: null },
  { name: 'ガルカピ商品紹介', url: 'https://m.youtube.com/@garucapi-chan', handle: '@garucapi-chan', channelId: null },
  { name: 'どぐうちゃんの商品情報', url: 'https://youtube.com/@garudoguu', handle: '@garudoguu', channelId: null },
  { name: 'ガルちゃん芸能スレ', url: 'https://www.youtube.com/@garuchan.geinou', handle: '@garuchan.geinou', channelId: null },
  { name: 'ガルペンちゃん', url: 'https://www.youtube.com/@girls_penguin', handle: '@girls_penguin', channelId: null },
  { name: '有益ガルねこにゃん', url: 'https://www.youtube.com/@garuneko-nyan', handle: '@garuneko-nyan', channelId: null },
  { name: 'ガルにゃん速報', url: 'https://www.youtube.com/@GALnyan', handle: '@GALnyan', channelId: null },
  { name: 'ガルちゃん倶楽部', url: 'https://www.youtube.com/@ガルちゃん倶楽部', handle: '@ガルちゃん倶楽部', channelId: null },
  { name: 'がるザラシちゃんねる', url: 'https://youtube.com/@girls-zarashi-ch', handle: '@girls-zarashi-ch', channelId: null },
  { name: 'がる猫ちゃん', url: 'https://youtube.com/@garunekochan', handle: '@garunekochan', channelId: null },
  { name: '有益天使ガルちゃんまとめ', url: 'https://youtube.com/@yuueki-angel', handle: '@yuueki-angel', channelId: null },
  { name: 'ガールズちゃんねるまとめ集', url: 'https://youtube.com/channel/UC444fh0uIiwUqzutiB70YNg', handle: null, channelId: 'UC444fh0uIiwUqzutiB70YNg' },
  { name: '有益ガールズライフ', url: 'https://youtube.com/@lgirls-life-yueki', handle: '@lgirls-life-yueki', channelId: null },
  { name: '楽しいとこ取りガルちゃんねる', url: 'https://m.youtube.com/@Tanoshiitokodori-GirlsChannel', handle: '@Tanoshiitokodori-GirlsChannel', channelId: null },
  { name: '【美容・健康】はなまるがるちゃんねる', url: 'https://m.youtube.com/@hanamarugaru', handle: '@hanamarugaru', channelId: null },
  { name: 'ガルちゃんアイランド', url: 'https://m.youtube.com/@girlsch_island', handle: '@girlsch_island', channelId: null },
  { name: '開運ガルねこちゃん', url: 'https://m.youtube.com/@garuneko-chan', handle: '@garuneko-chan', channelId: null },
  { name: 'ガルこめちゃん', url: 'https://youtube.com/@garucome', handle: '@garucome', channelId: null },
  { name: 'ガルにゃん速報(別)', url: 'https://youtube.com/@galnyan', handle: '@galnyan', channelId: null },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function resolveChannelId(c) {
  if (c.channelId) return c.channelId;
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=${encodeURIComponent(c.handle)}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error || !data.items?.[0]) {
    return { error: data.error?.message || 'channel not found' };
  }
  return {
    channelId: data.items[0].id,
    title: data.items[0].snippet.title,
    subs: data.items[0].statistics.subscriberCount,
    videoCount: data.items[0].statistics.videoCount,
  };
}

async function fetchLatestVideos(channelId, count = 3) {
  const plUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
  const plRes = await fetch(plUrl);
  const plData = await plRes.json();
  const uploads = plData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];
  const itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}&maxResults=${count}&key=${API_KEY}`;
  const itemsRes = await fetch(itemsUrl);
  const itemsData = await itemsRes.json();
  if (itemsData.error) return [];
  return (itemsData.items || []).map(it => ({
    id: it.snippet.resourceId.videoId,
    title: it.snippet.title,
    publishedAt: it.snippet.publishedAt,
  }));
}

async function fetchCommentThreads(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=50&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    return { error: data.error.message, items: [] };
  }
  return { items: data.items || [] };
}

function extractOwnerReplies(threads, ownerChannelId) {
  const replies = [];
  for (const t of threads) {
    const topAuthor = t.snippet?.topLevelComment?.snippet?.authorChannelId?.value;
    const topText = t.snippet?.topLevelComment?.snippet?.textOriginal || t.snippet?.topLevelComment?.snippet?.textDisplay || '';
    if (t.replies?.comments) {
      for (const r of t.replies.comments) {
        const aId = r.snippet?.authorChannelId?.value;
        if (aId === ownerChannelId) {
          replies.push({
            replyText: r.snippet?.textOriginal || r.snippet?.textDisplay || '',
            replyToText: topText,
            replyToAuthor: t.snippet?.topLevelComment?.snippet?.authorDisplayName || '',
            publishedAt: r.snippet?.publishedAt || '',
            likeCount: r.snippet?.likeCount || 0,
          });
        }
      }
    }
    // 親コメント自体が運営者(=自演)の場合も拾っておく(参考)
    if (topAuthor === ownerChannelId) {
      replies.push({
        replyText: topText,
        replyToText: '(top-level comment by owner)',
        replyToAuthor: '(self)',
        publishedAt: t.snippet?.topLevelComment?.snippet?.publishedAt || '',
        likeCount: t.snippet?.topLevelComment?.snippet?.likeCount || 0,
        topLevel: true,
      });
    }
  }
  return replies;
}

const results = [];
for (const c of competitors) {
  console.log(`\n--- ${c.name} (${c.url}) ---`);
  const cidInfo = await resolveChannelId(c);
  if (cidInfo.error) {
    console.log(`  ERROR: ${cidInfo.error}`);
    results.push({ ...c, error: cidInfo.error });
    await sleep(200);
    continue;
  }
  const channelId = typeof cidInfo === 'string' ? cidInfo : cidInfo.channelId;
  const ownerInfo = typeof cidInfo === 'object' ? cidInfo : {};
  console.log(`  channelId: ${channelId}`);

  const videos = await fetchLatestVideos(channelId, 3);
  console.log(`  videos: ${videos.length}`);
  await sleep(200);

  const videoResults = [];
  for (const v of videos) {
    const ct = await fetchCommentThreads(v.id);
    if (ct.error) {
      console.log(`    [${v.id}] comments error: ${ct.error}`);
      videoResults.push({ ...v, error: ct.error, threads: 0, ownerReplies: [] });
      await sleep(200);
      continue;
    }
    const ownerReplies = extractOwnerReplies(ct.items, channelId);
    console.log(`    [${v.id}] threads=${ct.items.length} ownerReplies=${ownerReplies.length}`);
    videoResults.push({
      ...v,
      threads: ct.items.length,
      ownerReplies,
    });
    await sleep(250);
  }

  const totalReplies = videoResults.reduce((s, v) => s + (v.ownerReplies?.length || 0), 0);
  const allDisabled = videoResults.length > 0 && videoResults.every(v => v.error);

  results.push({
    ...c,
    channelId,
    title: ownerInfo.title,
    subs: ownerInfo.subs,
    videoCount: ownerInfo.videoCount,
    videos: videoResults,
    totalOwnerReplies: totalReplies,
    commentsDisabled: allDisabled,
  });
  await sleep(300);
}

// MD出力組み立て
const today = '2026-05-01';
const lines = [];
lines.push(`# 競合23ch コメント返信状況リサーチ (${today})`);
lines.push('');
lines.push('## 概要');
lines.push(`- 対象: ガルちゃん系競合23ch`);
lines.push(`- 各chの最新動画3本のコメントスレッドを取得し、運営者(=channelId一致)による返信を抽出`);
lines.push(`- API: YouTube Data API v3 (commentThreads.list, part=snippet,replies, maxResults=50)`);
lines.push('');

let withReply = 0, noReply = 0, errored = 0;
for (const r of results) {
  if (r.error) errored++;
  else if (r.totalOwnerReplies > 0) withReply++;
  else noReply++;
}
lines.push('## サマリ');
lines.push(`- 返信ありch: **${withReply}** / 23`);
lines.push(`- 返信なしch: **${noReply}** / 23`);
lines.push(`- 取得エラー: **${errored}** / 23`);
lines.push('');

lines.push('## ch別結果');
lines.push('');
for (const r of results) {
  lines.push(`### ${r.name}`);
  lines.push(`- URL: ${r.url}`);
  if (r.error) {
    lines.push(`- ❌ 取得エラー: ${r.error}`);
    lines.push('');
    continue;
  }
  lines.push(`- channelId: \`${r.channelId}\``);
  if (r.title) lines.push(`- 実チャンネル名: ${r.title}`);
  if (r.subs) lines.push(`- 登録者: ${Number(r.subs).toLocaleString()}`);
  if (r.videoCount) lines.push(`- 動画数: ${r.videoCount}`);
  lines.push(`- 最新動画3本: ${r.videos.length}本取得`);
  lines.push(`- 運営者返信総数: **${r.totalOwnerReplies}**件`);
  if (r.totalOwnerReplies === 0) {
    lines.push(`- 判定: ❌ **返信なし**`);
  } else {
    lines.push(`- 判定: ✅ **返信あり**`);
  }
  lines.push('');
  for (const v of r.videos) {
    lines.push(`#### 動画: ${v.title}`);
    lines.push(`- videoId: \`${v.id}\` / ${v.publishedAt}`);
    if (v.error) {
      lines.push(`- ❌ コメント取得エラー: ${v.error}`);
      lines.push('');
      continue;
    }
    lines.push(`- スレッド数: ${v.threads} / 運営者返信: ${v.ownerReplies.length}`);
    if (v.ownerReplies.length > 0) {
      lines.push('- 運営者返信サンプル:');
      const sample = v.ownerReplies.slice(0, 5);
      for (const rep of sample) {
        lines.push(`  - **返信先コメ**(${rep.replyToAuthor}): ${rep.replyToText.slice(0, 200).replace(/\n/g, ' ')}`);
        lines.push(`    - **運営者返信**: ${rep.replyText.slice(0, 500).replace(/\n/g, ' ')}`);
        lines.push(`    - (👍${rep.likeCount} / ${rep.publishedAt})`);
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
}

const outPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/分析結果/2026-05-01 競合23ch_コメ返信状況リサーチ.md';
const jsonPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/competitor_replies_raw.json';
await writeFile(outPath, lines.join('\n'), 'utf8');
await writeFile(jsonPath, JSON.stringify(results, null, 2), 'utf8');
console.log('\n=== Done ===');
console.log(`MD: ${outPath}`);
console.log(`JSON: ${jsonPath}`);
console.log(`返信あり: ${withReply} / 返信なし: ${noReply} / エラー: ${errored}`);
