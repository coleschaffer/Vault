export default function ShotBreakdown({ shots, hook, fullTranscript }) {
  return (
    <div className="space-y-6">
      {/* Hook Section */}
      {hook && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
            Hook
          </h3>
          <div className="space-y-2">
            {hook.textOverlay && (
              <p className="text-amber-900 font-medium text-sm">
                "{hook.textOverlay}"
              </p>
            )}
            {hook.spoken && hook.spoken !== hook.textOverlay && (
              <p className="text-amber-800 text-sm italic">
                Spoken: "{hook.spoken}"
              </p>
            )}
          </div>
        </div>
      )}

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
      <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">
        {shots.length} Scenes
      </p>

      {/* Scenes List */}
      <ol className="space-y-4">
        {shots.map((shot, index) => (
          <li
            key={shot.id}
            className="relative pl-8 pb-4 border-b border-stone-100 last:border-0"
          >
            {/* Shot Number */}
            <span className="absolute left-0 top-0 w-5 h-5 bg-stone-900 text-white text-xs font-medium flex items-center justify-center rounded-sm">
              {index + 1}
            </span>

            {/* Content */}
            <div className="space-y-2">
              {/* Timestamp + Type Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-stone-400">
                  {shot.timestamp}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium uppercase ${
                  shot.type === 'image'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {shot.type || 'video'}
                </span>
              </div>

              {/* Description */}
              <p className="text-stone-900 text-sm leading-relaxed">
                {shot.description}
              </p>

              {/* Scene Transcript */}
              {shot.transcript && (
                <div className="bg-stone-50 rounded-sm px-3 py-2">
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
          </li>
        ))}
      </ol>
    </div>
  );
}
