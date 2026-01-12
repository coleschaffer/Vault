// POST /api/delete-tweet - Delete a tweet

import * as db from '../../lib/database.js';

export async function onRequestPost(context) {
  const { id } = await context.request.json();

  if (!id) {
    return Response.json({ error: 'Tweet ID is required' }, { status: 400 });
  }

  const deleted = await db.deleteTweet(context.env.DB, id);
  if (!deleted) {
    return Response.json({ error: 'Tweet not found' }, { status: 404 });
  }

  return Response.json({ success: true, message: 'Tweet deleted' });
}
