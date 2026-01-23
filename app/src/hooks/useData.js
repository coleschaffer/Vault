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
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.fetchTweets();
      setTweets(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addTweet = useCallback(async (data) => {
    const result = await api.addTweet(data);
    // Optimistically add to local state
    setTweets(prev => [{ id: result.id, ...data, addedAt: new Date().toISOString() }, ...prev]);
    return result;
  }, []);

  const addTweetsBatch = useCallback(async (urls, tags) => {
    const result = await api.addTweetsBatch(urls, tags);
    await refetch(); // Refetch for batch since we get multiple IDs back
    return result;
  }, [refetch]);

  const deleteTweet = useCallback(async (id) => {
    // Optimistically remove from local state (no refetch = no iframe reload)
    setTweets(prev => prev.filter(t => t.id !== id));
    await api.deleteTweet(id);
  }, []);

  const deleteTweetsBatch = useCallback(async (ids) => {
    // Optimistically remove all from local state
    setTweets(prev => prev.filter(t => !ids.includes(t.id)));
    // Delete all in parallel
    await Promise.all(ids.map(id => api.deleteTweet(id)));
  }, []);

  const removeTagFromAll = useCallback(async (tagToRemove) => {
    // Find all tweets with this tag
    const tweetsWithTag = tweets.filter(t => t.tags?.includes(tagToRemove));
    if (tweetsWithTag.length === 0) return;

    // Optimistically update local state
    setTweets(prev => prev.map(t => ({
      ...t,
      tags: t.tags?.filter(tag => tag !== tagToRemove) || []
    })));

    // Update all affected tweets in parallel
    await Promise.all(tweetsWithTag.map(t =>
      api.updateTweet(t.id, { tags: t.tags.filter(tag => tag !== tagToRemove) })
    ));
  }, [tweets]);

  return { tweets, loading, error, refetch, addTweet, addTweetsBatch, deleteTweet, deleteTweetsBatch, removeTagFromAll };
}

// Get all unique tags from a data array
export function useUniqueTags(data) {
  return [...new Set((data || []).flatMap(item => item.tags || []))].sort();
}
