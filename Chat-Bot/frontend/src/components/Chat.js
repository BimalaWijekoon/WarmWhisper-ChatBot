import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ChatNavbar from './NavbarChat';
import EmotionIndicator from './EmotionIndicator';
import MemoryPanel from './MemoryPanel';
import { sendDistressAlert, isDistressEmotion } from '../services/emailService';
import './Chat.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const RASA    = process.env.REACT_APP_RASA_URL    || 'http://localhost:5005';
const MAG_ON  = process.env.REACT_APP_MAG_ENABLED === 'true';

const generateSessionId = () => 'session-' + Math.random().toString(36).substr(2, 9);

// Animate each message bubble in
const bubbleVariants = {
  hidden:  { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.30, ease: [0.4, 0, 0.2, 1] } },
};

const Chat = () => {
  const [messages,     setMessages]     = useState([]);
  const [userInput,    setUserInput]    = useState('');
  const [userDetails,  setUserDetails]  = useState(null);
  const [sessionId,    setSessionId]    = useState(null);
  const [isTyping,     setIsTyping]     = useState(false);
  const [emotion,      setEmotion]      = useState('neutral');
  const [emotionConf,  setEmotionConf]  = useState(0);
  const [memoryOpen,   setMemoryOpen]   = useState(false);
  const [alertSent,    setAlertSent]    = useState(false); // prevent duplicate alerts per session
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Fetch user details on mount ───────────────────────────────────────────
  const fetchUserDetails = useCallback(async () => {
    const email = localStorage.getItem('email');
    if (!email) return;
    try {
      const res = await fetch(`${BACKEND}/user-details?email=${email}`);
      if (!res.ok) throw new Error('Failed to fetch user details');
      const data = await res.json();
      setUserDetails(data);

      const sid = generateSessionId();
      setSessionId(sid);

      if (data.lastLogout === '00:00:00 0000-00-00') {
        addBotMessage(`Hello, ${data.firstName}! 💜 Welcome to WarmWhisper. I'm here whenever you're ready to talk.`);
      } else {
        addBotMessage(`Welcome back, ${data.firstName}! 🌸 How are you feeling today?`);
        await loadMostRecentChat(email);
      }
    } catch (err) {
      console.error('Error fetching user details:', err.message);
    }
  }, []);

  useEffect(() => { fetchUserDetails(); }, [fetchUserDetails]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const addBotMessage = (text) => {
    setMessages(prev => [...prev, { bot: text, id: Date.now() + Math.random() }]);
  };

  const loadMostRecentChat = async (email) => {
    try {
      const res = await fetch(`${BACKEND}/get-previous-chats?email=${email}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.chats?.length > 0) {
        const recent = data.chats[0];
        setMessages(recent.messages.map(m => ({ ...m, id: Date.now() + Math.random() })));
        setSessionId(recent.sessionId);
      }
    } catch (err) { console.error('Error loading chat history:', err.message); }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!userDetails || !userInput.trim()) return;

    const userMessage = userInput.trim();
    setMessages(prev => [...prev, { user: userMessage, id: Date.now() }]);
    setUserInput('');
    setIsTyping(true);

    try {
      const rasaPayload = {
        sender: sessionId,
        message: userMessage,
        metadata: {
          first_name: userDetails.firstName,
          email: localStorage.getItem('email'),
        },
      };

      const [rasaRes] = await Promise.all([
        axios.post(`${RASA}/webhooks/rest/webhook`, rasaPayload),
        new Promise(r => setTimeout(r, 1800)), // min typing duration
      ]);

      setIsTyping(false);

      const botTexts = rasaRes.data.map(m => m.text).filter(Boolean);
      const botSlots = rasaRes.data[0]?.slots || {};

      // Update emotion indicator from RASA slot
      const detectedEmotion = botSlots.emotion || 'neutral';
      const detectedConf    = botSlots.emotion_confidence || 0.7;
      setEmotion(detectedEmotion);
      setEmotionConf(detectedConf);

      // Phase 1 safety: slot-based distress detection (replaces string-match)
      const distress = botSlots.is_distress === true
        || isDistressEmotion(detectedEmotion, detectedConf);

      if (distress && !alertSent && userDetails) {
        setAlertSent(true);
        try {
          await sendDistressAlert({
            toEmail:      userDetails.relativeEmail,
            toName:       userDetails.relative,
            userName:     userDetails.firstName,
            userFullName: `${userDetails.firstName} ${userDetails.lastName}`,
          });
        } catch (e) {
          console.error('[EmailJS] Alert failed:', e);
        }
      }

      if (botTexts.length > 0) {
        setMessages(prev => [
          ...prev,
          ...botTexts.map(t => ({ bot: t, id: Date.now() + Math.random() })),
        ]);
      }

      // Phase 2 MAG: write emotion event if memory is enabled
      if (MAG_ON && userDetails?.memoryOptIn) {
        fetch(`${BACKEND}/memory/write-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: localStorage.getItem('email'),
            sessionId,
            emotion: detectedEmotion,
            confidence: detectedConf,
          }),
        }).catch(() => {}); // fire-and-forget, never block chat
      }

    } catch (err) {
      console.error('Error sending message:', err);
      setIsTyping(false);
      addBotMessage('Sorry, something went wrong. Please try again in a moment. 🌿');
    }
  };

  // ── Save chat ─────────────────────────────────────────────────────────────
  const saveChatHistory = useCallback(async () => {
    const email = localStorage.getItem('email');
    if (!email || !sessionId || messages.length === 0) return;
    try {
      await fetch(`${BACKEND}/save-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sessionId, messages }),
      });
    } catch (err) { console.error('Error saving chat:', err.message); }
  }, [messages, sessionId]);

  // ── New chat ──────────────────────────────────────────────────────────────
  const handleNewChat = async () => {
    await saveChatHistory();
    const sid = generateSessionId();
    setSessionId(sid);
    setMessages([]);
    setAlertSent(false);
    setEmotion('neutral');
    if (userDetails) addBotMessage(`Hello again, ${userDetails.firstName}! 💜 Ready to talk?`);
  };

  const loadChatHistory = async (chatSessionId) => {
    const email = localStorage.getItem('email');
    if (!email || !chatSessionId) return;
    try {
      const res = await fetch(`${BACKEND}/get-chat-history?email=${email}&sessionId=${chatSessionId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages.map(m => ({ ...m, id: Date.now() + Math.random() })));
      setSessionId(chatSessionId);
    } catch (err) { console.error('Error loading chat:', err.message); }
  };

  return (
    <div className="chat-page" role="main">
      <ChatNavbar
        sessionId={sessionId}
        messages={messages}
        userDetails={userDetails}
        onNewChat={handleNewChat}
        loadChatHistory={loadChatHistory}
        setSessionId={setSessionId}
        setMessages={setMessages}
        sendBotMessage={addBotMessage}
        saveChatHistory={saveChatHistory}
        onMemoryToggle={() => setMemoryOpen(o => !o)}
        memoryOpen={memoryOpen}
      />

      <div className="chat-layout">
        {/* Main chat area */}
        <div className={`chat-main ${memoryOpen ? 'chat-main--narrow' : ''}`}>
          {/* Emotion indicator bar */}
          <EmotionIndicator emotion={emotion} confidence={emotionConf} />

          {/* Message window */}
          <div className="chat-window" role="log" aria-live="polite" aria-label="Chat messages">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id || idx}
                  className={`message-row ${msg.user ? 'message-row--right' : 'message-row--left'}`}
                  variants={bubbleVariants}
                  initial="hidden"
                  animate="visible"
                  layout
                >
                  {/* Bot avatar */}
                  {!msg.user && (
                    <motion.div className="avatar bot-avatar" whileHover={{ scale: 1.1 }}>
                      🤍
                    </motion.div>
                  )}

                  <div className={`bubble ${msg.user ? 'bubble--user' : 'bubble--bot'}`}>
                    {msg.user || msg.bot}
                  </div>

                  {/* User avatar */}
                  {msg.user && (
                    <div className="avatar user-avatar">
                      {userDetails?.profilePicture
                        ? <img src={userDetails.profilePicture} alt="You" />
                        : <span>{userDetails?.firstName?.[0] || 'U'}</span>
                      }
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  className="message-row message-row--left"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div className="avatar bot-avatar">🤍</div>
                  <div className="bubble bubble--bot bubble--typing" aria-label="Bot is typing">
                    <span /><span /><span />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <motion.div
            className="chat-input-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <input
              ref={inputRef}
              id="chat-message-input"
              className="chat-input-field"
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Share what's on your mind…"
              aria-label="Type a message"
              disabled={isTyping}
            />
            <motion.button
              id="chat-send-btn"
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={isTyping || !userInput.trim()}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </motion.button>
          </motion.div>
        </div>

        {/* Memory panel (slides in from right) */}
        <AnimatePresence>
          {memoryOpen && (
            <MemoryPanel
              email={localStorage.getItem('email')}
              userDetails={userDetails}
              onClose={() => setMemoryOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Chat;