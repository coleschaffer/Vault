// GET /api/ads - List all ads
// POST /api/ads - Create new ad

import * as db from '../../lib/database.js';

export async function onRequestGet(context) {
  const ads = await db.getAllAds(context.env.DB);
  return Response.json(ads);
}

export async function onRequestPost(context) {
  const data = await context.request.json();
  const id = await db.createAd(context.env.DB, data);
  return Response.json({ success: true, id });
}
