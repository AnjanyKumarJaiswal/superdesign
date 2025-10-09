# Integration Example: Using OAuth in ChatPage

This guide shows how to integrate OAuth authentication into the existing ChatPage to enable authenticated design generation.

## Quick Integration

### Option 1: Add Authentication Check to ChatPage

```jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, getCurrentUser } from "../utils/auth";
import { trpc } from "../utils/trpc";
import LoginButton from "../components/LoginButton";

const ChatPage = () => {
  const navigate = useNavigate();
  const authenticated = isAuthenticated();
  const user = getCurrentUser();
  const [messages, setMessages] = useState([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authenticated) {
      alert("Please log in with Figma to use this feature");
      navigate("/prompt");
    }
  }, [authenticated, navigate]);

  // Use authenticated design generation
  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      console.log("Design generation started:", data.taskId);
      // Add message to chat
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Design generation started! Task ID: ${data.taskId}`,
        taskId: data.taskId
      }]);
    },
    onError: (error) => {
      console.error("Design generation failed:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${error.message}`,
        error: true
      }]);
    }
  });

  const handleGenerateDesign = (prompt, fileId) => {
    if (!authenticated) {
      alert("Please log in with Figma first");
      return;
    }

    generateDesign.mutate({
      prompt,
      fileId,
      platform: user.platform || "figma"
    });
  };

  // Rest of your ChatPage component...
  return (
    <div className="chat-page">
      {/* Your existing UI */}
    </div>
  );
};

export default ChatPage;
```

### Option 2: Add Login Prompt in Chat UI

```jsx
const ChatPage = () => {
  const authenticated = isAuthenticated();
  
  // Show login prompt if not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030014]">
        <div className="text-center max-w-md px-6">
          <h2 className="text-3xl font-bold text-white mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-400 mb-8">
            Please log in with your Figma account to start generating designs.
          </p>
          <LoginButton />
        </div>
      </div>
    );
  }

  // Your normal chat page UI
  return (
    <div className="chat-page">
      {/* Your existing chat interface */}
    </div>
  );
};
```

### Option 3: Add Authentication Status to Chat Header

```jsx
const ChatPage = () => {
  const authenticated = isAuthenticated();
  const user = getCurrentUser();

  return (
    <div className="chat-page">
      {/* Header with auth status */}
      <header className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
        <h1 className="text-xl font-bold text-white">SuperDesign Chat</h1>
        
        <div className="flex items-center gap-4">
          {authenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                Connected to {user.platform}
              </span>
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            </div>
          ) : (
            <LoginButton />
          )}
        </div>
      </header>

      {/* Your existing chat UI */}
    </div>
  );
};
```

## Complete Example: Enhanced Message Handler

```jsx
import { useState } from "react";
import { trpc } from "../utils/trpc";
import { isAuthenticated } from "../utils/auth";

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const authenticated = isAuthenticated();

  // Mutation for authenticated design generation
  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: "Starting design generation...",
        taskId: data.taskId,
        status: "running"
      }]);
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: `Error: ${error.message}`,
        error: true
      }]);
    }
  });

  // Poll job status
  const { data: jobStatus } = trpc.getJobStatus.useQuery(
    { jobId: messages[messages.length - 1]?.taskId },
    {
      enabled: !!messages[messages.length - 1]?.taskId,
      refetchInterval: (data) => {
        // Stop polling when complete or failed
        if (data?.status === "completed" || data?.status === "failed") {
          return false;
        }
        return 2000; // Poll every 2 seconds
      }
    }
  );

  const handleSendMessage = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Check authentication
    if (!authenticated) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "Please log in with Figma to generate designs.",
        requiresAuth: true
      }]);
      setInput("");
      return;
    }

    // Generate design with authentication
    generateDesign.mutate({
      prompt: input,
      fileId: "your-figma-file-id", // Get from props or state
      platform: "figma"
    });

    setInput("");
  };

  // Update message with job status
  useEffect(() => {
    if (jobStatus && messages[messages.length - 1]?.taskId) {
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        
        if (lastMessage?.taskId) {
          lastMessage.status = jobStatus.status;
          if (jobStatus.status === "completed") {
            lastMessage.content = "Design generated successfully! ✨";
          } else if (jobStatus.status === "failed") {
            lastMessage.content = `Generation failed: ${jobStatus.error}`;
            lastMessage.error = true;
          } else if (jobStatus.result?.message) {
            lastMessage.content = jobStatus.result.message;
          }
        }
        
        return updated;
      });
    }
  }, [jobStatus]);

  return (
    <div className="chat-page">
      {/* Your chat UI here */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
            {msg.status === "running" && (
              <span className="loading">Generating...</span>
            )}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder={
            authenticated 
              ? "Describe your design..." 
              : "Please log in to continue"
          }
          disabled={!authenticated}
        />
        <button 
          onClick={handleSendMessage}
          disabled={!authenticated || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
```

## Real-Time Updates with WebSocket

```jsx
import { trpc } from "../utils/trpc";

const ChatPage = () => {
  const [messages, setMessages] = useState([]);

  // Subscribe to workflow events (requires WebSocket setup in tRPC)
  trpc.onWorkflowEvent.useSubscription(
    { taskId: currentTaskId },
    {
      onData: (event) => {
        console.log("Workflow event:", event);
        
        setMessages(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          
          if (event.type === "planning") {
            lastMessage.content = "Planning design...";
          } else if (event.type === "executing") {
            lastMessage.content = event.message;
          } else if (event.type === "complete") {
            lastMessage.content = "Design complete! ✨";
            lastMessage.result = event.result;
          }
          
          return updated;
        });
      }
    }
  );

  // Rest of component...
};
```

## Error Handling Best Practices

```jsx
const handleAuthError = (error) => {
  if (error.message.includes("Unauthorized")) {
    // Clear invalid token
    localStorage.removeItem("auth_token");
    
    // Show login prompt
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "system",
      content: "Your session expired. Please log in again.",
      requiresAuth: true
    }]);
    
    // Optionally redirect
    // navigate("/prompt");
  } else {
    // Handle other errors
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "system",
      content: `Error: ${error.message}`,
      error: true
    }]);
  }
};

