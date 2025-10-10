import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { getAuthToken } from './auth';

// API URL - should ideally be in an environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/trpc';

// Create the tRPC React hooks
export const trpc = createTRPCReact();

// Generate a request ID for tracing requests
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// Create tRPC client with auth headers and error handling
export function createTRPCClient() {
  console.log(`Creating tRPC client pointing to: ${API_URL}`);
  
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: API_URL,
        headers() {
          const token = getAuthToken();
          const requestId = generateRequestId();
          
          // Include auth token and request ID for tracing
          const headers = {
            'x-request-id': requestId,
            'x-client-version': '1.0.0',
          };
          
          if (token) {
            headers.authorization = `Bearer ${token}`;
          }
          
          return headers;
        },
        fetch(url, options) {
          console.log(`tRPC request to: ${url}`);
          return fetch(url, {
            ...options,
            credentials: 'include', // Include cookies if needed
          }).then(response => {
            if (!response.ok) {
              console.error(`tRPC request failed: ${response.status} ${response.statusText}`);
            }
            return response;
          }).catch(err => {
            console.error('tRPC fetch error:', err);
            throw err;
          });
        }
      }),
    ],
  });
}
