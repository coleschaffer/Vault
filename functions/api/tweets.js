// GET /api/tweets - List all tweets

import * as db from '../../lib/database.js';

export async function onRequestGet(context) {
  const tweets = await db.getAllTweets(context.env.DB);
  return Response.json(tweets);
}
