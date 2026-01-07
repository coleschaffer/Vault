import { useState } from 'react';

const API_BASE = 'http://localhost:3001';

export default function AddImageForm({ onImageAdded }) {
  const [mode, setMode] = useState('url'); // 'url', 'batch', or 'file'
  const [xUrl, setXUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetched data (single mode)
  const [fetchedImages, setFetchedImages] = useState([]);
  const [fetchedPrompt, setFetchedPrompt] = useState(null);
  const [fetchedRawPrompt, setFetchedRawPrompt] = useState(null);
  const [fetchedCreator, setFetchedCreator] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);

  // Image selection modal
  const [showImageSelector, setShowImageSelector] = useState(false);

  // Manual prompt input (for file mode or if prompt not found)
  const [promptJson, setPromptJson] = useState('');

  // Batch mode state
  const [batchInput, setBatchInput] = useState('');
  const [batchResults, setBatchResults] = useState([]);
  const [batchSelectedImages, setBatchSelectedImages] = useState({}); // { index: selectedImageIndex }
  const [batchImageSelectorIndex, setBatchImageSelectorIndex] = useState(null);
  const [batchFetching, setBatchFetching] = useState(new Set()); // URLs currently being fetched

  const fetchTweet = async () => {
    if (!xUrl.trim()) {
      setError('Please enter an X.com URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatus('');
    setFetchedImages([]);
    setFetchedPrompt(null);
    setFetchedRawPrompt(null);
    setSelectedImageIndex(null);

    try {
      const response = await fetch(`${API_BASE}/api/fetch-tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: xUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tweet');
      }

      if (data.images && data.images.length > 0) {
        setFetchedImages(data.images);
        setFetchedCreator(data.creator || '@unknown');

        if (data.images.length === 1) {
          setSelectedImageIndex(0);
        } else {
          setShowImageSelector(true);
        }
      } else {
        setError('No images found in this tweet');
        return;
      }

      // Auto-fill title and tags from Gemini
      if (data.title) {
        setTitle(data.title);
      }
      if (data.tags && data.tags.length > 0) {
        setTags(data.tags.join(', '));
      }

      if (data.prompt) {
        setFetchedPrompt(data.prompt);
        setFetchedRawPrompt(data.rawPrompt || null);
        setPromptJson(data.rawPrompt || JSON.stringify(data.prompt, null, 2));
        setStatus('✓ Found JSON prompt, title, and tags');
      } else {
        setStatus('⚠ No JSON prompt found in tweet text. Please paste it manually below.');
      }

    } catch (err) {
      setError(err.message || 'Failed to fetch tweet. Make sure the server is running (python scripts/server.py)');
    } finally {
      setIsLoading(false);
    }
  };

  const selectImage = (index) => {
    setSelectedImageIndex(index);
    setShowImageSelector(false);
  };

  // Batch mode functions - fetch single URL and add to results
  const fetchSingleForBatch = async (url) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // Check if already fetched or fetching
    const alreadyExists = batchResults.some(r => r.url === trimmedUrl || r.source === trimmedUrl);
    if (alreadyExists || batchFetching.has(trimmedUrl)) {
      return;
    }

    // Add to fetching set
    setBatchFetching(prev => new Set([...prev, trimmedUrl]));
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/fetch-tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tweet');
      }

      // Add to results
      setBatchResults(prev => {
        const newResults = [...prev, data];
        // Auto-select if single image
        if (data.success && data.images?.length === 1) {
          setBatchSelectedImages(sel => ({
            ...sel,
            [newResults.length - 1]: 0
          }));
        }
        return newResults;
      });

    } catch (err) {
      // Add failed result
      setBatchResults(prev => [...prev, {
        url: trimmedUrl,
        source: trimmedUrl,
        success: false,
        error: err.message
      }]);
    } finally {
      setBatchFetching(prev => {
        const newSet = new Set(prev);
        newSet.delete(trimmedUrl);
        return newSet;
      });
    }
  };

  // Handle paste event for batch mode
  const handleBatchPaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    const urls = pastedText.split(/[\n\s]+/).filter(u => u.includes('x.com') || u.includes('twitter.com'));

    if (urls.length > 0) {
      e.preventDefault();
      setBatchInput('');
      // Fetch all pasted URLs in parallel
      urls.forEach(url => fetchSingleForBatch(url));
    }
  };

  // Handle enter key for manual URL entry
  const handleBatchKeyDown = (e) => {
    if (e.key === 'Enter' && batchInput.trim()) {
      e.preventDefault();
      fetchSingleForBatch(batchInput);
      setBatchInput('');
    }
  };

  const selectBatchImage = (resultIndex, imageIndex) => {
    setBatchSelectedImages(prev => ({
      ...prev,
      [resultIndex]: imageIndex
    }));
    setBatchImageSelectorIndex(null);
  };

  const toggleBatchItem = (index) => {
    const result = batchResults[index];
    if (!result.success || !result.images?.length) return;

    setBatchSelectedImages(prev => {
      const newSelections = { ...prev };
      if (index in newSelections) {
        delete newSelections[index];
      } else {
        // Select first image by default
        newSelections[index] = 0;
      }
      return newSelections;
    });
  };

  const addAllBatch = async () => {
    const selectedItems = Object.entries(batchSelectedImages)
      .map(([index, imageIndex]) => ({
        result: batchResults[parseInt(index)],
        imageIndex
      }))
      .filter(item => item.result?.success);

    if (selectedItems.length === 0) {
      setError('Please select at least one image to add');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatus(`Adding ${selectedItems.length} images to vault...`);

    try {
      // Prepare entries for batch add
      const entries = selectedItems.map(({ result, imageIndex }) => {
        const id = result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        return {
          id,
          title: result.title,
          imageUrl: result.images[imageIndex],
          filename: `${id}.jpg`,
          source: result.source,
          creator: result.creator || '@unknown',
          prompt: result.prompt,
          rawPrompt: result.rawPrompt,
          tags: result.tags || [],
          dateAdded: new Date().toISOString().split('T')[0]
        };
      });

      const response = await fetch(`${API_BASE}/api/add-images-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add images');
      }

      setStatus(`✓ Added ${data.added}/${data.total} images to vault!`);

      // Reset after success
      setTimeout(() => {
        setBatchInput('');
        setBatchResults([]);
        setBatchSelectedImages({});
        setStatus('');
        if (onImageAdded) onImageAdded();
      }, 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    // Validate prompt JSON
    let parsedPrompt = fetchedPrompt;
    if (!parsedPrompt) {
      try {
        parsedPrompt = JSON.parse(promptJson);
      } catch (err) {
        setError('Invalid JSON prompt. Please check the format.');
        return;
      }
    }

    // Validate required fields
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (mode === 'url') {
      if (selectedImageIndex === null || !fetchedImages[selectedImageIndex]) {
        setError('Please fetch and select an image first');
        return;
      }
    }

    // Generate ID from title
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();

    // Parse tags
    const tagList = tags.split(',').map(t => t.trim()).filter(t => t);

    if (mode === 'url') {
      const imageUrl = fetchedImages[selectedImageIndex];
      const imageFileName = `${id}.jpg`;

      // Download image and add entry automatically
      setStatus('Downloading image...');
      setIsLoading(true);

      try {
        // Step 1: Download the image
        const downloadResponse = await fetch(`${API_BASE}/api/download-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: imageUrl, filename: imageFileName })
        });

        const downloadData = await downloadResponse.json();

        if (!downloadResponse.ok) {
          throw new Error(downloadData.error || 'Failed to download image');
        }

        setStatus('Adding to vault...');

        // Step 2: Add entry to images.js
        const entry = {
          id,
          title,
          imageSrc: downloadData.path,
          source: xUrl,
          creator: fetchedCreator,
          prompt: parsedPrompt,
          rawPrompt: fetchedRawPrompt || null,  // Send raw prompt to preserve order
          tags: tagList,
          dateAdded: new Date().toISOString().split('T')[0]
        };

        const addResponse = await fetch(`${API_BASE}/api/add-image-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });

        const addData = await addResponse.json();

        if (!addResponse.ok) {
          throw new Error(addData.error || 'Failed to add entry');
        }

        setStatus(`✓ Added "${title}" to Image Vault!`);

        // Reset form after success
        setTimeout(() => {
          setXUrl('');
          setTitle('');
          setTags('');
          setFetchedImages([]);
          setFetchedPrompt(null);
          setFetchedRawPrompt(null);
          setSelectedImageIndex(null);
          setPromptJson('');
          setStatus('');
          if (onImageAdded) onImageAdded();
        }, 1500);

      } catch (err) {
        setError(err.message);
        setStatus('');
      } finally {
        setIsLoading(false);
      }
    } else {
      // File mode - just show instructions
      setStatus('File upload mode - please save the file to app/public/images/vault/ and update images.js');
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-sm p-6">
      <h2 className="font-serif text-lg text-stone-900 mb-4">
        Add New Image
      </h2>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('url')}
          className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
            mode === 'url'
              ? 'bg-stone-900 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Single URL
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
            mode === 'batch'
              ? 'bg-stone-900 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Batch Add
        </button>
        <button
          onClick={() => setMode('file')}
          className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
            mode === 'file'
              ? 'bg-stone-900 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          From File
        </button>
      </div>

      {mode === 'url' ? (
        <div className="space-y-4">
          {/* X.com URL Input */}
          <div>
            <label htmlFor="xUrl" className="block text-sm text-stone-600 mb-1">
              X.com URL *
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                id="xUrl"
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/username/status/123456789"
                className="flex-1 px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
              <button
                onClick={fetchTweet}
                disabled={isLoading}
                className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
          </div>

          {/* Selected Image Preview */}
          {selectedImageIndex !== null && fetchedImages[selectedImageIndex] && (
            <div className="border border-stone-200 rounded-sm p-3">
              <div className="flex items-start gap-4">
                <img
                  src={fetchedImages[selectedImageIndex]}
                  alt="Selected"
                  className="w-32 h-32 object-cover rounded-sm"
                />
                <div className="flex-1">
                  <p className="text-sm text-stone-600 mb-2">Selected image</p>
                  {fetchedImages.length > 1 && (
                    <button
                      onClick={() => setShowImageSelector(true)}
                      className="text-xs text-stone-500 hover:text-stone-700 underline"
                    >
                      Change selection ({fetchedImages.length} images available)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          {selectedImageIndex !== null && (
            <>
              <div>
                <label htmlFor="title" className="block text-sm text-stone-600 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Luxury Hotel Suite - Blonde in Black Halter"
                  className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>

              {/* Prompt (editable if found, required if not) */}
              {!fetchedPrompt && (
                <div>
                  <label htmlFor="prompt" className="block text-sm text-stone-600 mb-1">
                    JSON Prompt * <span className="text-stone-400">(not found in tweet)</span>
                  </label>
                  <textarea
                    id="prompt"
                    value={promptJson}
                    onChange={(e) => setPromptJson(e.target.value)}
                    placeholder='{"scene_type": "...", "camera_perspective": {...}, ...}'
                    className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent resize-none"
                    rows={8}
                  />
                </div>
              )}

              {/* Tags */}
              <div>
                <label htmlFor="tags" className="block text-sm text-stone-600 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="portrait, blonde, luxury, hotel (comma-separated)"
                  className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Add Image'}
              </button>
            </>
          )}
        </div>
      ) : mode === 'batch' ? (
        /* Batch Mode */
        <div className="space-y-4">
          {/* Paste Input */}
          <div>
            <label htmlFor="batchInput" className="block text-sm text-stone-600 mb-1">
              Paste X.com URLs
            </label>
            <input
              type="text"
              id="batchInput"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              onPaste={handleBatchPaste}
              onKeyDown={handleBatchKeyDown}
              placeholder="Paste URL here (auto-fetches on paste)"
              className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              autoComplete="off"
            />
            <p className="text-xs text-stone-400 mt-1">
              {batchFetching.size > 0 && (
                <span className="text-stone-600">Fetching {batchFetching.size}... </span>
              )}
              {batchResults.length > 0 && `${batchResults.filter(r => r.success).length} fetched`}
              {batchResults.length === 0 && batchFetching.size === 0 && 'Paste URLs or type and press Enter'}
            </p>
          </div>

          {/* Batch Results */}
          {(batchResults.length > 0 || batchFetching.size > 0) && (
            <div className="border border-stone-200 rounded-sm">
              <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  {Object.keys(batchSelectedImages).length} of {batchResults.filter(r => r.success).length} selected
                  {batchFetching.size > 0 && <span className="text-stone-400 ml-2">({batchFetching.size} loading...)</span>}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const allSelected = {};
                      batchResults.forEach((r, i) => {
                        if (r.success && r.images?.length) {
                          allSelected[i] = batchSelectedImages[i] ?? 0;
                        }
                      });
                      setBatchSelectedImages(allSelected);
                    }}
                    className="text-xs text-stone-500 hover:text-stone-700"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setBatchSelectedImages({})}
                    className="text-xs text-stone-500 hover:text-stone-700"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={() => {
                      setBatchResults([]);
                      setBatchSelectedImages({});
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-stone-100">
                {/* Loading placeholders */}
                {[...batchFetching].map((url) => (
                  <div key={url} className="p-3 flex items-start gap-3 animate-pulse">
                    <div className="mt-1 w-5 h-5 rounded border border-stone-200 bg-stone-100 flex-shrink-0" />
                    <div className="w-16 h-16 bg-stone-200 rounded-sm flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-stone-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-stone-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}

                {/* Fetched results */}
                {batchResults.map((result, index) => (
                  <div
                    key={result.url || index}
                    className={`p-3 flex items-start gap-3 ${
                      !result.success ? 'bg-red-50/50' : index in batchSelectedImages ? 'bg-stone-50' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleBatchItem(index)}
                      disabled={!result.success || !result.images?.length}
                      className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                        !result.success || !result.images?.length
                          ? 'border-stone-200 bg-stone-100 cursor-not-allowed'
                          : index in batchSelectedImages
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 hover:border-stone-400'
                      }`}
                    >
                      {index in batchSelectedImages && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* Image Preview */}
                    {result.success && result.images?.length > 0 ? (
                      <div className="relative flex-shrink-0">
                        <img
                          src={result.images[batchSelectedImages[index] ?? 0]}
                          alt=""
                          className="w-16 h-16 object-cover rounded-sm"
                        />
                        {result.images.length > 1 && (
                          <button
                            onClick={() => setBatchImageSelectorIndex(index)}
                            className="absolute -bottom-1 -right-1 bg-stone-900 text-white text-xs px-1.5 py-0.5 rounded"
                          >
                            {result.images.length}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-stone-100 rounded-sm flex items-center justify-center flex-shrink-0">
                        <span className="text-stone-400 text-xs">No img</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {result.success ? (
                        <>
                          <p className="text-sm font-medium text-stone-900 truncate">
                            {result.title || 'Untitled'}
                          </p>
                          <p className="text-xs text-stone-500 truncate">
                            {result.creator} · {result.tags?.slice(0, 3).join(', ')}
                          </p>
                          <p className="text-xs text-stone-400 truncate mt-0.5">
                            {result.rawPrompt ? '✓ Has prompt' : '⚠ No prompt'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-red-600 truncate">
                            Failed to fetch
                          </p>
                          <p className="text-xs text-red-400 truncate">
                            {result.error || 'Unknown error'}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => {
                        setBatchResults(prev => prev.filter((_, i) => i !== index));
                        setBatchSelectedImages(prev => {
                          const newSel = {};
                          Object.entries(prev).forEach(([k, v]) => {
                            const ki = parseInt(k);
                            if (ki < index) newSel[ki] = v;
                            else if (ki > index) newSel[ki - 1] = v;
                          });
                          return newSel;
                        });
                      }}
                      className="mt-1 text-stone-300 hover:text-stone-500 flex-shrink-0"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add All Button */}
              {Object.keys(batchSelectedImages).length > 0 && (
                <div className="p-3 border-t border-stone-200 bg-stone-50">
                  <button
                    onClick={addAllBatch}
                    disabled={isLoading}
                    className="w-full px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Adding...' : `Add ${Object.keys(batchSelectedImages).length} Images to Vault`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* File Mode */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm text-stone-600 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Luxury Hotel Suite - Blonde in Black Halter"
              className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm text-stone-600 mb-1">
              Image File
            </label>
            <p className="text-sm text-stone-500 bg-stone-50 p-3 rounded-sm">
              Save your image file to: <code className="bg-stone-200 px-1 rounded">app/public/images/vault/</code>
            </p>
          </div>

          <div>
            <label htmlFor="prompt" className="block text-sm text-stone-600 mb-1">
              JSON Prompt *
            </label>
            <textarea
              id="prompt"
              value={promptJson}
              onChange={(e) => setPromptJson(e.target.value)}
              placeholder='{"scene_type": "...", "camera_perspective": {...}, ...}'
              className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent resize-none"
              rows={10}
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm text-stone-600 mb-1">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="portrait, blonde, luxury, hotel (comma-separated)"
              className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 transition-colors"
          >
            Generate Entry
          </button>
        </form>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {status && (
        <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded-sm">
          <pre className="text-stone-700 text-xs whitespace-pre-wrap font-mono overflow-x-auto">
            {status}
          </pre>
        </div>
      )}

      {/* Image Selection Modal */}
      {showImageSelector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImageSelector(false);
          }}
        >
          <div className="bg-white rounded-sm max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-stone-200">
              <h3 className="font-serif text-lg text-stone-900">
                Select an Image
              </h3>
              <p className="text-sm text-stone-500">
                This tweet has {fetchedImages.length} images. Click to select one.
              </p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4 overflow-y-auto max-h-[60vh]">
              {fetchedImages.map((url, index) => (
                <button
                  key={index}
                  onClick={() => selectImage(index)}
                  className="relative group"
                >
                  <img
                    src={url}
                    alt={`Option ${index + 1}`}
                    className="w-full h-48 object-cover rounded-sm border-2 border-transparent group-hover:border-stone-900 transition-colors"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-sm" />
                  <span className="absolute top-2 left-2 bg-white/90 px-2 py-1 text-xs font-medium rounded">
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-stone-200">
              <button
                onClick={() => setShowImageSelector(false)}
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Image Selection Modal */}
      {batchImageSelectorIndex !== null && batchResults[batchImageSelectorIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBatchImageSelectorIndex(null);
          }}
        >
          <div className="bg-white rounded-sm max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-stone-200">
              <h3 className="font-serif text-lg text-stone-900">
                Select an Image
              </h3>
              <p className="text-sm text-stone-500">
                {batchResults[batchImageSelectorIndex].title || 'Untitled'} - {batchResults[batchImageSelectorIndex].images.length} images
              </p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4 overflow-y-auto max-h-[60vh]">
              {batchResults[batchImageSelectorIndex].images.map((url, imgIndex) => (
                <button
                  key={imgIndex}
                  onClick={() => selectBatchImage(batchImageSelectorIndex, imgIndex)}
                  className={`relative group ${
                    batchSelectedImages[batchImageSelectorIndex] === imgIndex ? 'ring-2 ring-stone-900 rounded-sm' : ''
                  }`}
                >
                  <img
                    src={url}
                    alt={`Option ${imgIndex + 1}`}
                    className="w-full h-48 object-cover rounded-sm border-2 border-transparent group-hover:border-stone-900 transition-colors"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-sm" />
                  <span className="absolute top-2 left-2 bg-white/90 px-2 py-1 text-xs font-medium rounded">
                    {imgIndex + 1}
                  </span>
                  {batchSelectedImages[batchImageSelectorIndex] === imgIndex && (
                    <span className="absolute top-2 right-2 bg-stone-900 text-white px-2 py-1 text-xs font-medium rounded">
                      Selected
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-stone-200">
              <button
                onClick={() => setBatchImageSelectorIndex(null)}
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
