import { useState } from 'react';
import { ads } from './data/ads';
import { images } from './data/images';
import AdCard from './components/AdCard';
import AddAdForm from './components/AddAdForm';
import AddImageForm from './components/AddImageForm';
import ImageVault from './components/ImageVault';

function App() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddImageForm, setShowAddImageForm] = useState(false);
  const [activeVault, setActiveVault] = useState('ads'); // 'ads' or 'images'

  // Reset forms when switching vaults
  const switchVault = (vault) => {
    setActiveVault(vault);
    setShowAddForm(false);
    setShowAddImageForm(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="font-serif text-2xl text-stone-900">
                <button
                  onClick={() => switchVault('ads')}
                  className={`hover:text-stone-600 transition-colors ${
                    activeVault === 'ads' ? 'underline underline-offset-4' : ''
                  }`}
                >
                  Ad Vault
                </button>
                <span className="text-stone-300 mx-2">/</span>
                <button
                  onClick={() => switchVault('images')}
                  className={`hover:text-stone-600 transition-colors ${
                    activeVault === 'images' ? 'underline underline-offset-4' : ''
                  }`}
                >
                  Image Vault
                </button>
              </h1>
              <p className="text-sm text-stone-500 mt-0.5">
                {activeVault === 'ads'
                  ? 'Shortform ads that actually convert'
                  : 'AI-generated images with reusable prompts'
                }
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-400">
                {activeVault === 'ads'
                  ? `${ads.length} ${ads.length === 1 ? 'ad' : 'ads'}`
                  : `${images.length} ${images.length === 1 ? 'image' : 'images'}`
                }
              </span>
              {activeVault === 'ads' ? (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors"
                >
                  {showAddForm ? 'Cancel' : '+ Add Ad'}
                </button>
              ) : (
                <button
                  onClick={() => setShowAddImageForm(!showAddImageForm)}
                  className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors"
                >
                  {showAddImageForm ? 'Cancel' : '+ Add Image'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeVault === 'ads' ? (
          <>
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
          </>
        ) : (
          <>
            {/* Add Image Form */}
            {showAddImageForm && (
              <div className="mb-8">
                <AddImageForm onImageAdded={() => setShowAddImageForm(false)} />
              </div>
            )}

            <ImageVault />
          </>
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
