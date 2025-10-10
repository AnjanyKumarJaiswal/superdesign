/**
 * Figma Embed URL Helper
 * Utility functions to help troubleshoot and improve Figma embed URLs
 */

/**
 * Analyzes a Figma embed URL and identifies potential problems
 */
export function analyzeEmbedUrl(embedUrl: string): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let valid = true;

  // Check if the URL is a string and not empty
  if (!embedUrl || typeof embedUrl !== 'string') {
    valid = false;
    issues.push('Embed URL is empty or not a string');
    suggestions.push('Ensure a valid embed URL is generated');
    return { valid, issues, suggestions };
  }

  try {
    // Try to parse the URL
    const url = new URL(embedUrl);

    // Check if it's a Figma URL
    if (!url.hostname.includes('figma.com')) {
      valid = false;
      issues.push('URL is not from figma.com');
      suggestions.push('Ensure the URL is from the figma.com domain');
    }

    // Check if it's using the embed endpoint
    if (!url.pathname.includes('/embed')) {
      valid = false;
      issues.push('URL is not using the /embed endpoint');
      suggestions.push('Use the /embed endpoint for embedding Figma designs');
    }

    // Check for embed_host parameter
    const embedHost = url.searchParams.get('embed_host');
    if (!embedHost) {
      valid = false;
      issues.push('Missing embed_host parameter');
      suggestions.push('Add embed_host parameter with your domain (not localhost)');
    } else if (embedHost.includes('localhost')) {
      valid = false;
      issues.push('embed_host contains localhost');
      suggestions.push('Use a valid domain name for embed_host, not localhost');
    }

    // Check for the url parameter
    const encodedUrl = url.searchParams.get('url');
    if (!encodedUrl) {
      valid = false;
      issues.push('Missing encoded file URL parameter');
      suggestions.push('Include the encoded Figma file URL');
    } else {
      try {
        // Try to decode and parse the inner URL
        const innerUrl = new URL(decodeURIComponent(encodedUrl));
        
        // Check if it contains a file path
        if (!innerUrl.pathname.includes('/file/')) {
          valid = false;
          issues.push('Inner URL does not contain a Figma file path');
          suggestions.push('Ensure the inner URL points to a valid Figma file');
        }
      } catch (e) {
        valid = false;
        issues.push('Invalid encoded inner URL');
        suggestions.push('Fix the encoding of the inner Figma file URL');
      }
    }

  } catch (e) {
    valid = false;
    issues.push('Invalid URL format');
    suggestions.push('Ensure the URL follows a valid format');
  }

  return { valid, issues, suggestions };
}

/**
 * Fixes common issues with Figma embed URLs
 */
export function fixEmbedUrl(embedUrl: string, options?: { domain?: string }): string {
  if (!embedUrl || typeof embedUrl !== 'string') {
    return embedUrl;
  }

  try {
    const url = new URL(embedUrl);
    
    // Replace localhost in embed_host
    const embedHost = url.searchParams.get('embed_host');
    if (embedHost && embedHost.includes('localhost')) {
      url.searchParams.set('embed_host', options?.domain || 'superdesign.app');
    }
    
    // If embed_host is missing, add it
    if (!embedHost) {
      url.searchParams.set('embed_host', options?.domain || 'superdesign.app');
    }

    // Return the fixed URL
    return url.toString();
    
  } catch (e) {
    // If there's any error, return the original URL
    return embedUrl;
  }
}

/**
 * Creates a debug info string for troubleshooting embed URLs
 */
export function getEmbedDebugInfo(embedUrl: string): string {
  const analysis = analyzeEmbedUrl(embedUrl);
  let debugInfo = `Embed URL Analysis:\n`;
  
  debugInfo += `URL: ${embedUrl}\n`;
  debugInfo += `Valid: ${analysis.valid}\n\n`;
  
  if (analysis.issues.length > 0) {
    debugInfo += `Issues Found (${analysis.issues.length}):\n`;
    analysis.issues.forEach((issue, i) => {
      debugInfo += `  ${i + 1}. ${issue}\n`;
    });
    debugInfo += '\n';
  }
  
  if (analysis.suggestions.length > 0) {
    debugInfo += `Suggestions (${analysis.suggestions.length}):\n`;
    analysis.suggestions.forEach((suggestion, i) => {
      debugInfo += `  ${i + 1}. ${suggestion}\n`;
    });
  }
  
  return debugInfo;
}