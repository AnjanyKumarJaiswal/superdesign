import React, { useState } from 'react';
import { useTokenExpiration } from '../utils/tokenManager';

/**
 * TokenExpirationAlert - Shows warnings when tokens are about to expire
 * and handles re-authentication flow
 */
export default function TokenExpirationAlert({ platform = 'figma' }) {
  const [expiryStatus, setExpiryStatus] = useState({
    isExpiring: false,
    remainingTime: null,
    isExpired: false
  });

  // Handle token expiration
  const handleExpiration = (expiredPlatform) => {
    if (expiredPlatform === platform) {
      setExpiryStatus({
        isExpiring: false,
        remainingTime: 0,
        isExpired: true
      });

      // Show expired message for 3 seconds before redirecting
      setTimeout(() => {
        // Redirect to login
        window.location.href = `/auth/${platform}?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 3000);
    }
  };

  // Handle token expiring soon warning
  const handleExpiringSoon = (expiringPlatform, remainingSeconds) => {
    if (expiringPlatform === platform) {
      setExpiryStatus({
        isExpiring: true,
        remainingTime: remainingSeconds,
        isExpired: false
      });
    }
  };

  // Register for token expiration events
  useTokenExpiration(handleExpiration, handleExpiringSoon);

  // Format remaining time for display
  const formatRemainingTime = (seconds) => {
    if (!seconds && seconds !== 0) return '';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    } else {
      return `${minutes}m ${remainingSeconds}s`;
    }
  };

  // Don't render anything if no expiration warnings
  if (!expiryStatus.isExpiring && !expiryStatus.isExpired) {
    return null;
  }

  return (
    <div className={`token-expiration-alert ${expiryStatus.isExpired ? 'expired' : 'expiring'}`}>
      {expiryStatus.isExpired ? (
        <div className="alert-content">
          <span className="alert-icon">⚠️</span>
          <span className="alert-message">
            Your {platform} session has expired. Redirecting to login...
          </span>
        </div>
      ) : (
        <div className="alert-content">
          <span className="alert-icon">⏱️</span>
          <span className="alert-message">
            Your {platform} session expires in {formatRemainingTime(expiryStatus.remainingTime)}
          </span>
          <button 
            className="refresh-button"
            onClick={() => window.location.href = `/auth/${platform}?redirect=${encodeURIComponent(window.location.pathname)}`}
          >
            Refresh Now
          </button>
        </div>
      )}

      <style jsx>{`
        .token-expiration-alert {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          z-index: 1000;
          display: flex;
          align-items: center;
          animation: slideIn 0.3s ease-out;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .expired {
          background-color: #fee2e2;
          border: 1px solid #ef4444;
          color: #b91c1c;
        }

        .expiring {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          color: #b45309;
        }

        .alert-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .alert-icon {
          font-size: 18px;
        }

        .alert-message {
          font-size: 14px;
          font-weight: 500;
        }

        .refresh-button {
          margin-left: 16px;
          background-color: #0284c7;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .refresh-button:hover {
          background-color: #0369a1;
        }

        @keyframes slideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}