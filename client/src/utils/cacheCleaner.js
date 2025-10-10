/**
 * Cache Cleaner Utility
 * Provides functions to completely clean all application cache and storage
 */

/**
 * Clean all application storage including localStorage, sessionStorage and memory cache
 * @param {boolean} reloadAfter - Whether to reload the page after cleaning
 * @returns {Object} - Results of the cleaning operation
 */
export function cleanAllCache(reloadAfter = true) {
  const results = {
    localStorage: false,
    sessionStorage: false,
    cookies: false,
    success: false
  };
  
  try {
    // 1. Clean localStorage
    const localStorageKeys = Object.keys(localStorage);
    for (const key of localStorageKeys) {
      // Only remove SuperDesign related keys
      if (key.toLowerCase().includes('superdesign') || 
          key.includes('figma') || 
          key.includes('framer') ||
          key.includes('token') || 
          key.includes('auth') ||
          key.includes('credentials')) {
        localStorage.removeItem(key);
      }
    }
    results.localStorage = true;
    
    // 2. Clean sessionStorage 
    const sessionStorageKeys = Object.keys(sessionStorage);
    for (const key of sessionStorageKeys) {
      // Only remove SuperDesign related keys
      if (key.toLowerCase().includes('superdesign') || 
          key.includes('figma') || 
          key.includes('framer') ||
          key.includes('token') || 
          key.includes('auth') ||
          key.includes('credentials')) {
        sessionStorage.removeItem(key);
      }
    }
    results.sessionStorage = true;
    
    // 3. Clean cookies related to auth
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name] = cookie.trim().split('=');
      if (name.toLowerCase().includes('superdesign') || 
          name.includes('figma') || 
          name.includes('framer') ||
          name.includes('token') || 
          name.includes('auth')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      }
    }
    results.cookies = true;
    
    // Mark overall operation as successful
    results.success = true;
    
    console.log('Cache cleaning completed successfully', results);
    
    // Reload page if requested
    if (reloadAfter) {
      console.log('Reloading page to apply changes...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    
    return results;
  } catch (error) {
    console.error('Error cleaning cache:', error);
    return {
      ...results,
      error: error.message,
      success: false
    };
  }
}

/**
 * Force clean specific Figma OAuth credentials
 * This is specifically targeted at the credentials hash that's causing authentication issues
 * @returns {boolean} - Whether the cleaning was successful
 */
export function cleanFigmaCredentials() {
  try {
    // Remove all Figma related storage
    localStorage.removeItem('superdesign_credentials_hash');
    localStorage.removeItem('superdesign_figma_token');
    localStorage.removeItem('superdesign_figma_timestamp');
    localStorage.removeItem('superdesign_last_login');
    
    // Remove any other potential Figma auth related items
    const localStorageKeys = Object.keys(localStorage);
    for (const key of localStorageKeys) {
      if (key.includes('figma') || key.includes('oauth')) {
        localStorage.removeItem(key);
      }
    }
    
    console.log('Figma credentials cleaned successfully');
    return true;
  } catch (error) {
    console.error('Error cleaning Figma credentials:', error);
    return false;
  }
}

/**
 * Check if there are any cached credentials that might be causing issues
 * @returns {Object} - Information about cached credentials
 */
export function checkCachedCredentials() {
  const cachedItems = {
    figmaToken: localStorage.getItem('superdesign_figma_token') !== null,
    figmaTimestamp: localStorage.getItem('superdesign_figma_timestamp') !== null,
    credentialsHash: localStorage.getItem('superdesign_credentials_hash'),
    lastLogin: localStorage.getItem('superdesign_last_login'),
    otherFigmaItems: []
  };
  
  // Check for other Figma related items
  const localStorageKeys = Object.keys(localStorage);
  for (const key of localStorageKeys) {
    if ((key.includes('figma') || key.includes('oauth')) && 
        !['superdesign_figma_token', 'superdesign_figma_timestamp', 
          'superdesign_credentials_hash', 'superdesign_last_login'].includes(key)) {
      cachedItems.otherFigmaItems.push(key);
    }
  }
  
  return cachedItems;
}