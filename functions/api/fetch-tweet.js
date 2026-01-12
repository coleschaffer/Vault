// POST /api/fetch-tweet - Fetch tweet data from Twitter/X

import { extractTweetId } from '../../lib/adProcessor.js';

export async function onRequestPost(context) {
  const { url: tweetUrl } = await context.request.json();

  if (!tweetUrl) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const tweetId = extractTweetId(tweetUrl);
  const username = tweetUrl.match(/(?:twitter|x)\.com\/([^\/]+)\/status/)?.[1];

  if (!tweetId || !username) {
    return Response.json({ error: 'Invalid Twitter/X URL' }, { status: 400 });
  }

  // Fetch from FXTwitter
  const fxUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;
  const response = await fetch(fxUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (!response.ok) {
    return Response.json({ error: 'Failed to fetch tweet data' }, { status: 500 });
  }

  const data = await response.json();
  if (data.code !== 200) {
    return Response.json({ error: data.message || 'Tweet not found' }, { status: 404 });
  }

  const tweet = data.tweet;

  // Extract images
  const images = [];
  if (tweet.media?.photos) {
    for (const photo of tweet.media.photos) {
      if (photo.url) images.push(photo.url);
    }
  }

  return Response.json({
    id: tweetId,
    text: tweet.text,
    images,
    author: tweet.author?.screen_name,
    authorName: tweet.author?.name
  });
}
