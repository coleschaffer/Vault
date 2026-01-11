// API Service for Ad Vault
// Fetches data from Cloudflare Workers API

import { API_BASE } from '../config.js';

// Helper for API calls
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ==================== ADS ====================

export async function fetchAds() {
  return apiFetch('/api/ads');
}

export async function fetchAd(id) {
  return apiFetch(`/api/ads/${id}`);
}

export async function processAd(url) {
  return apiFetch('/api/process-ad', {
    method: 'POST',
    body: JSON.stringify({ url })
  });
}

export async function deleteAd(id) {
  return apiFetch('/api/delete-ad', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
}

// ==================== IMAGES ====================

export async function fetchImages() {
  return apiFetch('/api/images');
}

export async function addImageEntry(data) {
  return apiFetch('/api/add-image-entry', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function deleteImage(id) {
  return apiFetch('/api/delete-image', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
}

export async function downloadImage(url, filename) {
  return apiFetch('/api/download-image', {
    method: 'POST',
    body: JSON.stringify({ url, filename })
  });
}

export async function fetchTweetData(url) {
  return apiFetch('/api/fetch-tweet', {
    method: 'POST',
    body: JSON.stringify({ url })
  });
}

// ==================== TWEETS ====================

export async function fetchTweets() {
  return apiFetch('/api/tweets');
}

export async function addTweet(data) {
  return apiFetch('/api/add-tweet', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function addTweetsBatch(urls, tags) {
  return apiFetch('/api/add-tweets-batch', {
    method: 'POST',
    body: JSON.stringify({ urls, tags })
  });
}

export async function deleteTweet(id) {
  return apiFetch('/api/delete-tweet', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
}

// ==================== HEALTH ====================

export async function healthCheck() {
  return apiFetch('/api/health');
}
