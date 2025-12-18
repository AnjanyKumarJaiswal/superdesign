import { useState, useEffect, useRef } from 'react';
import { Loader2, Figma, AlertTriangle, RefreshCcw } from 'lucide-react';
import { trpc } from '../utils/trpc';
import { EmbedDebugger } from './EmbedDebugger';

const FigmaEmbed = ({ fileId = '' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [key, setKey] = useState(0);
  const iframeRef = useRef(null);

  console.log('FigmaEmbed received fileId:', fileId);

  const fileIdValid = !!fileId && typeof fileId === 'string' && fileId.trim().length > 0;

  const embedQuery = trpc.getFigmaEmbed.useQuery(
    { fileId },
    {
      enabled: fileIdValid,
      retry: 2,
      retryDelay: 1000,
      onError: (err) => {
        console.error('FigmaEmbed error:', err);
        setError(err.message || 'Failed to load Figma design');
        setIsLoading(false);
      },
      onSuccess: (data) => {
        console.log('FigmaEmbed response:', data);

        if (data.error) {
          console.error('Server error:', data.error);
          setError(data.error);
          setIsLoading(false);
        } else if (!data.embedUrl) {
          console.error('No embed URL returned');
          setError('Server returned an empty embed URL');
          setIsLoading(false);
        }
      }
    }
  );

  console.log('Figma Embed URL:', embedQuery.data);

  useEffect(() => {
    let timer;

    if (embedQuery.data?.embedUrl) {
      console.log('Figma Embed URL:', embedQuery.data.embedUrl);

      timer = setTimeout(() => {
        if (!error) {
          setIsLoading(false);
        }
      }, 1500);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [embedQuery.data, error]);

  const handleIframeLoad = () => {
    console.log('Iframe loaded successfully');
    setIsLoading(false);
  };

  const handleIframeError = () => {
    console.error('Iframe failed to load');
    setError('Failed to load Figma design');
    setIsLoading(false);
  };

  if (!fileId) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900/50 to-black/50">
        <div className="text-center p-8">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Figma File ID</h2>
          <p className="text-gray-400 mb-4">
            Please provide a Figma file ID to display the design here.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900/50 to-black/50">
        <div className="text-center p-8">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Error Loading Design</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-6">
            Make sure the Figma file is accessible and you're logged into Figma.
          </p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              setKey(prevKey => prevKey + 1);
              embedQuery.refetch();
            }}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 rounded-lg text-white text-sm transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const reloadIframe = () => {
    setIsLoading(true);
    setKey(prevKey => prevKey + 1);
  };

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90">
          <div className="mb-4 relative">
            <Loader2 className="w-16 h-16 text-white animate-spin" />
            <Figma className="w-8 h-8 text-purple-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Loading Figma Design</h3>
          <p className="text-gray-400 text-center max-w-sm">
            Loading your Figma design...
          </p>

          <div className="mt-8 w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '40%' }}></div>
          </div>
        </div>
      )}

      {embedQuery.data?.embedUrl && (
        <EmbedDebugger
          embedUrl={embedQuery.data.embedUrl}
          onReload={reloadIframe}
        />
      )}

      {embedQuery.data?.embedUrl && (
        <iframe
          key={key}
          ref={iframeRef}
          className="w-full h-full border-0"
          src={embedQuery.data?.embedUrl}
          allowFullScreen
          allow="clipboard-write"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="Figma Design"
        />
      )}
    </div>
  );
};

export default FigmaEmbed;