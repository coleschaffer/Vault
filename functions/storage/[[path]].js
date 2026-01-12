// GET /storage/* - Serve files from R2 storage

import * as storage from '../../lib/storage.js';

export async function onRequestGet(context) {
  const path = context.params.path;
  const key = Array.isArray(path) ? path.join('/') : path;

  if (!key) {
    return Response.json({ error: 'File path is required' }, { status: 400 });
  }

  const file = await storage.getFromR2(context.env.STORAGE, key);

  if (!file) {
    return Response.json({ error: 'File not found' }, { status: 404 });
  }

  return new Response(file.data, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=31536000',
    }
  });
}
