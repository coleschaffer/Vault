// GET /api/images - List all images

import * as db from '../../lib/database.js';

export async function onRequestGet(context) {
  const images = await db.getAllImages(context.env.DB);
  return Response.json(images);
}
