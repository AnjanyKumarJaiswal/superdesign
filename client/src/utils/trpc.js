import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { getAuthToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/trpc';




export const trpc = createTRPCReact();

function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// export function createTRPCClient() {
//   console.log(`Creating tRPC client pointing to: ${API_URL}`);
//   return trpc.createClient({
//     links: [
//       splitLink({
//         condition(op) {
//           return op.type === 'subscription';
//         },
//         true: wsLink({
//           client: wsClient,
//         }),
//         false: httpBatchLink({
//           url: API_URL,
//           headers() {
//             const token = getAuthToken();
//             const requestId = generateRequestId();

//             const headers = {
//               'x-request-id': requestId,
//               'x-client-version': '1.0.0',
//             };

//             if (token) {
//               headers.authorization = `Bearer ${token}`;
//             }

//             return headers;
//           },
//           fetch(url, options) {
//             console.log(`tRPC request to: ${url}`);
//             return fetch(url, {
//               ...options,
//               credentials: 'include',
//             }).then(response => {
//               if (!response.ok) {
//                 console.error(`tRPC request failed: ${response.status} ${response.statusText}`);
//               }
//               return response;
//             }).catch(err => {
//               console.error('tRPC fetch error:', err);
//               throw err;
//             });
//           }
//         }),
//       }),
//     ],
//   });
// }
export function createTRPCClient() {
  console.log(`Creating tRPC client pointing to: ${API_URL}`);

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: API_URL,
        // The headers function runs on every request
        headers() {
          const token = getAuthToken();
          const requestId = generateRequestId();

          const headers = {
            'x-request-id': requestId,
            'x-client-version': '1.0.0',
          };

          if (token) {
            headers.authorization = `Bearer ${token}`;
          }

          return headers;
        },
        // Custom fetch to intercept responses for logging
        async fetch(url, options) {
          try {
            const response = await fetch(url, {
              ...options,
              credentials: 'include',
            });

            if (!response.ok) {
              console.error(
                `tRPC request failed: ${response.status} ${response.statusText}`
              );
            }
            return response;
          } catch (err) {
            console.error('tRPC fetch error:', err);
            throw err;
          }
        },
      }),
    ],
  });
}