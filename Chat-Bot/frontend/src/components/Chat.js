import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Button, Input } from 'antd';
import './Chat.css';
import Navbar from "./NavbarChat";
import BotAvatar from '../components/images/download.png';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const generateSessionId = () => {
    return 'session-' + Math.random().toString(36).substr(2, 9);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchUserDetails = async () => {
    const email = localStorage.getItem('email');
    if (email) {
      try {
        const response = await fetch(`http://localhost:5000/user-details?email=${email}`);
        if (!response.ok) throw new Error('Failed to fetch user details');

        const data = await response.json();
        setUserDetails(data);

        if (data.lastLogout === '00:00:00 0000-00-00') {
          sendBotMessage(`Hello, ${data.firstName}! Welcome to WarmWhisper. I'm here to assist you with anything you need. How can I help you today?`);
          setSessionId(generateSessionId());
        } else {
          sendBotMessage(`Welcome back, ${data.firstName}! How are you feeling today?`);
          await loadMostRecentChat(email);
        }
      } catch (error) {
        console.error('Error fetching user details:', error.message);
      }
    }
  };

  const loadMostRecentChat = async (email) => {
    try {
      const response = await fetch(`http://localhost:5000/get-previous-chats?email=${email}`);
      if (!response.ok) throw new Error('Failed to load chat history');

      const data = await response.json();
      if (data.chats && data.chats.length > 0) {
        const mostRecentChat = data.chats[0];
        setMessages(mostRecentChat.messages);
        setSessionId(mostRecentChat.sessionId);
      }
    } catch (error) {
      console.error('Error loading chat history:', error.message);
    }
  };

  const sendBotMessage = (message) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { bot: message },
    ]);
  };

  useEffect(() => {
    fetchUserDetails();
  }, []);

  useEffect(() => {
    scrollToBottom();
    localStorage.setItem('messages', JSON.stringify(messages));
  }, [messages]);

  const showTypingIndicator = () => {
    setIsTyping(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  };

  const handleSadnessDetection = async (botMessage) => {
    if (botMessage.toLowerCase().includes('sadness')) {
      try {
        const email = localStorage.getItem('email');
        const response = await axios.post('http://localhost:5000/send-emergency-email', {
          email: email
        });

        if (response.status === 200) {
          setMessages(prevMessages => [
            ...prevMessages,
            { bot: `I've notified your relative about how you're feeling. They care about you and will reach out soon.` }
          ]);
        }
      } catch (error) {
        console.error('Error sending emergency email:', error);
      }
    }
  };

  const sendMessage = async () => {
    if (!userDetails) {
      console.warn('User details not loaded yet.');
      return;
    }
    if (userInput.trim() === '') return;
  
    const userMessage = userInput;
    setMessages((prevMessages) => [...prevMessages, { user: userMessage }]);
    setUserInput('');
  
    try {
      setIsTyping(true);
      
      const typingPromise = showTypingIndicator();
      
      const rasaPromise = axios.post('http://localhost:5005/webhooks/rest/webhook', {
        sender: sessionId,
        message: userMessage,
        metadata: {
          first_name: userDetails ? userDetails.firstName : 'User'
        }
      });
  
      const [response] = await Promise.all([rasaPromise, typingPromise]);
  
      setIsTyping(false);
  
      const botResponses = response.data.map((msg) => msg.text).filter(Boolean);
  
      if (botResponses.length > 0) {
        setMessages((prevMessages) => [
          ...prevMessages,
          ...botResponses.map((botResponse) => ({ bot: botResponse })),
        ]);

        botResponses.forEach(botResponse => {
          handleSadnessDetection(botResponse);
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      setMessages((prevMessages) => [
        ...prevMessages,
        { bot: 'Sorry, something went wrong. Please try again later.' },
      ]);
    }
  };

  const handleNewChat = async () => {
    await saveChatHistory();
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    localStorage.setItem('sessionId', newSessionId);
    setMessages([]);
    if (userDetails) {
      sendBotMessage(`Hello, ${userDetails.firstName}! Welcome to a new chat session. How can I assist you?`);
    }
  };

  const loadChatHistory = async (chatSessionId) => {
    const email = localStorage.getItem('email');
    if (email && chatSessionId) {
      try {
        const response = await fetch(`http://localhost:5000/get-chat-history?email=${email}&sessionId=${chatSessionId}`);
        if (!response.ok) throw new Error('Failed to load chat history');

        const data = await response.json();
        setMessages(data.messages);
        setSessionId(chatSessionId);
      } catch (error) {
        console.error('Error loading chat history:', error.message);
      }
    }
  };

  const saveChatHistory = async () => {
    const email = localStorage.getItem('email');

    if (email && sessionId && messages && messages.length > 0) {
      try {
        const response = await fetch('http://localhost:5000/save-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, sessionId, messages }),
        });

        if (!response.ok) {
          throw new Error('Failed to save chat history.');
        }

        console.log('Chat history saved successfully.');
      } catch (error) {
        console.error('Error saving chat history:', error.message);
      }
    } else {
      console.error('Missing data to save chat history:', { email, sessionId, messages });
    }
  };

  return (
    <>
      <Navbar
        sessionId={sessionId}
        messages={messages}
        onNewChat={handleNewChat}
        loadChatHistory={loadChatHistory}
        setSessionId={setSessionId}
        setMessages={setMessages}
        sendBotMessage={sendBotMessage}
      />
      <div className="chat-page">
        <div className="chat-container">
          <div className="chat-window">
            {messages.map((msg, index) => (
              <div key={index} className={`message-bubble ${msg.user ? 'bubble-right' : 'bubble-left'}`}>
                {msg.user ? (
                  <div className="user-message">
                    <div className="user-avatar-small">
                      {userDetails && userDetails.profilePicture ? (
                        <img
                          src={userDetails.profilePicture}
                          alt="User Avatar"
                          className="user-avatar-image"
                        />
                      ) : (
                        <div className="user-avatar-placeholder">U</div>
                      )}
                    </div>
                    {msg.user}
                  </div>
                ) : (
                  <div className="bot-message">
                    <div className="bot-avatar-small">
                      <img src={BotAvatar} alt="Bot Avatar" className="bot-avatar-image" />
                    </div>
                    {msg.bot}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="message-bubble bubble-left">
                <div className="bot-typing">
                  <div className="bot-avatar-small">
                    <img src={BotAvatar} alt="Bot Avatar" className="bot-avatar-image" />
                  </div>
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-section">
            <Input
              className="chat-input"
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onPressEnter={sendMessage}
              placeholder="Type your message..."
            />
            <Button type="primary" onClick={sendMessage} className="send-button">
              Send
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Chat;