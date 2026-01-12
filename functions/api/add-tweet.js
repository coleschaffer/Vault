// POST /api/add-tweet - Add a single tweet

import * as db from '../../lib/database.js';
import { extractTweetId } from '../../lib/adProcessor.js';

export async function onRequestPost(context) {
  const data = await context.request.json();
  const tweetId = extractTweetId(data.url);

  if (!tweetId) {
    return Response.json({ error: 'Invalid Twitter/X URL' }, { status: 400 });
  }

  const tweet = {
    id: `tweet-${tweetId}`,
    url: data.url,
    tags: data.tags || [],
    addedAt: new Date().toISOString().split('T')[0]
  };

  await db.createTweet(context.env.DB, tweet);
  return Response.json({ success: true, id: tweet.id });
}
