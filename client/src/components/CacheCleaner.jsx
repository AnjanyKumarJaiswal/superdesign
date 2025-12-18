import React, { useState, useEffect } from 'react';
import { cleanAllCache, cleanFigmaCredentials, checkCachedCredentials } from '../utils/cacheCleaner';
import { cleanOAuthCache } from '../utils/auth';

export default function CacheCleaner() {
  const [cacheStatus, setCacheStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const status = checkCachedCredentials();
    setCacheStatus(status);
  }, []);

  const handleCleanAllCache = () => {
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const results = cleanAllCache(false);
      cleanOAuthCache();

      if (results.success) {
        setMessage('All application cache and credentials cleared successfully. Click "Reload Page" to apply changes.');
        setCacheStatus(checkCachedCredentials());
      } else {
        setError('Cache cleaning completed with some errors. See console for details.');
      }
    } catch (err) {
      setError(`Error cleaning cache: ${err.message}`);
      console.error('Cache cleaning error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanFigmaCredentials = () => {
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const success1 = cleanFigmaCredentials();
      const success2 = cleanOAuthCache();

      if (success1 && success2) {
        setMessage('OAuth credentials cleared successfully. Click "Reload Page" to apply changes.');
        setCacheStatus(checkCachedCredentials());
      } else {
        setError('Partial cleanup - some credentials may remain. See console for details.');
      }
    } catch (err) {
      setError(`Error cleaning OAuth credentials: ${err.message}`);
      console.error('OAuth credentials cleaning error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="cache-cleaner">
      <div className="cache-cleaner-content">
        <h3 className="title">OAuth Credentials Cleaner</h3>

        {cacheStatus && (
          <div className="status-section">
            <h4>Current Cache Status:</h4>
            <div className="status-items">
              <div className="status-item">
                <span className="label">Figma Token:</span>
                <span className={`value ${cacheStatus.figmaToken ? 'red' : 'green'}`}>
                  {cacheStatus.figmaToken ? 'Present' : 'Not Found'}
                </span>
              </div>

              <div className="status-item">
                <span className="label">Credentials Hash:</span>
                <span className={`value ${cacheStatus.credentialsHash ? 'red' : 'green'}`}>
                  {cacheStatus.credentialsHash ? cacheStatus.credentialsHash : 'Not Found'}
                </span>
              </div>

              <div className="status-item">
                <span className="label">Last Login:</span>
                <span className="value">
                  {cacheStatus.lastLogin ? new Date(parseInt(cacheStatus.lastLogin)).toLocaleString() : 'Never'}
                </span>
              </div>

              {cacheStatus.otherFigmaItems.length > 0 && (
                <div className="status-item">
                  <span className="label">Other Items:</span>
                  <span className="value red">{cacheStatus.otherFigmaItems.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="actions">
          <button
            className="clean-figma-button"
            onClick={handleCleanFigmaCredentials}
            disabled={isLoading}
          >
            {isLoading ? 'Cleaning...' : 'Fix OAuth Errors'}
          </button>

          <button
            className="clean-all-button"
            onClick={handleCleanAllCache}
            disabled={isLoading}
          >
            {isLoading ? 'Cleaning...' : 'Reset All Storage'}
          </button>

          <button
            className="reload-button"
            onClick={handleReload}
          >
            Reload Page
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
      </div>

      <style jsx>{`
        .cache-cleaner {
          background-color: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          color: white;
          backdrop-filter: blur(10px);
          max-width: 500px;
          margin: 20px auto;
        }
        
        .title {
          color: rgba(255, 255, 255, 0.95);
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 18px;
          font-weight: 500;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 8px;
        }
        
        h4 {
          color: rgba(255, 255, 255, 0.8);
          margin-top: 0;
          margin-bottom: 12px;
          font-size: 15px;
          font-weight: 500;
        }
        
        .status-section {
          margin-bottom: 20px;
          background-color: rgba(0, 0, 0, 0.2);
          padding: 12px;
          border-radius: 6px;
        }
        
        .status-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          padding-bottom: 4px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
        }
        
        .label {
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }
        
        .value {
          color: rgba(255, 255, 255, 0.8);
          font-family: monospace;
          word-break: break-all;
          max-width: 60%;
          text-align: right;
        }
        
        .green {
          color: #10b981;
        }
        
        .red {
          color: #f87171;
        }
        
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        button {
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 500;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          flex-grow: 1;
          font-family: 'Geist Mono', monospace;
          min-width: 120px;
          color: white;
        }
        
        button:hover {
          transform: translateY(-1px);
          filter: brightness(110%);
        }
        
        button:active {
          transform: translateY(1px);
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        
        .clean-figma-button {
          background-color: #6366f1;
        }
        
        .clean-all-button {
          background-color: #ef4444;
        }
        
        .reload-button {
          background-color: #22c55e;
        }
        
        .success-message {
          margin-top: 16px;
          padding: 8px 12px;
          background-color: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: rgba(134, 239, 172, 0.9);
          border-radius: 4px;
          font-size: 14px;
        }
        
        .error-message {
          margin-top: 16px;
          padding: 8px 12px;
          background-color: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: rgba(252, 165, 165, 0.9);
          border-radius: 4px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}