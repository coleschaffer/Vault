// Local File Storage utilities for Ad Vault (Railway deployment)
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory (relative to project root)
const STORAGE_DIR = path.join(__dirname, '..', 'storage');

// Ensure storage directory exists
async function ensureStorageDir(subDir = '') {
  const dir = subDir ? path.join(STORAGE_DIR, subDir) : STORAGE_DIR;
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Save a file to local storage
 * @param {string} key - File path/key (e.g., 'videos/123.mp4')
 * @param {Buffer|ArrayBuffer} data - File data
 * @param {string} contentType - MIME type (stored in metadata)
 */
export async function saveFile(key, data, contentType) {
  const filePath = path.join(STORAGE_DIR, key);
  const dir = path.dirname(filePath);
  await ensureStorageDir(path.relative(STORAGE_DIR, dir));

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await fs.writeFile(filePath, buffer);

  // Store metadata alongside file
  const metaPath = filePath + '.meta.json';
  await fs.writeFile(metaPath, JSON.stringify({ contentType, size: buffer.length }));

  return key;
}

/**
 * Get a file from local storage
 * @param {string} key - File path/key
 */
export async function getFile(key) {
  const filePath = path.join(STORAGE_DIR, key);
  const metaPath = filePath + '.meta.json';

  try {
    const data = await fs.readFile(filePath);
    let contentType = 'application/octet-stream';

    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      contentType = meta.contentType || contentType;
    } catch (e) {
      // Infer from extension if no metadata
      const ext = path.extname(key).toLowerCase();
      const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      contentType = mimeTypes[ext] || contentType;
    }

    return { data, contentType };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Delete a file from local storage
 * @param {string} key - File path/key
 */
export async function deleteFile(key) {
  const filePath = path.join(STORAGE_DIR, key);
  const metaPath = filePath + '.meta.json';

  try {
    await fs.unlink(filePath);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  try {
    await fs.unlink(metaPath);
  } catch (e) {
    // Ignore if metadata doesn't exist
  }
}

/**
 * List files in storage with a prefix
 * @param {string} prefix - Prefix to filter by
 */
export async function listFiles(prefix = '') {
  const dir = prefix ? path.join(STORAGE_DIR, prefix) : STORAGE_DIR;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && !e.name.endsWith('.meta.json'))
      .map(e => ({
        key: prefix ? path.join(prefix, e.name) : e.name
      }));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

/**
 * Download file from URL and save to storage
 * @param {string} url - URL to download from
 * @param {string} key - Destination key in storage
 */
export async function downloadAndStore(url, key) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const data = await response.arrayBuffer();

  await saveFile(key, data, contentType);

  return {
    key,
    size: data.byteLength,
    contentType
  };
}

/**
 * Generate a public URL for stored file (via Express)
 * @param {string} key - Storage key
 */
export function getPublicUrl(key) {
  return `/storage/${key}`;
}

// Backwards compatibility aliases for R2 API
export const uploadToR2 = saveFile;
export const getFromR2 = getFile;
export const deleteFromR2 = deleteFile;
export const listR2Files = listFiles;
export const downloadAndStoreToR2 = downloadAndStore;
export const getR2PublicUrl = getPublicUrl;
