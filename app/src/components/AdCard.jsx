import { useState } from 'react';
import ShotBreakdown from './ShotBreakdown';

export default function AdCard({ ad }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [activeSection, setActiveSection] = useState('why');

  return (
    <>
      <article className="bg-white border border-stone-200 rounded-sm overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-stone-100">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif text-xl text-stone-900 leading-tight">
              {ad.title}
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              by {ad.creator} · {ad.product}
            </p>
          </div>
          <a
            href={ad.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Source ↗
          </a>
        </div>
      </header>

      {/* Video + Analysis Grid */}
      <div className="grid md:grid-cols-2 gap-0 md:h-[900px]">
        {/* Video */}
        <div className="bg-black aspect-[9/16] md:aspect-auto flex items-center justify-center">
          <video
            src={ad.videoSrc}
            controls
            className="w-full h-full object-contain"
            playsInline
          />
        </div>

        {/* Analysis Panel */}
        <div className="border-l border-stone-100 flex flex-col min-h-0">
          {/* Tab Navigation */}
          <nav className="flex border-b border-stone-100 flex-shrink-0">
            <button
              onClick={() => setActiveSection('why')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeSection === 'why'
                  ? 'text-stone-900 border-b-2 border-stone-900'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Why It Worked
            </button>
            <button
              onClick={() => setActiveSection('shots')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeSection === 'shots'
                  ? 'text-stone-900 border-b-2 border-stone-900'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Shot Breakdown
            </button>
          </nav>

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            {activeSection === 'why' ? (
              <WhyItWorked data={ad.whyItWorked} />
            ) : (
              <ShotBreakdown
                shots={ad.shots}
                hook={ad.hook}
                fullTranscript={ad.fullTranscript}
              />
            )}
          </div>
        </div>
      </div>

    </article>

      {/* Tags */}
      <div className="bg-white border border-stone-200 rounded-sm px-6 py-4 mt-4">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">
          Tags
        </h3>
        <div className="flex flex-wrap gap-2">
          {ad.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-1 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function WhyItWorked({ data }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <p className="text-stone-700 leading-relaxed font-serif">
          {data.summary}
        </p>
      </div>

      {/* Tactics */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
          Tactics Used
        </h3>
        {data.tactics.map((tactic, i) => (
          <div key={i} className="border-l-2 border-stone-200 pl-4">
            <h4 className="font-medium text-stone-900 text-sm">
              {tactic.name}
            </h4>
            <p className="text-stone-600 text-sm mt-1">
              {tactic.description}
            </p>
          </div>
        ))}
      </div>

      {/* Key Lesson */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-sm">
        <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
          Key Takeaway
        </h3>
        <p className="text-amber-900 font-serif italic">
          "{data.keyLesson}"
        </p>
      </div>
    </div>
  );
}
