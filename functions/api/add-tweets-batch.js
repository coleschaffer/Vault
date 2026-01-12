// POST /api/add-tweets-batch - Add multiple tweets

import * as db from '../../lib/database.js';
import { extractTweetId } from '../../lib/adProcessor.js';

export async function onRequestPost(context) {
  const { urls, tags } = await context.request.json();

  if (!urls?.length) {
    return Response.json({ error: 'URLs array is required' }, { status: 400 });
  }
  if (!tags?.length) {
    return Response.json({ error: 'At least one tag is required' }, { status: 400 });
  }

  const results = [];
  const today = new Date().toISOString().split('T')[0];

  for (const url of urls) {
    const tweetId = extractTweetId(url);
    if (!tweetId) {
      results.push({ url, success: false, error: 'Invalid URL' });
      continue;
    }

    const tweet = {
      id: `tweet-${tweetId}`,
      url,
      tags,
      addedAt: today
    };

    try {
      await db.createTweet(context.env.DB, tweet);
      results.push({ url, success: true, id: tweet.id });
    } catch (e) {
      results.push({ url, success: false, error: e.message });
    }
  }

  return Response.json({
    success: true,
    results,
    added: results.filter(r => r.success).length,
    total: urls.length
  });
}
