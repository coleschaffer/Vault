import { useState, useEffect } from 'react';
import { useAds, useImages, useTweets } from './hooks/useData';
import AdCard from './components/AdCard';
import AddAdForm from './components/AddAdForm';
import AddImageForm from './components/AddImageForm';
import AddTweetForm from './components/AddTweetForm';
import ImageVault from './components/ImageVault';
import TweetVault from './components/TweetVault';

function App() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddImageForm, setShowAddImageForm] = useState(false);
  const [showAddTweetForm, setShowAddTweetForm] = useState(false);

  // Fetch data using hooks
  const { ads, loading: adsLoading, error: adsError, deleteAd, refetch: refetchAds } = useAds();
  const { images, loading: imagesLoading, refetch: refetchImages } = useImages();
  const { tweets, loading: tweetsLoading, refetch: refetchTweets } = useTweets();

  // Initialize from localStorage or default to 'ads'
  const [activeVault, setActiveVault] = useState(() => {
    return localStorage.getItem('activeVault') || 'ads';
  });

  // Save to localStorage when vault changes
  useEffect(() => {
    localStorage.setItem('activeVault', activeVault);
  }, [activeVault]);

  // Reset forms when switching vaults
  const switchVault = (vault) => {
    setActiveVault(vault);
    setShowAddForm(false);
    setShowAddImageForm(false);
    setShowAddTweetForm(false);
  };

  // Get current count
  const getCurrentCount = () => {
    switch (activeVault) {
      case 'ads':
        if (adsLoading) return 'Loading...';
        return `${ads.length} ${ads.length === 1 ? 'ad' : 'ads'}`;
      case 'images':
        if (imagesLoading) return 'Loading...';
        return `${images.length} ${images.length === 1 ? 'image' : 'images'}`;
      case 'tweets':
        if (tweetsLoading) return 'Loading...';
        return `${tweets.length} ${tweets.length === 1 ? 'tweet' : 'tweets'}`;
      default:
        return '';
    }
  };

  // Get current subtitle
  const getSubtitle = () => {
    switch (activeVault) {
      case 'ads':
        return 'Shortform ads that actually convert';
      case 'images':
        return 'AI-generated images with reusable prompts';
      case 'tweets':
        return 'Saved tweets organized by topic';
      default:
        return '';
    }
  };

  // Handle ad deletion
  const handleDeleteAd = async (id) => {
    await deleteAd(id);
  };

  // Handle successful ad addition
  const handleAdAdded = () => {
    setShowAddForm(false);
    refetchAds();
  };

  // Handle successful image addition
  const handleImageAdded = () => {
    setShowAddImageForm(false);
    refetchImages();
  };

  // Handle successful tweet addition
  const handleTweetAdded = () => {
    setShowAddTweetForm(false);
    refetchTweets();
  };

  return (
    <div className="min-h-screen flex flex-col">
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
                <span className="text-stone-300 mx-2">/</span>
                <button
                  onClick={() => switchVault('tweets')}
                  className={`hover:text-stone-600 transition-colors ${
                    activeVault === 'tweets' ? 'underline underline-offset-4' : ''
                  }`}
                >
                  Tweet Vault
                </button>
              </h1>
              <p className="text-sm text-stone-500 mt-0.5">
                {getSubtitle()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-400">
                {getCurrentCount()}
              </span>
              {activeVault === 'ads' && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors"
                >
                  {showAddForm ? 'Cancel' : '+ Add Ad'}
                </button>
              )}
              {activeVault === 'images' && (
                <button
                  onClick={() => setShowAddImageForm(!showAddImageForm)}
                  className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors"
                >
                  {showAddImageForm ? 'Cancel' : '+ Add Image'}
                </button>
              )}
              {activeVault === 'tweets' && (
                <button
                  onClick={() => setShowAddTweetForm(!showAddTweetForm)}
                  className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors"
                >
                  {showAddTweetForm ? 'Cancel' : '+ Add Tweet'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1">
        {activeVault === 'ads' && (
          <>
            {/* Add Ad Form */}
            {showAddForm && (
              <div className="mb-8">
                <AddAdForm onAdAdded={handleAdAdded} />
              </div>
            )}

            {/* Loading State */}
            {adsLoading && (
              <div className="text-center py-20">
                <p className="text-stone-400 font-serif text-lg animate-pulse">
                  Loading ads...
                </p>
              </div>
            )}

            {/* Error State */}
            {adsError && (
              <div className="text-center py-20">
                <p className="text-red-500 font-serif text-lg">
                  Error loading ads: {adsError}
                </p>
                <button
                  onClick={refetchAds}
                  className="mt-4 px-4 py-2 text-sm bg-stone-900 text-white rounded-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Ads List */}
            {!adsLoading && !adsError && (
              <div className="space-y-8">
                {ads.map(ad => (
                  <AdCard key={ad.id} ad={ad} onDelete={handleDeleteAd} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!adsLoading && !adsError && ads.length === 0 && !showAddForm && (
              <div className="text-center py-20">
                <p className="text-stone-400 font-serif text-lg">
                  No ads yet. Add your first one.
                </p>
              </div>
            )}
          </>
        )}

        {activeVault === 'images' && (
          <>
            {/* Add Image Form */}
            {showAddImageForm && (
              <div className="mb-8">
                <AddImageForm onImageAdded={handleImageAdded} />
              </div>
            )}

            <ImageVault />
          </>
        )}

        {activeVault === 'tweets' && (
          <>
            {/* Add Tweet Form */}
            {showAddTweetForm && (
              <div className="mb-8">
                <AddTweetForm onTweetAdded={handleTweetAdded} />
              </div>
            )}

            <TweetVault />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white">
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
