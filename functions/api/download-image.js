// POST /api/download-image - Download and store image to R2

import * as storage from '../../lib/storage.js';

export async function onRequestPost(context) {
  const { url: imageUrl, filename } = await context.request.json();

  if (!imageUrl) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const key = `images/vault/${filename || `image-${Date.now()}.jpg`}`;
  const result = await storage.downloadAndStoreToR2(context.env.STORAGE, imageUrl, key);

  return Response.json({
    success: true,
    path: `/storage/${key}`,
    size: result.size
  });
}
