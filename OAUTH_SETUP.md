# OAuth Authentication - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Prerequisites
- Node.js 18+
- A Figma account
- Git

### Step 1: Register Figma OAuth App

1. Go to https://www.figma.com/developers/apps
2. Click **"Create app"**
3. Fill in:
   - **App Name**: SuperDesign (or your choice)
   - **Website URL**: `http://localhost:3000`
   - **Callback URL**: `http://localhost:4000/auth/callback/figma`
4. Save and copy your **Client ID** and **Client Secret**

### Step 2: Configure Environment Variables

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
# Required for OAuth
JWT_SECRET=my-super-secret-jwt-key-at-least-32-characters-long
FIGMA_CLIENT_ID=paste_your_client_id_here
FIGMA_CLIENT_SECRET=paste_your_client_secret_here
FIGMA_REDIRECT_URI=http://localhost:4000/auth/callback/figma
```

### Step 3: Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### Step 4: Start the Application

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

### Step 5: Test OAuth Flow

1. Open http://localhost:3000/prompt
2. Click **"Login with Figma"** (top-right corner)
3. Authorize the application
4. You'll be redirected back and logged in! ✅

## 🎯 How It Works

```
User → Login Button → Figma OAuth → Authorization → Backend Exchange → JWT Token → Authenticated User
```

### Authentication Flow

1. **User clicks "Login with Figma"**
   - Frontend redirects to `http://localhost:4000/auth/figma`
   - Backend redirects to Figma's OAuth page

2. **User authorizes app on Figma**
   - Figma redirects to `http://localhost:4000/auth/callback/figma?code=...`

3. **Backend exchanges code for token**
   - Backend calls Figma API with code
   - Receives access token + refresh token
   - Generates JWT containing the access token
   - Redirects to `http://localhost:3000/auth/callback?token=...`

4. **Frontend stores JWT**
   - JWT saved to localStorage
   - Used for all authenticated API calls

## 🔐 Using Authentication in Your Code

### Frontend - Check if user is logged in

```jsx
import { isAuthenticated, getCurrentUser } from "./utils/auth";

function MyComponent() {
  const authenticated = isAuthenticated();
  const user = getCurrentUser();

  if (!authenticated) {
    return <LoginButton />;
  }

  return <div>Welcome! Platform: {user.platform}</div>;
}
```

### Frontend - Make authenticated API calls

```jsx
import { trpc } from "./utils/trpc";

function DesignButton() {
  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      console.log("Design created:", data.taskId);
    },
    onError: (error) => {
      if (error.message.includes("Unauthorized")) {
        alert("Please login first!");
      }
    }
  });

  return (
    <button onClick={() => generateDesign.mutate({
      prompt: "Create a blue button",
      fileId: "your-figma-file-id",
      platform: "figma"
    })}>
      Generate Design
    </button>
  );
}
```

### Backend - Create protected endpoints

```typescript
import { protectedProcedure } from "./trpc/trpc";

// This endpoint requires authentication
myProtectedRoute: protectedProcedure
  .input(z.object({ data: z.string() }))
  .mutation(async ({ input, ctx }) => {
    // ctx.user is guaranteed to exist
    const accessToken = ctx.user.accessToken;
    const platform = ctx.user.platform;
    
    // Use accessToken to call Figma API
    return { success: true };
  })
```

## 📁 Key Files

### Backend
- `server/auth/oauthService.ts` - OAuth flow implementation
- `server/auth/jwtService.ts` - JWT token management
- `server/trpc/router.ts` - Authentication endpoints
- `server/index.ts` - OAuth callback routes

### Frontend
- `client/src/utils/auth.js` - Token storage & management
- `client/src/utils/trpc.js` - API client with auth headers
- `client/src/components/LoginButton.jsx` - Login UI
- `client/src/pages/AuthCallback.jsx` - Handle OAuth redirect

## 🐛 Troubleshooting

### "Login with Figma" button doesn't work

**Check:**
- Backend server is running on port 4000
- `FIGMA_CLIENT_ID` is set in `.env`
- Console for error messages

**Solution:**
```bash
# Restart backend
cd server
npm run dev
```

### Redirect URI mismatch error

**Error:** `"redirect_uri_mismatch"`

**Solution:** 
- Go to Figma app settings
- Ensure Callback URL is exactly: `http://localhost:4000/auth/callback/figma`
- No trailing slash!

### "Unauthorized" on API calls

**Check:**
- User is logged in: `localStorage.getItem('auth_token')`
- Token hasn't expired
- Backend JWT_SECRET matches

**Solution:**
```javascript
// Clear and re-login
localStorage.clear();
// Click "Login with Figma" again
```

### Token not found after login

**Check browser console for:**
- Failed redirect
- CORS errors
- Network errors

**Solution:**
```bash
# Check CORS settings in server/index.ts
# Ensure frontend URL is in allowed origins
```

## 🔒 Security Best Practices

### Development
- ✅ Use `.env` file (never commit it!)
- ✅ JWT_SECRET at least 32 characters
- ✅ Test OAuth flow works end-to-end

### Production
- ✅ Use HTTPS everywhere
- ✅ Generate strong JWT_SECRET (64+ chars)
- ✅ Update Figma callback to production URL
- ✅ Set secure CORS origins
- ✅ Enable rate limiting
- ✅ Add request logging

## 📚 API Reference

### Frontend Auth Functions

```javascript
// Check authentication
isAuthenticated() → boolean

// Get current user
getCurrentUser() → { userId, platform, accessToken, ... }

// Login with token
login(token) → user

// Logout
logout() → void

// Check if token expired
isTokenExpired(token) → boolean
```

### tRPC Endpoints

```typescript
// Get OAuth URL
trpc.auth.getAuthUrl.query({ platform: "figma" })
→ { authUrl: "https://..." }

// Exchange code for JWT
trpc.auth.callback.mutate({ platform: "figma", code: "..." })
→ { token: "jwt...", userId: "..." }

// Generate design (requires auth)
trpc.generateDesign.mutate({ prompt, fileId, platform })
→ { taskId: "task-123" }
```

## 🎓 Next Steps

1. **Test the complete flow** - Login → Generate Design → Logout
2. **Read full documentation** - See `server/auth/README.md`
3. **Try the example component** - Check `client/src/components/DesignGenerator.jsx`
4. **Add error handling** - Handle token expiration gracefully
5. **Implement token refresh** - Already built-in, automatic!

## 💡 Pro Tips

- JWT contains the Figma access token - no need to pass it separately
- Tokens auto-refresh 5 minutes before expiration
- Use `protectedProcedure` for routes requiring auth
- Store JWT in localStorage for SPA apps
- Check `ctx.user.platform` to handle multi-platform support

## 🆘 Need Help?

1. Check `server/auth/README.md` for detailed docs
2. Look at example: `client/src/components/DesignGenerator.jsx`
3. Enable debug logging: `NODE_ENV=development`
4. Check browser console and backend logs

## 🎉 You're Ready!

Your app now has:
- ✅ Figma OAuth authentication
- ✅ JWT-based sessions
- ✅ Protected API routes
- ✅ Automatic token refresh
- ✅ Clean auth utilities

Start building amazing features! 🚀