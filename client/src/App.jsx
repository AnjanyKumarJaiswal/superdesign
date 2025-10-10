import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import PromptPage from "./pages/PromptPage";
import ChatPage from "./pages/ChatPage";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./components/NotFound";
import TokenExpirationAlert from "./components/TokenExpirationAlert";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/prompt" element={<PromptPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        
        {/* Global token expiration alert */}
        <TokenExpirationAlert platform="figma" />
      </div>
    </Router>
  );
}

export default App;
