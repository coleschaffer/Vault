// POST /api/delete-image - Delete an image

import * as db from '../../lib/database.js';
import * as storage from '../../lib/storage.js';

export async function onRequestPost(context) {
  const { id, deleteFile = true } = await context.request.json();

  if (!id) {
    return Response.json({ error: 'Image ID is required' }, { status: 400 });
  }

  // Get image to find path before deleting
  const images = await db.getAllImages(context.env.DB);
  const image = images.find(i => i.id === id);

  if (!image) {
    return Response.json({ error: 'Image not found' }, { status: 404 });
  }

  // Delete from database
  const deleted = await db.deleteImage(context.env.DB, id);
  if (!deleted) {
    return Response.json({ error: 'Failed to delete image' }, { status: 500 });
  }

  // Delete from R2 if requested
  if (deleteFile && image.imageSrc) {
    const key = image.imageSrc.replace('/storage/', '');
    try {
      await storage.deleteFromR2(context.env.STORAGE, key);
    } catch (e) {
      console.error('Failed to delete image file:', e);
    }
  }

  return Response.json({ success: true, message: 'Image deleted' });
}
