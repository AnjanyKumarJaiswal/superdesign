import { useState, useEffect, useRef } from 'react';
import { Loader2, Figma, AlertTriangle, RefreshCcw } from 'lucide-react';
import { trpc } from '../utils/trpc';
import { EmbedDebugger } from './EmbedDebugger';

const FigmaEmbed = ({ fileId = '' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [key, setKey] = useState(0); // Used for forcing iframe refresh
  const iframeRef = useRef(null);
  
  // Log the file ID for debugging
  console.log('FigmaEmbed received fileId:', typeof fileId, fileId);

  // Validate the file ID early
  const fileIdValid = !!fileId && typeof fileId === 'string' && fileId.trim().length > 0;
  
  // Query to get embed URL
  const embedQuery = trpc.getFigmaEmbed.useQuery(
    { fileId },
    { 
      enabled: fileIdValid,
      retry: 2,
      retryDelay: 1000,
      onError: (err) => {
        console.error('FigmaEmbed error fetching URL:', err);
        setError(err.message || 'Failed to load Figma design');
        setIsLoading(false);
      },
      onSuccess: (data) => {
        console.log('FigmaEmbed got response:', data);
        
        // Handle error responses from the API
        if (data.error) {
          console.error('FigmaEmbed server returned error:', data.error);
          setError(data.error);
          setIsLoading(false);
        } else if (!data.embedUrl) {
          console.error('FigmaEmbed server returned no embed URL');
          setError('Server returned an empty embed URL');
          setIsLoading(false);
        }
      }
    }
  );
  
  // Handle loading state with delay
  useEffect(() => {
    let timer;
    
    if (embedQuery.data?.embedUrl) {
      // Log the embed URL to see what's being passed to the iframe
      console.log('Figma Embed URL:', embedQuery.data.embedUrl);
      
      // Add a minimum loading time for better UX
      timer = setTimeout(() => {
        if (!error) {
          setIsLoading(false);
        }
      }, 3000); // 3 second minimum loading time
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [embedQuery.data, error]);
  
  // Handle iframe load event
  const handleIframeLoad = () => {
    setIsLoading(false);
  };
  
  // Handle iframe error
  const handleIframeError = () => {
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
            Make sure you're using a valid Figma file ID and have proper access permissions.
          </p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              setKey(prevKey => prevKey + 1); // Force iframe refresh
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
  
  // Function to force reload the iframe
  const reloadIframe = () => {
    setIsLoading(true);
    setKey(prevKey => prevKey + 1);
  };

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90">
          <div className="mb-4 relative">
            <Loader2 className="w-16 h-16 text-white animate-spin" />
            <Figma className="w-8 h-8 text-purple-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Loading Figma Design</h3>
          <p className="text-gray-400 text-center max-w-sm">
            Loading your Figma design. This may take a moment depending on the size and complexity.
          </p>
          
          <div className="mt-8 w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{width: '40%'}}></div>
          </div>
        </div>
      )}
      
      {/* Embed debugger tool */}
      {embedQuery.data?.embedUrl && (
        <EmbedDebugger 
          embedUrl={embedQuery.data.embedUrl} 
          onReload={reloadIframe} 
        />
      )}
      
      {/* Figma iframe */}
      {embedQuery.data?.embedUrl && (
        <>
          {console.log('Rendering iframe with URL:', embedQuery.data.embedUrl)}
          <iframe
            key={key} // Use key to force re-render when needed
            ref={iframeRef}
            className="w-full h-full border-0"
            src={embedQuery.data.embedUrl}
            allowFullScreen
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="Figma Design"
          />
        </>
      )}
    </div>
  );
};

export default FigmaEmbed;