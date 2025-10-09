# OAuth Authentication Setup Guide

This guide explains how to set up OAuth authentication with Figma (and optionally Framer) for SuperDesign.

## Overview

SuperDesign uses OAuth 2.0 to authenticate users with design platforms like Figma and Framer. The authentication flow:

1. User clicks "Login with Figma" button
2. User is redirected to Figma's OAuth consent page
3. User authorizes SuperDesign
4. Figma redirects back with an authorization code
5. Backend exchanges code for access token
6. Backend generates a JWT containing the access token
7. Frontend stores JWT and uses it for authenticated requests

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │         │   Backend    │         │   Figma     │
│   (React)   │         │   (Express)  │         │   OAuth     │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                        │
      │  1. Click Login        │                        │
      ├───────────────────────>│                        │
      │                        │  2. Redirect to OAuth  │
      │<───────────────────────┼───────────────────────>│
      │                        │                        │
      │  3. User Authorizes    │                        │
      │<───────────────────────────────────────────────>│
      │                        │                        │
      │  4. Callback with code │                        │
      ├───────────────────────>│  5. Exchange for token │
      │                        ├───────────────────────>│
      │                        │  6. Access token       │
      │                        │<───────────────────────┤
      │  7. JWT token          │                        │
      │<───────────────────────┤                        │
      │                        │                        │
      │  8. API calls with JWT │                        │
      ├───────────────────────>│                        │
```

## Setup Instructions

### 1. Register Your Application with Figma

1. Go to https://www.figma.com/developers/apps
2. Click "Create app"
3. Fill in the application details:
   - **Name**: SuperDesign (or your app name)
   - **Website**: http://localhost:3000 (for development)
   - **Callback URL**: `http://localhost:4000/auth/callback/figma`
4. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cd server
cp .env.example .env
```

Edit `.env` and add your Figma credentials:

```env
# JWT Configuration
JWT_SECRET=your-random-32-character-secret-key-here
JWT_EXPIRES_IN=7d

# Figma OAuth
FIGMA_CLIENT_ID=your_figma_client_id_here
FIGMA_CLIENT_SECRET=your_figma_client_secret_here
FIGMA_REDIRECT_URI=http://localhost:4000/auth/callback/figma
```

**Important Security Notes:**
- Generate a strong JWT_SECRET (at least 32 characters)
- Never commit `.env` to version control
- Use different secrets for development and production

### 3. Test the OAuth Flow

1. Start the backend server:
```bash
cd server
npm run dev
```

2. Start the frontend:
```bash
cd client
npm run dev
```

3. Navigate to http://localhost:3000/prompt
4. Click "Login with Figma"
5. Authorize the application
6. You should be redirected back with a successful login

## Files and Components

### Backend

- **`auth/oauthService.ts`** - OAuth flow implementation
- **`auth/jwtService.ts`** - JWT generation and verification
- **`auth/authMiddleware.ts`** - Express middleware for route protection
- **`trpc/router.ts`** - OAuth endpoints (getAuthUrl, callback)
- **`trpc/context.ts`** - JWT extraction from requests
- **`trpc/trpc.ts`** - Protected procedure middleware
- **`index.ts`** - OAuth callback routes

### Frontend

- **`utils/auth.js`** - Token management utilities
- **`utils/trpc.js`** - tRPC client with auth headers
- **`components/LoginButton.jsx`** - Login/logout button
- **`pages/AuthCallback.jsx`** - OAuth callback handler
- **`main.jsx`** - tRPC provider setup

## API Endpoints

### HTTP Endpoints

#### `GET /auth/:platform`
Get OAuth authorization URL

**Parameters:**
- `platform` - "figma" or "framer"
- `state` (optional query) - CSRF protection state

**Response:**
```json
{
  "authUrl": "https://www.figma.com/oauth?client_id=...",
  "platform": "figma"
}
```

#### `GET /auth/callback/:platform`
OAuth callback endpoint (redirect target)

**Query Parameters:**
- `code` - Authorization code from OAuth provider
- `state` (optional) - State parameter for CSRF protection
- `error` (optional) - Error from OAuth provider

**Response:**
Redirects to frontend with token or error

### tRPC Procedures

#### `auth.getAuthUrl`
Get OAuth authorization URL

```typescript
const { authUrl } = await trpc.auth.getAuthUrl.query({
  platform: "figma",
  state: "optional-csrf-token"
});
```

#### `auth.callback`
Exchange authorization code for JWT

```typescript
const { token, userId } = await trpc.auth.callback.mutate({
  platform: "figma",
  code: "authorization_code",
  state: "optional-csrf-token"
});
```

#### `generateDesign` (Protected)
Generate design with authenticated user

```typescript
// Requires Authorization: Bearer <jwt-token>
const { taskId } = await trpc.generateDesign.mutate({
  prompt: "Create a blue button",
  fileId: "figma-file-id",
  platform: "figma"
});
```

## Token Management

### JWT Payload Structure

```typescript
{
  userId: string;           // Unique user identifier
  platform: "figma" | "framer";
  accessToken: string;      // Platform OAuth access token
  refreshToken?: string;    // Platform OAuth refresh token
  tokenExpiresAt: number;   // Timestamp when platform token expires
  iat: number;              // JWT issued at
  exp: number;              // JWT expires at
}
```

### Token Lifecycle

1. **Login**: JWT generated with 7-day expiration
2. **Storage**: JWT stored in localStorage
3. **Usage**: JWT sent as `Authorization: Bearer <token>` header
4. **Refresh**: Platform tokens auto-refreshed when needed
5. **Logout**: JWT removed from localStorage

### Auto-Refresh Logic

The backend automatically refreshes platform access tokens when:
- Token is expired or expires within 5 minutes
- User has a valid refresh token
- New JWT with updated token sent via `X-New-Token` header

## Protected Routes

### Backend

Use `protectedProcedure` instead of `publicProcedure`:

```typescript
generateDesign: protectedProcedure
  .input(z.object({ prompt: z.string() }))
  .mutation(async ({ input, ctx }) => {
    // ctx.user is guaranteed to exist
    const accessToken = ctx.user.accessToken;
    // ... use token for API calls
  })
