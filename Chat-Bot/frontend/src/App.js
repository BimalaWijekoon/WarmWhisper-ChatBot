import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StartupPage from './components/StartupPage';
import Login from './components/Login';
import Signup from './components/Signup';
import ChatPage from './components/Chat';

// ── Theme context ─────────────────────────────────────────────────────────────
export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const App = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ww-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ww-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {/* Animated background orbs */}
      <div className="page-bg" aria-hidden="true" />

      <Router>
        <Routes>
          <Route path="/"       element={<StartupPage />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/chat"   element={<ChatPage />} />
        </Routes>
      </Router>
    </ThemeContext.Provider>
  );
};

export default App;
