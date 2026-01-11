import { useState, useMemo } from 'react';
import { tweets } from '../data/tweets';
import TweetCard from './TweetCard';

const API_BASE = 'http://localhost:3001';

export default function TweetVault() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set();
    tweets.forEach(tweet => tweet.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, []);

  // Filter tweets based on search and tags
  const filteredTweets = useMemo(() => {
    return tweets.filter(tweet => {
      const matchesSearch = searchQuery === '' ||
        tweet.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tweet.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every(tag => tweet.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  }, [searchQuery, selectedTags]);

  // Toggle tag filter
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Delete tweet
  const handleDelete = async (tweetId) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/api/delete-tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tweetId })
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        console.error('Delete failed:', data.error);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

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
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 text-xs rounded-sm border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'text-stone-500 bg-stone-50 border-stone-200 hover:border-stone-400'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600"
              >
                Clear filters
              </button>
            )}
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
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTweets.length === 0 && (
        <div className="text-center py-20">
          <p className="text-stone-400 font-serif text-lg">
            {tweets.length === 0
              ? 'No tweets yet. Add your first one.'
              : 'No tweets match your filters.'
            }
          </p>
        </div>
      )}
    </>
  );
}
