import { useState } from 'react';
import ImageModal from './ImageModal';

export default function ShotBreakdown({ shots, fullTranscript, onSeek }) {
  const [modalImage, setModalImage] = useState(null);

  const openModal = (shot) => {
    setModalImage({
      src: shot.thumbnail,
      alt: `Scene ${shot.id}: ${shot.description}`
    });
  };

  return (
    <div className="space-y-6">
      {/* Full Transcript Section */}
      {fullTranscript && (
        <div className="bg-stone-50 border border-stone-200 rounded-sm p-4">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Full Transcript
          </h3>
          <p className="text-stone-700 text-sm leading-relaxed">
            "{fullTranscript}"
          </p>
        </div>
      )}

      {/* Scene Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">
          {shots.length} Scenes
        </p>
        <p className="text-xs text-stone-400">
          Click thumbnail to enlarge · Click row to play
        </p>
      </div>

      {/* Scenes List */}
      <ol className="space-y-3">
        {shots.map((shot, index) => (
          <li
            key={shot.id}
            className="relative pb-3 border-b border-stone-100 last:border-0"
          >
            <div className="flex gap-3">
              {/* Thumbnail */}
              {shot.thumbnail && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(shot);
                  }}
                  className="flex-shrink-0 cursor-zoom-in group"
                >
                  <div className="relative w-16 h-28 rounded-sm overflow-hidden border border-stone-200 hover:border-stone-400 transition-colors">
                    <img
                      src={shot.thumbnail}
                      alt={`Scene ${shot.id}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {/* Zoom icon overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                      <svg
                        className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Content - Clickable to seek */}
              <div
                onClick={() => onSeek && onSeek(shot.startTime)}
                className="flex-1 cursor-pointer hover:bg-stone-50 -m-2 p-2 rounded transition-colors group"
              >
                {/* Header row: Number + Timestamp + Type */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 bg-stone-900 text-white text-xs font-medium flex items-center justify-center rounded-sm group-hover:bg-stone-700 transition-colors">
                    {index + 1}
                  </span>
                  <span className="text-xs font-mono text-stone-400 group-hover:text-stone-600 transition-colors">
                    {shot.timestamp}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium uppercase ${
                    shot.type === 'image'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {shot.type || 'video'}
                  </span>
                  <span className="text-xs text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    ▶ Play
                  </span>
                </div>

                {/* Description */}
                <p className="text-stone-900 text-sm leading-relaxed mb-1.5">
                  {shot.description}
                </p>

                {/* Text Overlay (if different from transcript) */}
                {shot.textOverlay && (
                  <div className="mb-1.5">
                    <span className="text-xs text-stone-400 uppercase">On Screen: </span>
                    <span className="text-xs text-stone-600 font-medium">
                      {shot.textOverlay}
                    </span>
                  </div>
                )}

                {/* Scene Transcript */}
                {shot.transcript && (
                  <div className="bg-stone-50 rounded-sm px-3 py-2 mb-1.5">
                    <p className="text-stone-600 text-sm italic">
                      "{shot.transcript}"
                    </p>
                  </div>
                )}

                {/* Purpose/Insight */}
                <p className="text-xs text-stone-500 italic">
                  → {shot.purpose}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Image Modal */}
      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}
