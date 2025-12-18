export function analyzeEmbedUrl(embedUrl: string): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let valid = true;

  if (!embedUrl || typeof embedUrl !== 'string') {
    valid = false;
    issues.push('Embed URL is empty or not a string');
    suggestions.push('Ensure a valid embed URL is generated');
    return { valid, issues, suggestions };
  }

  try {
    const url = new URL(embedUrl);

    if (!url.hostname.includes('figma.com')) {
      valid = false;
      issues.push('URL is not from figma.com');
      suggestions.push('Ensure the URL is from the figma.com domain');
    }

    if (!url.pathname.includes('/embed')) {
      valid = false;
      issues.push('URL is not using the /embed endpoint');
      suggestions.push('Use the /embed endpoint for embedding Figma designs');
    }

    const embedHost = url.searchParams.get('embed-host');
    if (!embedHost) {
      valid = false;
      issues.push('Missing embed-host parameter');
      suggestions.push('Add embed-host parameter with your domain (not localhost)');
    } else if (embedHost.includes('localhost')) {
      issues.push('embed-host contains localhost - might work on development but not in production');
      suggestions.push('Use a valid domain name for embed-host in production');
    }

    const accessToken = url.searchParams.get('access_token');
    if (!accessToken) {
      issues.push('Missing access_token parameter - file might require authentication');
      suggestions.push('Add access_token parameter if the file requires authentication');
    }

    const encodedUrl = url.searchParams.get('url');
    if (!encodedUrl) {
      valid = false;
      issues.push('Missing encoded file URL parameter');
      suggestions.push('Include the encoded Figma file URL');
    } else {
      try {
        const innerUrl = new URL(decodeURIComponent(encodedUrl));

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

export function fixEmbedUrl(embedUrl: string, options?: { domain?: string }): string {
  if (!embedUrl || typeof embedUrl !== 'string') {
    return embedUrl;
  }

  try {
    const url = new URL(embedUrl);

    const embedHost = url.searchParams.get('embed_host');
    if (embedHost && embedHost.includes('localhost')) {
      url.searchParams.set('embed-host', options?.domain || 'superdesign.app');
    }

    if (!embedHost) {
      url.searchParams.set('embed-host', options?.domain || 'superdesign.app');
    }

    return url.toString();

  } catch (e) {
    return embedUrl;
  }
}

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