```

### Frontend

Use `isAuthenticated()` to check auth state:

```jsx
import { isAuthenticated, getCurrentUser } from "../utils/auth";

function MyComponent() {
  const authenticated = isAuthenticated();
  const user = getCurrentUser();

  if (!authenticated) {
    return <LoginButton />;
  }

  return <div>Welcome, {user.platform} user!</div>;
}
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing client ID` | OAuth credentials not configured | Set `FIGMA_CLIENT_ID` in `.env` |
| `Invalid redirect URI` | Mismatch with Figma app settings | Update redirect URI in Figma app settings |
| `Unauthorized` | Invalid or expired JWT | User needs to log in again |
| `Token refresh failed` | Refresh token invalid/expired | User needs to re-authenticate |

### Frontend Error Handling

```jsx
const { mutate, error } = trpc.generateDesign.useMutation({
  onError: (error) => {
    if (error.message.includes("Unauthorized")) {
      // Redirect to login
      logout();
      navigate("/prompt");
    }
  }
});
```

## Security Best Practices

1. **CSRF Protection**: Use state parameter in OAuth flow
2. **Token Storage**: Store JWT in localStorage (not cookies for SPA)
3. **HTTPS Only**: Use HTTPS in production
4. **Token Expiration**: Set reasonable expiration times
5. **Secret Management**: Use environment variables, never hardcode
6. **Scope Limitation**: Request only necessary OAuth scopes

## Production Deployment

### Environment Variables

```env
NODE_ENV=production
JWT_SECRET=<64-char-random-string>
FIGMA_CLIENT_ID=<production-client-id>
FIGMA_CLIENT_SECRET=<production-client-secret>
FIGMA_REDIRECT_URI=https://yourdomain.com/auth/callback/figma
CORS_ORIGIN=https://yourdomain.com
```

### Figma App Settings

Update your Figma app with production URLs:
- **Website**: https://yourdomain.com
- **Callback URL**: https://yourdomain.com/auth/callback/figma

### Security Checklist

- [ ] Use strong JWT_SECRET (64+ characters)
- [ ] Enable HTTPS
- [ ] Set secure CORS origins
- [ ] Implement rate limiting
- [ ] Add request logging
- [ ] Set up monitoring/alerts
- [ ] Use secure cookie flags (if using cookies)
- [ ] Implement session management (optional)

## Troubleshooting

### "Login with Figma" button doesn't work

1. Check console for errors
2. Verify backend server is running (port 4000)
3. Check FIGMA_CLIENT_ID in `.env`

### Redirect fails after authorization

1. Verify FIGMA_REDIRECT_URI matches Figma app settings exactly
2. Check backend logs for errors
3. Ensure frontend callback route exists

### "Unauthorized" errors on API calls

1. Check if JWT is stored in localStorage
2. Verify token hasn't expired
3. Check `Authorization` header is being sent
4. Verify JWT_SECRET matches between token creation and verification

### Token refresh not working

1. Check if refresh token was provided by Figma
2. Verify refresh token hasn't expired
3. Check backend logs for refresh errors

## Additional Resources

- [Figma OAuth Documentation](https://www.figma.com/developers/api#oauth2)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [tRPC Documentation](https://trpc.io/docs)

## Support

For issues or questions:
1. Check existing GitHub issues
2. Review this documentation
3. Check backend logs
4. Enable debug logging in development