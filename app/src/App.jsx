import { ads } from './data/ads';
import AdCard from './components/AdCard';

function App() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="font-serif text-2xl text-stone-900">
                Ad Vault
              </h1>
              <p className="text-sm text-stone-500 mt-0.5">
                Shortform ads that actually convert
              </p>
            </div>
            <span className="text-sm text-stone-400">
              {ads.length} {ads.length === 1 ? 'ad' : 'ads'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {ads.map(ad => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>

        {/* Empty State */}
        {ads.length === 0 && (
          <div className="text-center py-20">
            <p className="text-stone-400 font-serif text-lg">
              No ads yet. Add your first one.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <p className="text-xs text-stone-400 text-center">
            Personal ad swipe file · Not for distribution
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
