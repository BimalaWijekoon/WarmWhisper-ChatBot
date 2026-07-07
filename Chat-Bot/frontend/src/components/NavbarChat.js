import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../App';
import './NavbarChat.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const NavbarChat = ({
  sessionId, messages, onNewChat, loadChatHistory,
  setSessionId, setMessages, sendBotMessage,
  saveChatHistory, onMemoryToggle, memoryOpen, userDetails,
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [previousChats,  setPreviousChats]  = useState([]);
  const [historyOpen,    setHistoryOpen]    = useState(false);
  const [loggingOut,     setLoggingOut]     = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchPreviousChats();
    // Close dropdown on outside click
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setHistoryOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPreviousChats = async () => {
    const email = localStorage.getItem('email');
    if (!email) return;
    try {
      const res = await fetch(`${BACKEND}/get-previous-chats?email=${email}`);
      if (res.ok) {
        const { chats } = await res.json();
        setPreviousChats(chats || []);
      }
    } catch (err) { console.error('Error fetching chats:', err.message); }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    if (sessionId && messages.length > 0) await saveChatHistory?.();

    const email = localStorage.getItem('email');
    if (email) {
      await fetch(`${BACKEND}/update-logout-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }

    localStorage.clear();
    navigate('/login');
  };

  const handleNewChat = async () => {
    if (sessionId && messages.length > 0) {
      await saveChatHistory?.();
      await fetchPreviousChats();
    }
    await onNewChat?.();
  };

  const handleLoadChat = async (chatSessionId) => {
    await saveChatHistory?.();
    await loadChatHistory?.(chatSessionId);
    setHistoryOpen(false);
  };

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const initial = userDetails?.firstName?.[0]?.toUpperCase() || 'U';

  return (
    <motion.nav
      className="chat-navbar"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      role="navigation"
      aria-label="Chat navigation"
    >
      {/* Brand */}
      <div className="chat-navbar-brand">
        <span className="chat-navbar-logo" aria-hidden="true">🫀</span>
        <span className="chat-navbar-name">WarmWhisper</span>
      </div>

      {/* Actions */}
      <div className="chat-navbar-actions">
        {/* Memory panel toggle */}
        <motion.button
          id="navbar-memory-btn"
          className={`navbar-btn ${memoryOpen ? 'navbar-btn--active' : ''}`}
          onClick={onMemoryToggle}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          aria-label="Toggle memory panel"
          aria-pressed={memoryOpen}
        >
          🧠 Memory
        </motion.button>

        {/* New chat */}
        <motion.button
          id="navbar-new-chat-btn"
          className="navbar-btn"
          onClick={handleNewChat}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          aria-label="Start new chat"
        >
          ✏️ New
        </motion.button>

        {/* Chat history dropdown */}
        <div className="navbar-dropdown" ref={dropdownRef}>
          <motion.button
            id="navbar-history-btn"
            className={`navbar-btn ${historyOpen ? 'navbar-btn--active' : ''}`}
            onClick={() => setHistoryOpen(o => !o)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            aria-haspopup="listbox"
            aria-expanded={historyOpen}
          >
            📋 History
          </motion.button>

          <AnimatePresence>
            {historyOpen && (
              <motion.div
                className="navbar-dropdown-menu"
                role="listbox"
                aria-label="Previous chats"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {previousChats.length === 0 ? (
                  <div className="navbar-dropdown-empty">No saved chats yet</div>
                ) : (
                  previousChats.map((chat, i) => (
                    <button
                      key={chat.sessionId}
                      className="navbar-dropdown-item"
                      role="option"
                      onClick={() => handleLoadChat(chat.sessionId)}
                    >
                      <span className="dropdown-item-label">Chat {i + 1}</span>
                      <span className="dropdown-item-date">{fmt(chat.savedAt)}</span>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        <motion.button
          className="navbar-btn navbar-btn--icon"
          onClick={toggleTheme}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </motion.button>

        {/* User avatar + logout */}
        <div className="navbar-user">
          <div className="navbar-avatar" aria-label={`Logged in as ${userDetails?.firstName || 'User'}`}>
            {userDetails?.profilePicture
              ? <img src={userDetails.profilePicture} alt="You" />
              : <span>{initial}</span>
            }
          </div>
          <motion.button
            id="navbar-logout-btn"
            className="navbar-logout"
            onClick={handleLogout}
            disabled={loggingOut}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            aria-label="Log out"
          >
            {loggingOut ? '…' : 'Sign out'}
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
};

export default NavbarChat;
