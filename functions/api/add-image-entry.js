// POST /api/add-image-entry - Add image entry

import * as db from '../../lib/database.js';

export async function onRequestPost(context) {
  const data = await context.request.json();
  const id = await db.createImage(context.env.DB, data);
  return Response.json({ success: true, id });
}
