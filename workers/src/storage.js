// R2 Storage utilities for Ad Vault

/**
 * Upload a file to R2 storage
 * @param {R2Bucket} bucket - R2 bucket binding
 * @param {string} key - File path/key in R2
 * @param {ArrayBuffer|ReadableStream} data - File data
 * @param {string} contentType - MIME type
 */
export async function uploadToR2(bucket, key, data, contentType) {
  await bucket.put(key, data, {
    httpMetadata: { contentType }
  });
  return key;
}

/**
 * Get a file from R2 storage
 * @param {R2Bucket} bucket - R2 bucket binding
 * @param {string} key - File path/key in R2
 */
export async function getFromR2(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  return {
    data: await object.arrayBuffer(),
    contentType: object.httpMetadata?.contentType || 'application/octet-stream'
  };
}

/**
 * Delete a file from R2 storage
 * @param {R2Bucket} bucket - R2 bucket binding
 * @param {string} key - File path/key in R2
 */
export async function deleteFromR2(bucket, key) {
  await bucket.delete(key);
}

/**
 * List files in R2 with a prefix
 * @param {R2Bucket} bucket - R2 bucket binding
 * @param {string} prefix - Prefix to filter by
 */
export async function listR2Files(bucket, prefix) {
  const listed = await bucket.list({ prefix });
  return listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded
  }));
}

/**
 * Download file from URL and upload to R2
 * @param {R2Bucket} bucket - R2 bucket binding
 * @param {string} url - URL to download from
 * @param {string} key - Destination key in R2
 */
export async function downloadAndStoreToR2(bucket, url, key) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const data = await response.arrayBuffer();

  await uploadToR2(bucket, key, data, contentType);

  return {
    key,
    size: data.byteLength,
    contentType
  };
}

/**
 * Generate a public URL for R2 object (via Worker)
 * @param {string} key - R2 object key
 * @param {string} baseUrl - Base URL of the worker
 */
export function getR2PublicUrl(key, baseUrl) {
  return `${baseUrl}/storage/${key}`;
}
