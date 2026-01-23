import { useState, useRef } from 'react';

export default function TweetCard({ tweet, onDelete, selectMode, isSelected, onToggleSelect }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const iframeRef = useRef(null);

  // Extract tweet ID from URL
  const getTweetId = (url) => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  };

  const tweetId = getTweetId(tweet.url);

  // Build the embed URL with parameters for full content
  const embedUrl = tweetId
    ? `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=light&dnt=true`
    : null;

  // Handle card click in select mode
  const handleCardClick = (e) => {
    if (selectMode && onToggleSelect) {
      e.preventDefault();
      onToggleSelect();
    }
  };

  return (
    <div
      className={`relative bg-white border rounded-sm overflow-hidden transition-all ${
        selectMode ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'border-stone-900 ring-2 ring-stone-900 ring-opacity-20'
          : 'border-stone-200'
      }`}
      onClick={handleCardClick}
    >
      {/* Selection Checkbox Overlay */}
      {selectMode && (
        <div className="absolute top-3 left-3 z-10">
          <div
            className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-stone-900 border-stone-900'
                : 'bg-white border-stone-300'
            }`}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Tweet Embed */}
      <div className={`relative ${selectMode ? 'pointer-events-none' : ''}`}>
        {!isLoaded && (
          <div className="h-[300px] flex items-center justify-center text-stone-400 text-sm animate-pulse">
            Loading tweet...
          </div>
        )}

        {embedUrl && (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className={`w-full border-0 ${isLoaded ? '' : 'hidden'}`}
            style={{ height: '400px' }}
            frameBorder="0"
            allowFullScreen
            onLoad={() => setIsLoaded(true)}
            title={`Tweet ${tweetId}`}
          />
        )}
      </div>

      {/* Tags and Actions */}
      <div className="p-4 border-t border-stone-100">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {tweet.tags?.map(tag => (
            <span
              key={tag}
              className="px-2 py-1 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Actions - hidden in select mode */}
        {!selectMode && (
          <div className="flex items-center justify-between text-xs">
            <a
              href={tweet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              Source ↗
            </a>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-stone-300 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDelete(tweet.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
