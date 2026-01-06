import { useState } from 'react';
import { ads } from './data/ads';
import AdCard from './components/AdCard';
import AddAdForm from './components/AddAdForm';

function App() {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
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
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-400">
                {ads.length} {ads.length === 1 ? 'ad' : 'ads'}
              </span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors"
              >
                {showAddForm ? 'Cancel' : '+ Add Ad'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Add Ad Form */}
        {showAddForm && (
          <div className="mb-8">
            <AddAdForm onAdAdded={() => setShowAddForm(false)} />
          </div>
        )}

        <div className="space-y-8">
          {ads.map(ad => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>

        {/* Empty State */}
        {ads.length === 0 && !showAddForm && (
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
