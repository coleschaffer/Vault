// GET /api/ads/:id - Get single ad by ID

import * as db from '../../../lib/database.js';

export async function onRequestGet(context) {
  const { id } = context.params;
  const ad = await db.getAdById(context.env.DB, id);

  if (!ad) {
    return Response.json({ error: 'Ad not found' }, { status: 404 });
  }

  return Response.json(ad);
}
