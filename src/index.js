// Ad Vault Worker - Single entry point for API + Static files
import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import * as db from '../lib/database.js';
import * as storage from '../lib/storage.js';
import { extractTweetId, processAd } from '../lib/adProcessor.js';

const assetManifest = JSON.parse(manifestJSON);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper to create JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// API Router
async function handleAPI(request, env, path) {
  const method = request.method;
  const url = new URL(request.url);

  try {
    // Health check
    if (path === '/api/health') {
      return json({ status: 'ok', version: '2.0-worker' });
    }

    // GET /api/ads
    if (path === '/api/ads' && method === 'GET') {
      const ads = await db.getAllAds(env.DB);
      return json(ads);
    }

    // POST /api/ads
    if (path === '/api/ads' && method === 'POST') {
      const data = await request.json();
      const id = await db.createAd(env.DB, data);
      return json({ success: true, id });
    }

    // GET /api/ads/:id
    if (path.match(/^\/api\/ads\/[^/]+$/) && method === 'GET') {
      const id = path.split('/').pop();
      const ad = await db.getAdById(env.DB, id);
      if (!ad) return json({ error: 'Ad not found' }, 404);
      return json(ad);
    }

    // PUT /api/ads/:id
    if (path.match(/^\/api\/ads\/[^/]+$/) && method === 'PUT') {
      const id = path.split('/').pop();
      const data = await request.json();
      await db.updateAd(env.DB, id, data);
      return json({ success: true });
    }

    // POST /api/delete-ad
    if (path === '/api/delete-ad' && method === 'POST') {
      const { id } = await request.json();
      if (!id) return json({ error: 'ID is required' }, 400);
      await db.deleteAd(env.DB, id);
      return json({ success: true });
    }

    // POST /api/process-ad
    if (path === '/api/process-ad' && method === 'POST') {
      const { url } = await request.json();
      if (!url) return json({ error: 'URL is required' }, 400);
      const result = await processAd(env, url);
      return json(result);
    }

    // GET /api/images
    if (path === '/api/images' && method === 'GET') {
      const images = await db.getAllImages(env.DB);
      return json(images);
    }

    // POST /api/images
    if (path === '/api/images' && method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      const tagsRaw = formData.get('tags');
      const source = formData.get('source') || '';

      if (!file) return json({ error: 'File is required' }, 400);

      const tags = tagsRaw ? JSON.parse(tagsRaw) : [];
      const id = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'jpg';
      const key = `images/${id}.${ext}`;

      await storage.uploadToR2(env.STORAGE, key, await file.arrayBuffer(), file.type);
      await db.createImage(env.DB, { id, url: `/storage/${key}`, tags, source });

      return json({ success: true, id, url: `/storage/${key}` });
    }

    // POST /api/add-image-entry
    if (path === '/api/add-image-entry' && method === 'POST') {
      const { url, tags, source } = await request.json();
      if (!url) return json({ error: 'URL is required' }, 400);
      const id = crypto.randomUUID();
      await db.createImage(env.DB, { id, url, tags: tags || [], source: source || '' });
      return json({ success: true, id });
    }

    // POST /api/delete-image
    if (path === '/api/delete-image' && method === 'POST') {
      const { id } = await request.json();
      if (!id) return json({ error: 'ID is required' }, 400);
      const image = await db.getImageById(env.DB, id);
      if (image?.url?.startsWith('/storage/')) {
        const key = image.url.replace('/storage/', '');
        await storage.deleteFromR2(env.STORAGE, key);
      }
      await db.deleteImage(env.DB, id);
      return json({ success: true });
    }

    // POST /api/download-image
    if (path === '/api/download-image' && method === 'POST') {
      const { url, tags, source } = await request.json();
      if (!url) return json({ error: 'URL is required' }, 400);

      const response = await fetch(url);
      if (!response.ok) return json({ error: 'Failed to download image' }, 500);

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('webp') ? 'webp' : 'jpg';
      const id = crypto.randomUUID();
      const key = `images/${id}.${ext}`;

      await storage.uploadToR2(env.STORAGE, key, await response.arrayBuffer(), contentType);
      await db.createImage(env.DB, { id, url: `/storage/${key}`, tags: tags || [], source: source || url });

      return json({ success: true, id, url: `/storage/${key}` });
    }

    // GET /api/tweets
    if (path === '/api/tweets' && method === 'GET') {
      const tweets = await db.getAllTweets(env.DB);
      return json(tweets);
    }

    // POST /api/add-tweet
    if (path === '/api/add-tweet' && method === 'POST') {
      const data = await request.json();
      if (!data.url) return json({ error: 'URL is required' }, 400);
      const id = crypto.randomUUID();
      await db.createTweet(env.DB, { id, ...data });
      return json({ success: true, id });
    }

    // POST /api/add-tweets-batch
    if (path === '/api/add-tweets-batch' && method === 'POST') {
      const { tweets } = await request.json();
      if (!Array.isArray(tweets)) return json({ error: 'tweets array is required' }, 400);
      const results = [];
      for (const tweet of tweets) {
        const id = crypto.randomUUID();
        await db.createTweet(env.DB, { id, ...tweet });
        results.push({ id, url: tweet.url });
      }
      return json({ success: true, added: results.length, results });
    }

    // POST /api/delete-tweet
    if (path === '/api/delete-tweet' && method === 'POST') {
      const { id } = await request.json();
      if (!id) return json({ error: 'ID is required' }, 400);
      await db.deleteTweet(env.DB, id);
      return json({ success: true });
    }

    // POST /api/fetch-tweet
    if (path === '/api/fetch-tweet' && method === 'POST') {
      const { url: tweetUrl } = await request.json();
      if (!tweetUrl) return json({ error: 'URL is required' }, 400);

      const tweetId = extractTweetId(tweetUrl);
      const username = tweetUrl.match(/(?:twitter|x)\.com\/([^\/]+)\/status/)?.[1];
      if (!tweetId || !username) return json({ error: 'Invalid Twitter/X URL' }, 400);

      const fxUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;
      const response = await fetch(fxUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) return json({ error: 'Failed to fetch tweet data' }, 500);

      const data = await response.json();
      if (data.code !== 200) return json({ error: data.message || 'Tweet not found' }, 404);

      const tweet = data.tweet;
      const images = [];
      if (tweet.media?.photos) {
        for (const photo of tweet.media.photos) {
          if (photo.url) images.push(photo.url);
        }
      }

      return json({
        id: tweetId,
        text: tweet.text,
        images,
        author: tweet.author?.screen_name,
        authorName: tweet.author?.name
      });
    }

    // Storage: GET /storage/*
    if (path.startsWith('/storage/') && method === 'GET') {
      const key = path.replace('/storage/', '');
      if (!key) return json({ error: 'File path is required' }, 400);

      const file = await storage.getFromR2(env.STORAGE, key);
      if (!file) return json({ error: 'File not found' }, 404);

      return new Response(file.data, {
        headers: {
          'Content-Type': file.contentType,
          'Cache-Control': 'public, max-age=31536000',
          ...corsHeaders
        }
      });
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('API Error:', error);
    return json({ error: error.message || 'Internal server error' }, 500);
  }
}

// Main Worker handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API routes
    if (path.startsWith('/api/') || path.startsWith('/storage/')) {
      return handleAPI(request, env, path);
    }

    // Serve static files from KV (Workers Sites)
    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      // If not found, serve index.html for SPA routing
      if (e instanceof NotFoundError) {
        try {
          const notFoundRequest = new Request(new URL('/index.html', url.origin), request);
          return await getAssetFromKV(
            { request: notFoundRequest, waitUntil: ctx.waitUntil.bind(ctx) },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: assetManifest,
            }
          );
        } catch {
          return new Response('Not Found', { status: 404 });
        }
      }
      return new Response('Internal Error', { status: 500 });
    }
  }
};
