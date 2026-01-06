import { useState } from 'react';

export default function AddAdForm({ onAdAdded }) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!url.trim()) {
      setError('Please enter an X.com URL');
      return;
    }

    // Validate URL format
    if (!url.match(/x\.com|twitter\.com/)) {
      setError('Please enter a valid X.com or Twitter URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatus('Fetching video from X.com...');

    try {
      // For now, we'll show instructions since the backend requires Python
      // In a full implementation, this would call an API endpoint
      setStatus('');
      setError('');

      // Extract tweet ID for display
      const tweetIdMatch = url.match(/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : 'unknown';

      // Show manual instructions
      const instructions = `
Run this command in your terminal to add the ad:

python scripts/add_ad.py "${url}"

This will:
1. Download the video from X.com
2. Transcribe it with Whisper
3. Generate an ad entry for ads.js

Then copy the output and add to app/src/data/ads.js
      `.trim();

      setStatus(instructions);
      setUrl('');
    } catch (err) {
      setError(err.message || 'Failed to process URL');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-sm p-6">
      <h2 className="font-serif text-lg text-stone-900 mb-4">
        Add New Ad from X.com
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm text-stone-600 mb-2">
            X.com / Twitter URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://x.com/username/status/123456789"
            className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Add Ad'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {status && (
        <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded-sm">
          <pre className="text-stone-700 text-xs whitespace-pre-wrap font-mono">
            {status}
          </pre>
        </div>
      )}
    </div>
  );
}
