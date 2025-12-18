import { useState } from 'react';
import { Bug, Copy, Check, RefreshCw } from 'lucide-react';

function analyzeEmbedUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const issues = [];

    if (parsedUrl.hostname !== 'embed.figma.com') {
      if (parsedUrl.hostname === 'www.figma.com') {
        issues.push('❌ Wrong domain: www.figma.com (should be embed.figma.com)');
      } else {
        issues.push(`❌ Unknown hostname: ${parsedUrl.hostname}`);
      }
    } else {
      issues.push('✅ Correct domain: embed.figma.com');
    }

    if (parsedUrl.pathname.includes('/design/')) {
      issues.push('✅ Using /design/ path format');
    } else if (parsedUrl.pathname.includes('/proto/')) {
      issues.push('✅ Using /proto/ path format');
    } else {
      issues.push('❌ Invalid path format (should be /design/ or /proto/)');
    }

    const embedHost = parsedUrl.searchParams.get('embed-host');
    if (embedHost) {
      issues.push(`✅ embed-host: ${embedHost}`);
      if (embedHost.includes('localhost')) {
        issues.push('ℹ️ Using localhost (OK for development)');
      }
    } else {
      issues.push('❌ Missing embed-host parameter');
    }

    const nodeId = parsedUrl.searchParams.get('node-id');
    if (nodeId) {
      issues.push(`ℹ️ node-id: ${nodeId}`);
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
      issues: ['❌ Invalid URL format']
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

  const getIssueClass = (issue) => {
    if (issue.startsWith('✅')) return 'text-green-400';
    if (issue.startsWith('ℹ️')) return 'text-blue-400';
    if (issue.startsWith('⚠️')) return 'text-yellow-400';
    if (issue.startsWith('❌')) return 'text-red-400';
    return 'text-gray-300';
  };

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
            <span>Figma Embed Debugger</span>
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
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-20">Protocol:</span>
                  <span className={analysis.protocol === 'https:' ? 'text-green-400' : 'text-red-400'}>
                    {analysis.protocol}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-20">Hostname:</span>
                  <span className={analysis.hostname === 'embed.figma.com' ? 'text-green-400' : 'text-yellow-300'}>
                    {analysis.hostname}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-20">Path:</span>
                  <span className={analysis.pathname.includes('/design/') || analysis.pathname.includes('/proto/') ? 'text-green-400' : 'text-yellow-300'}>
                    {analysis.pathname}
                  </span>
                </div>

                {analysis.params && Object.keys(analysis.params).length > 0 && (
                  <div>
                    <span className="text-gray-400 block mb-1">Parameters:</span>
                    <div className="pl-2 border-l border-gray-700 space-y-1">
                      {Object.entries(analysis.params).map(([key, value]) => (
                        <div key={key} className="flex items-start">
                          <span className="text-blue-400 min-w-24">{key}:</span>
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
              <div className="pl-2 border-l border-gray-700 space-y-1">
                {analysis.issues.map((issue, i) => (
                  <div key={i} className={getIssueClass(issue)}>
                    {issue}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-gray-700">
              <span className="text-gray-400 block mb-1">Common Solutions:</span>
              <div className="pl-2 border-l border-gray-700 text-xs space-y-1">
                <div className="text-gray-300">
                  • Make sure you're logged into Figma in your browser
                </div>
                <div className="text-gray-300">
                  • Verify embed-host matches your Figma app's allowed origins
                </div>
                <div className="text-gray-300">
                  • Check that the file is accessible (not private/deleted)
                </div>
                <div className="text-gray-300">
                  • Try refreshing the iframe with the button above
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}