const generateDesign = trpc.generateDesign.useMutation({
  onError: handleAuthError
});
```

## Tips & Best Practices

### 1. Check Authentication Before Actions
```jsx
const handleAction = () => {
  if (!isAuthenticated()) {
    alert("Please log in first");
    return;
  }
  // Proceed with action
};
```

### 2. Show Loading States
```jsx
{generateDesign.isLoading && (
  <div className="loading-indicator">
    <Loader2 className="animate-spin" />
    <span>Generating design...</span>
  </div>
)}
```

### 3. Handle Token Expiration
```jsx
import { isTokenExpired, getAuthToken } from "../utils/auth";

useEffect(() => {
  const token = getAuthToken();
  if (token && isTokenExpired(token)) {
    logout();
    alert("Session expired. Please log in again.");
  }
}, []);
```

### 4. Provide User Feedback
```jsx
const generateDesign = trpc.generateDesign.useMutation({
  onSuccess: () => {
    toast.success("Design generation started!");
  },
  onError: (error) => {
    toast.error(error.message);
  }
});
```

### 5. Graceful Degradation
```jsx
// Show limited features when not authenticated
{authenticated ? (
  <button onClick={handleGenerateDesign}>
    Generate with AI
  </button>
) : (
  <div>
    <p>Log in to unlock AI features</p>
    <LoginButton />
  </div>
)}
```

## Migration Checklist

- [ ] Import authentication utilities
- [ ] Add authentication check
- [ ] Replace old API calls with tRPC mutations
- [ ] Add LoginButton to UI
- [ ] Handle authentication errors
- [ ] Test login flow
- [ ] Test design generation
- [ ] Test logout flow
- [ ] Add loading states
- [ ] Add error messages

## Common Patterns

### Pattern 1: Protected Component
```jsx
const ProtectedFeature = () => {
  if (!isAuthenticated()) {
    return <LoginPrompt />;
  }
  return <Feature />;
};
```

### Pattern 2: Conditional Rendering
```jsx
{authenticated ? (
  <AuthenticatedView />
) : (
  <UnauthenticatedView />
)}
```

### Pattern 3: Auth-Aware Button
```jsx
<button
  onClick={authenticated ? handleAction : handleLogin}
  className={authenticated ? "primary" : "secondary"}
>
  {authenticated ? "Generate Design" : "Login to Generate"}
</button>
```

## Summary

To integrate OAuth into ChatPage:

1. Import `isAuthenticated`, `getCurrentUser` from `../utils/auth`
2. Import `trpc` from `../utils/trpc`
3. Check authentication status in component
4. Use `trpc.generateDesign.useMutation()` for authenticated calls
5. Add LoginButton component to UI
6. Handle authentication errors gracefully
7. Show loading/success/error states

The authentication is now transparent - just use `trpc` hooks and they'll automatically include the auth token from localStorage!