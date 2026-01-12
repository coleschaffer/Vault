// POST /api/delete-ad - Delete an ad

import * as db from '../../lib/database.js';
import * as storage from '../../lib/storage.js';

export async function onRequestPost(context) {
  const { id, deleteFile = true } = await context.request.json();

  if (!id) {
    return Response.json({ error: 'Ad ID is required' }, { status: 400 });
  }

  // Get ad to find video path before deleting
  const ad = await db.getAdById(context.env.DB, id);
  if (!ad) {
    return Response.json({ error: 'Ad not found' }, { status: 404 });
  }

  // Delete from database
  const deleted = await db.deleteAd(context.env.DB, id);
  if (!deleted) {
    return Response.json({ error: 'Failed to delete ad' }, { status: 500 });
  }

  // Delete video from R2 if requested
  if (deleteFile && ad.videoSrc) {
    const key = ad.videoSrc.replace('/storage/', '');
    try {
      await storage.deleteFromR2(context.env.STORAGE, key);
    } catch (e) {
      console.error('Failed to delete video:', e);
    }
  }

  return Response.json({ success: true, message: 'Ad deleted' });
}
