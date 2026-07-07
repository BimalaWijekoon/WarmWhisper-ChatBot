import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../App';
import './StartupPage.css';

const TAGLINES = [
  "A safe space to feel heard.",
  "Your emotions matter here.",
  "Gentle support, always present.",
];

const EmotionOrb = ({ color, size, x, y, delay }) => (
  <motion.div
    className="startup-orb"
    style={{ width: size, height: size, background: color, left: x, top: y }}
    animate={{ y: [0, -20, 0], scale: [1, 1.08, 1], opacity: [0.5, 0.75, 0.5] }}
    transition={{ duration: 6 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
    aria-hidden="true"
  />
);

const StartupPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const containerVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
  };

  const itemVariants = {
    hidden:  { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } },
  };

  return (
    <div className="startup-page" role="main">
      {/* Floating emotion orbs */}
      <EmotionOrb color="var(--color-primary-300)" size={180} x="5%" y="10%" delay={0} />
      <EmotionOrb color="var(--color-teal-400)"    size={120} x="80%" y="15%" delay={1.5} />
      <EmotionOrb color="var(--color-accent-300)"  size={90}  x="70%" y="70%" delay={3} />
      <EmotionOrb color="var(--color-primary-400)" size={150} x="15%" y="65%" delay={2} />

      {/* Theme toggle */}
      <motion.button
        className="startup-theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </motion.button>

      <motion.div
        className="startup-card glass-card"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Heartbeat icon */}
        <motion.div
          className="startup-icon"
          variants={itemVariants}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          🫀
        </motion.div>

        <motion.h1 className="startup-title" variants={itemVariants}>
          WarmWhisper
        </motion.h1>

        <motion.p className="startup-subtitle" variants={itemVariants}>
          {TAGLINES[new Date().getSeconds() % TAGLINES.length]}
        </motion.p>

        <motion.p className="startup-description" variants={itemVariants}>
          Meet your compassionate AI companion — always here to listen,
          understand, and walk beside you through every emotion.
        </motion.p>

        {/* Feature pills */}
        <motion.div className="startup-features" variants={itemVariants}>
          {['Emotion-aware', 'Private & secure', 'Always available'].map((f) => (
            <span key={f} className="startup-feature-pill">{f}</span>
          ))}
        </motion.div>

        <motion.div className="startup-actions" variants={itemVariants}>
          <motion.button
            className="btn-primary startup-cta"
            onClick={() => navigate('/login')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            id="startup-begin-btn"
          >
            Begin Your Journey
          </motion.button>
          <motion.button
            className="btn-ghost"
            onClick={() => navigate('/signup')}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            id="startup-signup-btn"
          >
            Create Account
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default StartupPage;
