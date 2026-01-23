import { useState, useMemo } from 'react';
import { useTweets } from '../hooks/useData';
import TweetCard from './TweetCard';

export default function TweetVault() {
  // Fetch tweets from API
  const { tweets, loading, error, deleteTweet, deleteTweetsBatch, removeTagFromAll, refetch } = useTweets();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTweets, setSelectedTweets] = useState(new Set());
  const [editTagsMode, setEditTagsMode] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set();
    (tweets || []).forEach(tweet => tweet.tags?.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tweets]);

  // Filter tweets based on search and tags
  const filteredTweets = useMemo(() => {
    return (tweets || []).filter(tweet => {
      const matchesSearch = searchQuery === '' ||
        tweet.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tweet.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every(tag => tweet.tags?.includes(tag));

      return matchesSearch && matchesTags;
    });
  }, [tweets, searchQuery, selectedTags]);

  // Toggle tag filter
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Toggle tweet selection
  const toggleSelectTweet = (tweetId) => {
    setSelectedTweets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tweetId)) {
        newSet.delete(tweetId);
      } else {
        newSet.add(tweetId);
      }
      return newSet;
    });
  };

  // Select all visible tweets
  const selectAll = () => {
    setSelectedTweets(new Set(filteredTweets.map(t => t.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTweets(new Set());
  };

  // Exit select mode
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedTweets(new Set());
  };

  // Delete selected tweets
  const handleDeleteSelected = async () => {
    if (selectedTweets.size === 0) return;
    await deleteTweetsBatch(Array.from(selectedTweets));
    setSelectedTweets(new Set());
    setSelectMode(false);
  };

  // Delete single tweet
  const handleDelete = async (tweetId) => {
    await deleteTweet(tweetId);
  };

  // Delete a tag from all tweets
  const handleDeleteTag = async (tag) => {
    await removeTagFromAll(tag);
    setTagToDelete(null);
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  // Show loading state
  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-400 font-serif text-lg animate-pulse">Loading tweets...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-serif text-lg">Error: {error}</p>
        <button onClick={refetch} className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-sm">Retry</button>
      </div>
    );
  }

  return (
    <>
      {/* Search and Filter */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Search tweets or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400"
          />

          {/* Select Mode Toggle */}
          {!selectMode ? (
            <button
              onClick={() => setSelectMode(true)}
              className="px-4 py-2 text-sm text-stone-500 border border-stone-200 rounded-sm hover:border-stone-400 transition-colors"
            >
              Select
            </button>
          ) : (
            <button
              onClick={exitSelectMode}
              className="px-4 py-2 text-sm text-stone-500 border border-stone-200 rounded-sm hover:border-stone-400 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Selection Actions Bar */}
        {selectMode && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-stone-50 border border-stone-200 rounded-sm">
            <span className="text-sm text-stone-600">
              {selectedTweets.size} selected
            </span>
            <button
              onClick={selectAll}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              Select all ({filteredTweets.length})
            </button>
            {selectedTweets.size > 0 && (
              <>
                <button
                  onClick={clearSelection}
                  className="text-sm text-stone-500 hover:text-stone-700"
                >
                  Clear
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="ml-auto px-3 py-1 text-sm text-white bg-red-500 hover:bg-red-600 rounded-sm transition-colors"
                >
                  Delete {selectedTweets.size} tweet{selectedTweets.size !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {allTags.map(tag => (
              <div key={tag} className="relative group flex items-center">
                {tagToDelete === tag ? (
                  <div className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 border border-red-200 rounded-sm">
                    <span className="text-red-600">Delete "{tag}"?</span>
                    <button
                      onClick={() => handleDeleteTag(tag)}
                      className="text-red-500 hover:text-red-700 font-medium"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setTagToDelete(null)}
                      className="text-stone-400 hover:text-stone-600"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 text-xs rounded-sm border transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'text-stone-500 bg-stone-50 border-stone-200 hover:border-stone-400'
                      } ${editTagsMode ? 'pr-6' : ''}`}
                    >
                      {tag}
                    </button>
                    {editTagsMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagToDelete(tag);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-stone-400 hover:text-red-500 transition-colors"
                        title={`Delete tag "${tag}"`}
                      >
                        ×
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
            {selectedTags.length > 0 && !editTagsMode && (
              <button
                onClick={() => setSelectedTags([])}
                className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => setEditTagsMode(!editTagsMode)}
              className={`px-2 py-1 text-xs rounded-sm border transition-colors ${
                editTagsMode
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'text-stone-400 border-stone-200 hover:border-stone-400'
              }`}
            >
              {editTagsMode ? 'Done' : 'Edit Tags'}
            </button>
          </div>
        )}
      </div>

      {/* Tweet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTweets.map(tweet => (
          <TweetCard
            key={tweet.id}
            tweet={tweet}
            onDelete={handleDelete}
            selectMode={selectMode}
            isSelected={selectedTweets.has(tweet.id)}
            onToggleSelect={() => toggleSelectTweet(tweet.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTweets.length === 0 && (
        <div className="text-center py-20">
          <p className="text-stone-400 font-serif text-lg">
            {(tweets || []).length === 0
              ? 'No tweets yet. Add your first one.'
              : 'No tweets match your filters.'
            }
          </p>
        </div>
      )}
    </>
  );
}
