import { useState, useMemo } from 'react';
import { tweets } from '../data/tweets';

const API_BASE = 'http://localhost:3001';

export default function AddTweetForm({ onTweetAdded }) {
  const [mode, setMode] = useState('single'); // 'single' or 'batch'
  const [url, setUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Batch mode state
  const [batchInput, setBatchInput] = useState('');
  const [batchUrls, setBatchUrls] = useState([]); // Array of { url, selected }
  const [batchResults, setBatchResults] = useState(null);

  // Get all existing unique tags from tweets
  const existingTags = useMemo(() => {
    const tagSet = new Set();
    tweets.forEach(tweet => tweet.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, []);

  // Filter existing tags that aren't already selected
  const availableTags = useMemo(() => {
    return existingTags.filter(tag => !tags.includes(tag));
  }, [existingTags, tags]);

  // Add tag
  const addTag = (tag) => {
    const trimmed = (tag || tagInput).trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  // Handle Enter key for tags
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // Remove tag
  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Validate X.com URL
  const isValidUrl = (url) => {
    return url.includes('x.com/') || url.includes('twitter.com/');
  };

  // Extract tweet ID from URL
  const getTweetId = (url) => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  };

  // Add URL to batch list
  const addUrlToBatch = (urlString) => {
    const trimmed = urlString.trim();
    if (!trimmed || !isValidUrl(trimmed)) return false;

    // Check if already in list
    const alreadyExists = batchUrls.some(u => u.url === trimmed);
    if (alreadyExists) return false;

    setBatchUrls(prev => [...prev, { url: trimmed, selected: true }]);
    return true;
  };

  // Handle paste event for batch mode
  const handleBatchPaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    const urls = pastedText.split(/[\n\s]+/).filter(u => isValidUrl(u));

    if (urls.length > 0) {
      e.preventDefault();
      setBatchInput('');
      urls.forEach(url => addUrlToBatch(url));
    }
  };

  // Handle enter key for manual URL entry
  const handleBatchKeyDown = (e) => {
    if (e.key === 'Enter' && batchInput.trim()) {
      e.preventDefault();
      if (addUrlToBatch(batchInput)) {
        setBatchInput('');
      }
    }
  };

  // Toggle URL selection
  const toggleUrlSelection = (index) => {
    setBatchUrls(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  // Remove URL from batch
  const removeUrlFromBatch = (index) => {
    setBatchUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Submit single tweet
  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a tweet URL');
      return;
    }

    if (!isValidUrl(url)) {
      setError('Please enter a valid X.com or Twitter URL');
      return;
    }

    if (tags.length === 0) {
      setError('Please add at least one tag');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/add-tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), tags })
      });

      const data = await response.json();

      if (response.ok) {
        setUrl('');
        setTags([]);
        if (onTweetAdded) onTweetAdded();
        window.location.reload();
      } else {
        setError(data.error || 'Failed to add tweet');
      }
    } catch (err) {
      setError('Server error. Make sure the server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit batch tweets
  const handleSubmitBatch = async () => {
    setError('');
    setBatchResults(null);

    const selectedUrls = batchUrls.filter(u => u.selected).map(u => u.url);

    if (selectedUrls.length === 0) {
      setError('Please select at least one URL');
      return;
    }

    if (tags.length === 0) {
      setError('Please add at least one tag');
      return;
    }

    setIsSubmitting(true);
    setStatus(`Adding ${selectedUrls.length} tweets...`);

    try {
      const response = await fetch(`${API_BASE}/api/add-tweets-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: selectedUrls, tags })
      });

      const data = await response.json();

      if (response.ok) {
        setBatchResults(data);
        setStatus(`✓ Added ${data.added}/${data.total} tweets to vault!`);
        if (data.added > 0) {
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } else {
        setError(data.error || 'Failed to add tweets');
        setStatus('');
      }
    } catch (err) {
      setError('Server error. Make sure the server is running.');
      setStatus('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = batchUrls.filter(u => u.selected).length;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg text-stone-900">Add Tweet</h2>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
              mode === 'single'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
              mode === 'batch'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Batch
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-sm">
          {error}
        </div>
      )}

      {status && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-sm">
          {status}
        </div>
      )}

      {mode === 'single' ? (
        /* Single Mode */
        <form onSubmit={handleSubmitSingle} className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
              Tweet URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://x.com/username/status/..."
              className="w-full px-4 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400"
            />
          </div>

          {/* Tags Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
              Tags
            </label>

            {/* Existing Tags to Select */}
            {availableTags.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-stone-400 mb-2">Click to add existing tags:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="px-2 py-1 text-xs text-stone-500 bg-white border border-stone-200 rounded-sm hover:border-stone-400 hover:bg-stone-50 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* New Tag Input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Or type a new tag and press Enter"
                className="flex-1 px-4 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400"
              />
              <button
                type="button"
                onClick={() => addTag()}
                className="px-4 py-2 text-sm font-medium bg-stone-200 text-stone-700 rounded-sm hover:bg-stone-300 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Selected Tags */}
            {tags.length > 0 && (
              <div>
                <p className="text-xs text-stone-400 mb-2">Selected tags:</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-stone-900 text-white rounded-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-stone-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : 'Add Tweet'}
          </button>
        </form>
      ) : (
        /* Batch Mode */
        <div className="space-y-4">
          {/* Paste Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
              Paste X.com URLs
            </label>
            <input
              type="text"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              onPaste={handleBatchPaste}
              onKeyDown={handleBatchKeyDown}
              placeholder="Paste URLs here (auto-adds on paste)"
              className="w-full px-4 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400"
              autoComplete="off"
            />
            <p className="text-xs text-stone-400 mt-1">
              {batchUrls.length > 0
                ? `${batchUrls.length} URLs added, ${selectedCount} selected`
                : 'Paste URLs or type and press Enter'
              }
            </p>
          </div>

          {/* URL List */}
          {batchUrls.length > 0 && (
            <div className="border border-stone-200 rounded-sm bg-white">
              <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  {selectedCount} of {batchUrls.length} selected
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBatchUrls(prev => prev.map(u => ({ ...u, selected: true })))}
                    className="text-xs text-stone-500 hover:text-stone-700"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchUrls(prev => prev.map(u => ({ ...u, selected: false })))}
                    className="text-xs text-stone-500 hover:text-stone-700"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchUrls([])}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-stone-100">
                {batchUrls.map((item, index) => (
                  <div
                    key={item.url}
                    className={`p-3 flex items-center gap-3 ${item.selected ? 'bg-stone-50' : ''}`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleUrlSelection(index)}
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                        item.selected
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 hover:border-stone-400'
                      }`}
                    >
                      {item.selected && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* URL */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 truncate font-mono">
                        {item.url}
                      </p>
                      <p className="text-xs text-stone-400">
                        ID: {getTweetId(item.url)}
                      </p>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeUrlFromBatch(index)}
                      className="text-stone-300 hover:text-stone-500 flex-shrink-0"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
              Tags <span className="text-stone-500">(applied to all)</span>
            </label>

            {/* Existing Tags to Select */}
            {availableTags.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-stone-400 mb-2">Click to add existing tags:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="px-2 py-1 text-xs text-stone-500 bg-white border border-stone-200 rounded-sm hover:border-stone-400 hover:bg-stone-50 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* New Tag Input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Or type a new tag and press Enter"
                className="flex-1 px-4 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400"
              />
              <button
                type="button"
                onClick={() => addTag()}
                className="px-4 py-2 text-sm font-medium bg-stone-200 text-stone-700 rounded-sm hover:bg-stone-300 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Selected Tags */}
            {tags.length > 0 && (
              <div>
                <p className="text-xs text-stone-400 mb-2">Selected tags:</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-stone-900 text-white rounded-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-stone-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={handleSubmitBatch}
              disabled={isSubmitting || tags.length === 0}
              className="w-full px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Adding...'
                : `Add ${selectedCount} Tweet${selectedCount !== 1 ? 's' : ''} to Vault`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
