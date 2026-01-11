// Data hooks for Ad Vault
// Provides React hooks for fetching and managing vault data

import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api.js';

// Generic data fetching hook
function useApiData(fetchFn, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ==================== ADS ====================

export function useAds() {
  const { data: ads, loading, error, refetch } = useApiData(api.fetchAds);

  const processAd = useCallback(async (url) => {
    const result = await api.processAd(url);
    await refetch();
    return result;
  }, [refetch]);

  const deleteAd = useCallback(async (id) => {
    await api.deleteAd(id);
    await refetch();
  }, [refetch]);

  return { ads, loading, error, refetch, processAd, deleteAd };
}

// ==================== IMAGES ====================

export function useImages() {
  const { data: images, loading, error, refetch } = useApiData(api.fetchImages);

  const addImage = useCallback(async (data) => {
    const result = await api.addImageEntry(data);
    await refetch();
    return result;
  }, [refetch]);

  const deleteImage = useCallback(async (id) => {
    await api.deleteImage(id);
    await refetch();
  }, [refetch]);

  const downloadImage = useCallback(async (url, filename) => {
    return api.downloadImage(url, filename);
  }, []);

  const fetchTweetData = useCallback(async (url) => {
    return api.fetchTweetData(url);
  }, []);

  return { images, loading, error, refetch, addImage, deleteImage, downloadImage, fetchTweetData };
}

// ==================== TWEETS ====================

export function useTweets() {
  const { data: tweets, loading, error, refetch } = useApiData(api.fetchTweets);

  const addTweet = useCallback(async (data) => {
    const result = await api.addTweet(data);
    await refetch();
    return result;
  }, [refetch]);

  const addTweetsBatch = useCallback(async (urls, tags) => {
    const result = await api.addTweetsBatch(urls, tags);
    await refetch();
    return result;
  }, [refetch]);

  const deleteTweet = useCallback(async (id) => {
    await api.deleteTweet(id);
    await refetch();
  }, [refetch]);

  return { tweets, loading, error, refetch, addTweet, addTweetsBatch, deleteTweet };
}

// Get all unique tags from a data array
export function useUniqueTags(data) {
  return [...new Set((data || []).flatMap(item => item.tags || []))].sort();
}
