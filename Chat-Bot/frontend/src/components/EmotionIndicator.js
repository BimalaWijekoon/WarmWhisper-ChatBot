import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './EmotionIndicator.css';

const EMOTION_META = {
  admiration:    { label: 'Admiration',    emoji: '🌟', color: 'var(--emotion-joy)' },
  amusement:     { label: 'Amusement',     emoji: '😄', color: 'var(--emotion-joy)' },
  anger:         { label: 'Anger',         emoji: '🔥', color: 'var(--emotion-anger)' },
  annoyance:     { label: 'Annoyance',     emoji: '😤', color: 'var(--emotion-anger)' },
  approval:      { label: 'Approval',      emoji: '👍', color: 'var(--emotion-gratitude)' },
  caring:        { label: 'Caring',        emoji: '🤗', color: 'var(--emotion-love)' },
  confusion:     { label: 'Confusion',     emoji: '🌀', color: 'var(--emotion-confusion)' },
  curiosity:     { label: 'Curiosity',     emoji: '🔍', color: 'var(--emotion-joy)' },
  desire:        { label: 'Desire',        emoji: '✨', color: 'var(--emotion-excitement)' },
  disappointment:{ label: 'Disappointment',emoji: '😔', color: 'var(--emotion-sadness)' },
  disapproval:   { label: 'Disapproval',   emoji: '🙁', color: 'var(--emotion-anger)' },
  disgust:       { label: 'Disgust',       emoji: '😣', color: 'var(--emotion-anger)' },
  embarrassment: { label: 'Embarrassment', emoji: '😳', color: 'var(--emotion-nervousness)' },
  excitement:    { label: 'Excitement',    emoji: '🚀', color: 'var(--emotion-excitement)' },
  fear:          { label: 'Fear',          emoji: '😰', color: 'var(--emotion-fear)' },
  gratitude:     { label: 'Gratitude',     emoji: '🙏', color: 'var(--emotion-gratitude)' },
  grief:         { label: 'Grief',         emoji: '💧', color: 'var(--emotion-grief)' },
  joy:           { label: 'Joy',           emoji: '☀️', color: 'var(--emotion-joy)' },
  love:          { label: 'Love',          emoji: '💖', color: 'var(--emotion-love)' },
  nervousness:   { label: 'Nervousness',   emoji: '😬', color: 'var(--emotion-nervousness)' },
  optimism:      { label: 'Optimism',      emoji: '🌈', color: 'var(--emotion-excitement)' },
  pride:         { label: 'Pride',         emoji: '🦁', color: 'var(--emotion-joy)' },
  realization:   { label: 'Realization',   emoji: '💡', color: 'var(--emotion-excitement)' },
  relief:        { label: 'Relief',        emoji: '😮‍💨', color: 'var(--emotion-gratitude)' },
  remorse:       { label: 'Remorse',       emoji: '🌧️', color: 'var(--emotion-sadness)' },
  sadness:       { label: 'Sadness',       emoji: '💙', color: 'var(--emotion-sadness)' },
  surprise:      { label: 'Surprise',      emoji: '🎉', color: 'var(--emotion-excitement)' },
  neutral:       { label: 'Neutral',       emoji: '🌿', color: 'var(--emotion-neutral)' },
};

const EmotionIndicator = ({ emotion = 'neutral', confidence = 0 }) => {
  const meta = EMOTION_META[emotion] || EMOTION_META.neutral;

  return (
    <motion.div
      className="emotion-bar"
      layout
      style={{ '--emotion-active-color': meta.color }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={emotion}
          className="emotion-inner"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.35 }}
        >
          {/* Animated glow orb */}
          <motion.div
            className="emotion-orb"
            animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            {meta.emoji}
          </motion.div>

          <div className="emotion-info">
            <span className="emotion-label">Feeling detected:</span>
            <strong className="emotion-name">{meta.label}</strong>
          </div>

          {/* Confidence bar */}
          {confidence > 0 && (
            <div className="emotion-confidence" role="meter" aria-label={`Confidence: ${Math.round(confidence * 100)}%`}
              aria-valuenow={Math.round(confidence * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="emotion-conf-track">
                <motion.div
                  className="emotion-conf-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(confidence * 100, 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <span className="emotion-conf-pct">{Math.round(confidence * 100)}%</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default EmotionIndicator;
