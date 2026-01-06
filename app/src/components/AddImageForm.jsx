import { useState } from 'react';

export default function AddImageForm({ onImageAdded }) {
  const [mode, setMode] = useState('url'); // 'url' or 'file'
  const [xUrl, setXUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [promptJson, setPromptJson] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    // Validate prompt JSON
    let parsedPrompt;
    try {
      parsedPrompt = JSON.parse(promptJson);
    } catch (err) {
      setError('Invalid JSON prompt. Please check the format.');
      return;
    }

    // Validate required fields
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (mode === 'url' && !xUrl.trim() && !imageUrl.trim()) {
      setError('Please enter an X.com URL or direct image URL');
      return;
    }

    // Generate ID from title
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();

    // Parse tags
    const tagList = tags.split(',').map(t => t.trim()).filter(t => t);

    // For now, show instructions since image download requires backend
    if (mode === 'url') {
      const sourceUrl = xUrl || imageUrl;
      const imageFileName = `${id}.jpg`;

      const instructions = `
To add this image, follow these steps:

1. Download the image manually and save to:
   app/public/images/vault/${imageFileName}

2. Add this entry to app/src/data/images.js:

{
  id: "${id}",
  title: "${title}",
  imageSrc: "/images/vault/${imageFileName}",
  source: "${sourceUrl}",
  creator: "${xUrl ? '@' + (xUrl.match(/x\.com\/([^/]+)/) || ['', 'unknown'])[1] : 'unknown'}",
  prompt: ${JSON.stringify(parsedPrompt, null, 2).split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n')},
  tags: ${JSON.stringify(tagList)},
  dateAdded: "${new Date().toISOString().split('T')[0]}"
}
      `.trim();

      setStatus(instructions);
    } else {
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
          From URL
        </button>
        <button
          onClick={() => setMode('file')}
          className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
            mode === 'file'
              ? 'bg-stone-900 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          From File + Prompt
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
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

        {mode === 'url' ? (
          <>
            {/* X.com URL */}
            <div>
              <label htmlFor="xUrl" className="block text-sm text-stone-600 mb-1">
                X.com / Twitter URL
              </label>
              <input
                type="url"
                id="xUrl"
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/username/status/123456789"
                className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
              <p className="text-xs text-stone-400 mt-1">
                Or enter a direct image URL below
              </p>
            </div>

            {/* Direct Image URL */}
            <div>
              <label htmlFor="imageUrl" className="block text-sm text-stone-600 mb-1">
                Direct Image URL
              </label>
              <input
                type="url"
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://pbs.twimg.com/media/..."
                className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm text-stone-600 mb-1">
              Image File
            </label>
            <p className="text-sm text-stone-500 bg-stone-50 p-3 rounded-sm">
              Save your image file to: <code className="bg-stone-200 px-1 rounded">app/public/images/vault/</code>
              <br />
              Then reference it in the prompt JSON below.
            </p>
          </div>
        )}

        {/* JSON Prompt */}
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
          <p className="text-xs text-stone-400 mt-1">
            Paste the complete JSON prompt (must be valid JSON)
          </p>
        </div>

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
          type="submit"
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 transition-colors"
        >
          Generate Entry
        </button>
      </form>

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
    </div>
  );
}
