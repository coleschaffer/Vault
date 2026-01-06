import { useState, useEffect, useMemo } from 'react';
import { images } from '../data/images';
import ImageCard from './ImageCard';

const GEMINI_API_KEY = 'AIzaSyAWrHVBXb0xIz1wfZv3T9q3Izh9UOkUpZg';

export default function ImageVault() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Change prompt state
  const [changeRequest, setChangeRequest] = useState('');
  const [modifiedPrompt, setModifiedPrompt] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modifiedCopySuccess, setModifiedCopySuccess] = useState(false);

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

  // Copy JSON to clipboard
  const copyToClipboard = async (text, setSuccess) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Generate modified prompt using Gemini
  const generateModifiedPrompt = async () => {
    if (!changeRequest.trim() || !selectedImage) return;

    setIsGenerating(true);
    setModifiedPrompt(null);

    const originalPrompt = JSON.stringify(selectedImage.prompt, null, 2);

    const systemPrompt = `You are an expert at modifying JSON prompts for AI image generation.
You will be given an original JSON prompt and a user request for changes.
Your job is to modify the JSON prompt according to the user's request while preserving the overall structure and detail level.
IMPORTANT: Output ONLY the modified JSON, no explanations or markdown. The output must be valid JSON.`;

    const userMessage = `Original JSON prompt:
${originalPrompt}

User's requested changes:
${changeRequest}

Please modify the JSON prompt according to these changes. Output only the modified JSON, nothing else.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemPrompt + '\n\n' + userMessage }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            }
          })
        }
      );

      const data = await response.json();

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let jsonText = data.candidates[0].content.parts[0].text;

        // Clean up any markdown code blocks
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse and re-stringify to validate JSON
        const parsed = JSON.parse(jsonText);
        setModifiedPrompt(JSON.stringify(parsed, null, 2));
      } else {
        console.error('Unexpected API response:', data);
        setModifiedPrompt('Error: Failed to generate modified prompt');
      }
    } catch (err) {
      console.error('Error generating prompt:', err);
      setModifiedPrompt(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset modified prompt when modal closes or image changes
  useEffect(() => {
    setModifiedPrompt(null);
    setChangeRequest('');
    setPromptExpanded(false);
  }, [selectedImage]);

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
          <div className="bg-white rounded-sm max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
            {/* Image Side */}
            <div className="md:w-2/5 bg-stone-100 flex items-center justify-center p-4 flex-shrink-0">
              <img
                src={selectedImage.imageSrc}
                alt={selectedImage.title}
                className="max-w-full max-h-[50vh] md:max-h-[80vh] object-contain rounded-sm"
              />
            </div>

            {/* Info Side */}
            <div className="md:w-3/5 p-6 overflow-y-auto max-h-[40vh] md:max-h-[90vh]">
              <h2 className="font-serif text-xl text-stone-900 mb-2">
                {selectedImage.title}
              </h2>
              <p className="text-sm text-stone-500 mb-4">
                by {selectedImage.creator}
              </p>

              {/* Tags */}
              <div className="mb-4">
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
              <div className="mb-4">
                <a
                  href={selectedImage.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Source ↗
                </a>
              </div>

              {/* JSON Prompt Section */}
              <div className="border-t border-stone-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setPromptExpanded(!promptExpanded)}
                    className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wide hover:text-stone-600"
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

                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedImage.prompt, null, 2), setCopySuccess)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                      copySuccess
                        ? 'bg-green-100 text-green-700'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {copySuccess ? '✓ Copied!' : 'Copy JSON'}
                  </button>
                </div>

                {promptExpanded && (
                  <div className="bg-stone-900 rounded-sm p-4 overflow-x-auto mb-4 max-h-60 overflow-y-auto">
                    <pre className="text-xs text-stone-100 whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedImage.prompt, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Change Prompt Section */}
                <div className="border-t border-stone-200 pt-4 mt-4">
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">
                    Modify Prompt
                  </h3>

                  <div className="space-y-3">
                    <textarea
                      value={changeRequest}
                      onChange={(e) => setChangeRequest(e.target.value)}
                      placeholder="Describe what you want to change... (e.g., 'Make her a brunette with green eyes, change the dress to red, change the setting to a beach at sunset')"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-sm focus:outline-none focus:border-stone-400 resize-none"
                      rows={3}
                    />

                    <button
                      onClick={generateModifiedPrompt}
                      disabled={isGenerating || !changeRequest.trim()}
                      className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? 'Generating...' : 'Generate Modified Prompt'}
                    </button>
                  </div>

                  {/* Modified Prompt Output */}
                  {modifiedPrompt && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                          Modified Prompt
                        </h4>
                        <button
                          onClick={() => copyToClipboard(modifiedPrompt, setModifiedCopySuccess)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                            modifiedCopySuccess
                              ? 'bg-green-100 text-green-700'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {modifiedCopySuccess ? '✓ Copied!' : 'Copy Modified JSON'}
                        </button>
                      </div>
                      <div className="bg-stone-900 rounded-sm p-4 overflow-x-auto max-h-60 overflow-y-auto">
                        <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono">
                          {modifiedPrompt}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
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
