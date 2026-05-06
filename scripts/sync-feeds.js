#!/usr/bin/env node
/**
 * YouTube + Naver Blog RSS 동기화 스크립트
 *
 *   - YouTube 채널 RSS  → data/youtube.json (shorts/longs 분리)
 *   - 네이버 블로그 RSS → data/blog.json
 *
 * 의존성 0 (Node 18+ 내장 fetch). GitHub Actions와 로컬 모두 동일하게 동작.
 *
 *   사용:  node scripts/sync-feeds.js
 *   환경변수(선택):
 *     YT_CHANNEL_ID  (default: UCYfIeiTRMKlDdXs7fEb8EGw — 검단 김진규tv)
 *     NAVER_BLOG_ID  (default: inaive2003)
 */

const fs = require('node:fs');
const path = require('node:path');

const YT_CHANNEL_ID = process.env.YT_CHANNEL_ID || 'UCYfIeiTRMKlDdXs7fEb8EGw';
const NAVER_BLOG_ID = process.env.NAVER_BLOG_ID || 'inaive2003';

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const UA = 'Mozilla/5.0 (gumdan-kimjingyu sync-feeds bot)';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return await res.text();
}

/**
 * 매우 가벼운 정규식 기반 XML 파서. RSS/Atom 정도엔 충분.
 */
function pickAll(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
function pickOne(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = re.exec(xml);
  return m ? m[1] : '';
}
function pickAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`, 'i');
  const m = re.exec(xml);
  return m ? m[1] : '';
}
function decodeCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function clean(s) {
  return decodeEntities(decodeCdata(s)).trim();
}

// ─────────────────────────────── YouTube ───────────────────────────────

async function syncYouTube() {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
  const xml = await fetchText(url);

  const entries = pickAll(xml, 'entry').map((e) => {
    const id = clean(pickOne(e, 'yt:videoId'));
    const title = clean(pickOne(e, 'title'));
    const link = pickAttr(e, 'link', 'href') || `https://www.youtube.com/watch?v=${id}`;
    const published = clean(pickOne(e, 'published'));
    // 쇼츠는 link href가 /shorts/<id> 로 옴. RSS가 일관되지 않을 때 대비해 length 미상이므로 link만으로 구분.
    const isShort = /\/shorts\//.test(link);
    return {
      id,
      title,
      link,
      published,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      thumbHi: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      type: isShort ? 'short' : 'long',
    };
  });

  const shorts = entries.filter((e) => e.type === 'short').slice(0, 12);
  const longs = entries.filter((e) => e.type === 'long').slice(0, 8);

  const data = {
    updated: new Date().toISOString(),
    channelId: YT_CHANNEL_ID,
    shorts,
    longs,
  };

  ensureDir(DATA_DIR);
  fs.writeFileSync(path.join(DATA_DIR, 'youtube.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[youtube] shorts=${shorts.length} longs=${longs.length}`);
}

// ─────────────────────────────── Naver Blog ───────────────────────────────

function extractFirstImage(html) {
  // description 안의 <img src="..."> 첫 번째
  const m = /<img[^>]*\bsrc="([^"]+)"/i.exec(html || '');
  if (!m) return '';
  let src = m[1];
  // 네이버 썸네일은 type=s3 → 더 큰 사이즈로
  src = src.replace(/\?type=s\d+$/, '?type=w773');
  return src;
}

async function syncBlog() {
  const url = `https://rss.blog.naver.com/${NAVER_BLOG_ID}.xml`;
  const xml = await fetchText(url);

  const items = pickAll(xml, 'item').map((it) => {
    const title = clean(pickOne(it, 'title'));
    const link = clean(pickOne(it, 'link')).replace(/\?fromRss=true.*$/, '');
    const pubDate = clean(pickOne(it, 'pubDate'));
    const description = clean(pickOne(it, 'description'));
    const tag = clean(pickOne(it, 'tag'));
    const thumb = extractFirstImage(description);
    return { title, link, pubDate, thumb, tag };
  });

  const posts = items.filter((p) => p.thumb).slice(0, 12); // 썸네일 있는 것만 (없는 글은 그리드에 안 어울림)

  const data = {
    updated: new Date().toISOString(),
    blogId: NAVER_BLOG_ID,
    posts,
  };

  ensureDir(DATA_DIR);
  fs.writeFileSync(path.join(DATA_DIR, 'blog.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[blog] posts=${posts.length}`);
}

// ─────────────────────────────── main ───────────────────────────────

(async () => {
  try {
    await syncYouTube();
  } catch (err) {
    console.error('[youtube] FAILED:', err.message);
    process.exitCode = 1;
  }
  try {
    await syncBlog();
  } catch (err) {
    console.error('[blog] FAILED:', err.message);
    process.exitCode = 1;
  }
})();
