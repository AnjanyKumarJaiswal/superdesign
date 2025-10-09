import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';

// Create the tRPC React hooks
export const trpc = createTRPCReact();

// Get auth token from localStorage
function getAuthToken() {
  return localStorage.getItem('auth_token');
}

// Create tRPC client with auth headers
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:4000/api/trpc',
        headers() {
          const token = getAuthToken();
          return token
            ? {
                authorization: `Bearer ${token}`,
              }
            : {};
        },
      }),
    ],
  });
}
