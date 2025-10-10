/**
 * EmbedDebugger Component
 * 
 * A utility component for debugging iframe embed issues,
 * particularly for Figma embeds
 */

import { useState } from 'react';
import { Bug, Copy, Check, RefreshCw } from 'lucide-react';

// Helper function to parse and analyze a URL
function analyzeEmbedUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const issues = [];
    
    // Check for embed_host parameter
    const embedHost = parsedUrl.searchParams.get('embed_host');
    if (!embedHost) {
      issues.push('Missing embed_host parameter');
    } else if (embedHost.includes('localhost')) {
      issues.push('embed_host contains localhost which may cause issues');
    }
    
    // Check for the url parameter in embed URLs
    if (parsedUrl.pathname.includes('/embed')) {
      const encodedUrl = parsedUrl.searchParams.get('url');
      if (!encodedUrl) {
        issues.push('Missing encoded file URL parameter');
      } else {
        try {
          const decodedUrl = decodeURIComponent(encodedUrl);
          issues.push(`Embedded URL: ${decodedUrl}`);
        } catch (error) {
          issues.push('Invalid URL encoding: ' + error.message);
        }
      }
    }
    
    return {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      params: Object.fromEntries(parsedUrl.searchParams.entries()),
      issues,
    };
  } catch (e) {
    return {
      error: e.message,
      issues: ['Invalid URL format']
    };
  }
}

export function EmbedDebugger({ embedUrl, onReload }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const toggleDebugger = () => setIsOpen(!isOpen);
  
  const copyUrl = () => {
    navigator.clipboard.writeText(embedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const analysis = embedUrl ? analyzeEmbedUrl(embedUrl) : { issues: ['No URL provided'] };
  
  return (
    <div className="absolute bottom-4 right-4 z-20">
      <button
        onClick={toggleDebugger}
        className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-full text-gray-300 hover:text-white shadow-lg"
        title="Debug embed URL"
      >
        <Bug className="w-5 h-5" />
      </button>
      
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-96 max-h-96 overflow-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 text-sm">
          <h3 className="text-white font-bold flex items-center justify-between mb-2">
            <span>Embed URL Debugger</span>
            <div className="flex gap-2">
              <button
                onClick={onReload}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                title="Reload iframe"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={copyUrl}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                title="Copy URL"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </h3>
          
          <div className="text-xs font-mono mb-3 p-2 bg-black/30 rounded border border-gray-800 break-all">
            {embedUrl || 'No URL'}
          </div>
          
          <div className="space-y-2">
            {analysis.error && (
              <div className="text-red-400">Error: {analysis.error}</div>
            )}
            
            {!analysis.error && (
              <>
                <div>
                  <span className="text-gray-400">Protocol:</span> 
                  <span className="text-white ml-2">{analysis.protocol}</span>
                </div>
                <div>
                  <span className="text-gray-400">Hostname:</span>
                  <span className="text-white ml-2">{analysis.hostname}</span>
                </div>
                <div>
                  <span className="text-gray-400">Path:</span>
                  <span className="text-white ml-2">{analysis.pathname}</span>
                </div>
                
                {analysis.params && Object.keys(analysis.params).length > 0 && (
                  <div>
                    <span className="text-gray-400 block mb-1">Parameters:</span>
                    <div className="pl-2 border-l border-gray-700 space-y-1">
                      {Object.entries(analysis.params).map(([key, value]) => (
                        <div key={key} className="flex items-start">
                          <span className="text-blue-400 min-w-20">{key}:</span>
                          <span className="text-green-400 break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            <div>
              <span className="text-gray-400 block mb-1">Analysis:</span>
              <div className="pl-2 border-l border-gray-700">
                {analysis.issues.map((issue, i) => (
                  <div key={i} className={issue.includes('Embedded URL') ? 'text-yellow-300 break-all' : 'text-red-400'}>
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}