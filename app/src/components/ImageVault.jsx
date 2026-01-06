import { useState, useEffect, useMemo } from 'react';
import { images } from '../data/images';
import ImageCard from './ImageCard';

export default function ImageVault() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [promptExpanded, setPromptExpanded] = useState(false);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set();
    images.forEach(img => img.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, []);

  // Filter images based on search and tags
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      const matchesSearch = searchQuery === '' ||
        img.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every(tag => img.tags.includes(tag));

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

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedImage) {
        setSelectedImage(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedImage]);

  return (
    <>
      {/* Search and Filter */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Search images or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400"
          />
        </div>

        {/* Tag Filters */}
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
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredImages.map(image => (
          <ImageCard
            key={image.id}
            image={image}
            onClick={() => setSelectedImage(image)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredImages.length === 0 && (
        <div className="text-center py-20">
          <p className="text-stone-400 font-serif text-lg">
            No images match your filters.
          </p>
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedImage(null);
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Modal Content */}
          <div className="bg-white rounded-sm max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
            {/* Image Side */}
            <div className="md:w-1/2 bg-stone-100 flex items-center justify-center p-4">
              <img
                src={selectedImage.imageSrc}
                alt={selectedImage.title}
                className="max-w-full max-h-[60vh] md:max-h-[80vh] object-contain rounded-sm"
              />
            </div>

            {/* Info Side */}
            <div className="md:w-1/2 p-6 overflow-y-auto max-h-[40vh] md:max-h-[90vh]">
              <h2 className="font-serif text-xl text-stone-900 mb-2">
                {selectedImage.title}
              </h2>
              <p className="text-sm text-stone-500 mb-4">
                by {selectedImage.creator}
              </p>

              {/* Tags */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedImage.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Source Link */}
              <div className="mb-6">
                <a
                  href={selectedImage.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-stone-600 hover:text-stone-900 underline"
                >
                  View original source
                </a>
              </div>

              {/* JSON Prompt */}
              <div>
                <button
                  onClick={() => setPromptExpanded(!promptExpanded)}
                  className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 hover:text-stone-600"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${promptExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  JSON Prompt
                </button>

                {promptExpanded && (
                  <div className="bg-stone-900 rounded-sm p-4 overflow-x-auto">
                    <pre className="text-xs text-stone-100 whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedImage.prompt, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
            Press ESC or click outside to close
          </p>
        </div>
      )}
    </>
  );
}
