// POST /api/process-ad - Process ad from X.com URL

import * as db from '../../lib/database.js';
import { processAd, extractTweetId } from '../../lib/adProcessor.js';

export async function onRequestPost(context) {
  const { url: adUrl } = await context.request.json();

  if (!adUrl) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const tweetId = extractTweetId(adUrl);
  if (!tweetId) {
    return Response.json({ error: 'Invalid Twitter/X URL' }, { status: 400 });
  }

  // Check if already exists
  const existing = await db.getAdById(context.env.DB, tweetId);
  if (existing) {
    return Response.json({ error: 'Ad already exists' }, { status: 409 });
  }

  // Process the ad
  const ad = await processAd(context.env, adUrl);

  // Save to database
  await db.createAd(context.env.DB, ad);

  return Response.json({
    success: true,
    id: ad.id,
    title: ad.title,
    creator: ad.creator,
    transcript_length: ad.fullTranscript?.length || 0,
    shots_count: ad.shots?.length || 0
  });
}
