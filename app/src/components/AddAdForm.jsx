import { useState } from 'react';
import { API_BASE } from '../config';

export default function AddAdForm({ onAdAdded }) {
  const [mode, setMode] = useState('single'); // 'single' or 'batch'
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Batch mode state
  const [batchInput, setBatchInput] = useState('');
  const [batchUrls, setBatchUrls] = useState([]); // Array of { url, selected, status, result }
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Validate X.com URL
  const isValidUrl = (url) => {
    return url.includes('x.com/') || url.includes('twitter.com/');
  };

  // Extract tweet ID from URL
  const getTweetId = (url) => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  };

  // Handle single URL submit
  const handleSubmitSingle = async (e) => {
    e.preventDefault();

    if (!url.trim()) {
      setError('Please enter an X.com URL');
      return;
    }

    if (!isValidUrl(url)) {
      setError('Please enter a valid X.com or Twitter URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatus('Downloading video from X.com...');

    try {
      const response = await fetch(`${API_BASE}/api/process-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Added "${data.title}" with ${data.shots_count} shots and ${data.transcript_length} char transcript`);
        setUrl('');
        setTimeout(() => {
          if (onAdAdded) onAdAdded();
          window.location.reload();
        }, 2000);
      } else {
        setError(data.error || 'Failed to process ad');
        setStatus('');
      }
    } catch (err) {
      setError('Server error. Make sure the server is running and dependencies are installed (yt-dlp, openai-whisper)');
      setStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  // Add URL to batch list
  const addUrlToBatch = (urlString) => {
    const trimmed = urlString.trim();
    if (!trimmed || !isValidUrl(trimmed)) return false;

    const alreadyExists = batchUrls.some(u => u.url === trimmed);
    if (alreadyExists) return false;

    setBatchUrls(prev => [...prev, { url: trimmed, selected: true, status: 'pending', result: null }]);
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

  // Process batch ads one by one (to show progress)
  const handleProcessBatch = async () => {
    const selectedUrls = batchUrls.filter(u => u.selected);

    if (selectedUrls.length === 0) {
      setError('Please select at least one URL');
      return;
    }

    setBatchProcessing(true);
    setError('');

    let successCount = 0;

    for (let i = 0; i < batchUrls.length; i++) {
      if (!batchUrls[i].selected) continue;

      // Update status to processing
      setBatchUrls(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'processing' } : item
      ));

      try {
        const response = await fetch(`${API_BASE}/api/process-ad`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: batchUrls[i].url })
        });

        const data = await response.json();

        if (response.ok) {
          setBatchUrls(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'success', result: data } : item
          ));
          successCount++;
        } else {
          setBatchUrls(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', result: { error: data.error } } : item
          ));
        }
      } catch (err) {
        setBatchUrls(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', result: { error: err.message } } : item
        ));
      }
    }

    setBatchProcessing(false);

    if (successCount > 0) {
      setStatus(`Added ${successCount} ads to vault. Reloading...`);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  const selectedCount = batchUrls.filter(u => u.selected).length;
  const pendingCount = batchUrls.filter(u => u.selected && u.status === 'pending').length;

  return (
    <div className="bg-white border border-stone-200 rounded-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg text-stone-900">Add New Ad from X.com</h2>

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
          <div>
            <label htmlFor="url" className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
              X.com / Twitter URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://x.com/username/status/123456789"
              className="w-full px-4 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400"
              disabled={isLoading}
            />
            <p className="text-xs text-stone-400 mt-1">
              This will download the video, transcribe it with Whisper, and add it to your vault.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing... (this may take a minute)' : 'Add Ad'}
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
              disabled={batchProcessing}
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
            <div className="border border-stone-200 rounded-sm bg-stone-50">
              <div className="p-3 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  {selectedCount} of {batchUrls.length} selected
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBatchUrls(prev => prev.map(u => ({ ...u, selected: true })))}
                    className="text-xs text-stone-500 hover:text-stone-700"
                    disabled={batchProcessing}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchUrls(prev => prev.map(u => ({ ...u, selected: false })))}
                    className="text-xs text-stone-500 hover:text-stone-700"
                    disabled={batchProcessing}
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchUrls([])}
                    className="text-xs text-red-500 hover:text-red-700"
                    disabled={batchProcessing}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-stone-200">
                {batchUrls.map((item, index) => (
                  <div
                    key={item.url}
                    className={`p-3 flex items-center gap-3 ${
                      item.status === 'success' ? 'bg-green-50' :
                      item.status === 'error' ? 'bg-red-50' :
                      item.status === 'processing' ? 'bg-yellow-50' :
                      item.selected ? 'bg-white' : 'bg-stone-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleUrlSelection(index)}
                      disabled={batchProcessing || item.status !== 'pending'}
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                        item.status === 'success' ? 'border-green-500 bg-green-500 text-white' :
                        item.status === 'error' ? 'border-red-500 bg-red-500 text-white' :
                        item.status === 'processing' ? 'border-yellow-500 bg-yellow-500 animate-pulse' :
                        item.selected
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 hover:border-stone-400'
                      }`}
                    >
                      {item.status === 'success' && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {item.status === 'error' && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                      {item.status === 'pending' && item.selected && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* URL and Status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 truncate font-mono">
                        {item.url}
                      </p>
                      <p className="text-xs text-stone-400">
                        {item.status === 'processing' && 'Downloading & transcribing...'}
                        {item.status === 'success' && item.result?.title}
                        {item.status === 'error' && (
                          <span className="text-red-500">{item.result?.error}</span>
                        )}
                        {item.status === 'pending' && `ID: ${getTweetId(item.url)}`}
                      </p>
                    </div>

                    {/* Remove button */}
                    {item.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => removeUrlFromBatch(index)}
                        className="text-stone-300 hover:text-stone-500 flex-shrink-0"
                        title="Remove"
                        disabled={batchProcessing}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleProcessBatch}
              disabled={batchProcessing}
              className="w-full px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchProcessing
                ? 'Processing... (this may take a while)'
                : `Process ${pendingCount} Ad${pendingCount !== 1 ? 's' : ''}`
              }
            </button>
          )}

          <p className="text-xs text-stone-400 text-center">
            Each ad takes ~30-60 seconds to download and transcribe
          </p>
        </div>
      )}
    </div>
  );
}
