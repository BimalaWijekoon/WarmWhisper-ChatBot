import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './MemoryPanel.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const MemoryPanel = ({ email, userDetails, onClose }) => {
  const [timeline,  setTimeline]  = useState([]);
  const [semantic,  setSemantic]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [optIn,     setOptIn]     = useState(userDetails?.memoryOptIn || false);
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    if (!email) return;
    fetchMemory();
  }, [email]);

  const fetchMemory = async () => {
    setLoading(true);
    try {
      const [timeRes, ctxRes] = await Promise.all([
        fetch(`${BACKEND}/memory/${email}/timeline`),
        fetch(`${BACKEND}/memory/${email}/context?limit=5`),
      ]);

      if (timeRes.ok) {
        const { events } = await timeRes.json();
        setTimeline(events || []);
      }
      if (ctxRes.ok) {
        const { semanticMemory } = await ctxRes.json();
        setSemantic(semanticMemory);
      }
    } catch (err) {
      console.error('Error fetching memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConsentToggle = async () => {
    try {
      const res = await fetch(`${BACKEND}/user/memory-consent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, optIn: !optIn }),
      });
      if (res.ok) {
        setOptIn(o => !o);
        if (optIn) fetchMemory();
      }
    } catch (err) { console.error('Error toggling consent:', err); }
  };

  const handleForget = async () => {
    if (!window.confirm('This will permanently erase all memory WarmWhisper has about you. This cannot be undone.')) return;
    setForgetting(true);
    try {
      await fetch(`${BACKEND}/memory/forget`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setTimeline([]);
      setSemantic(null);
    } catch (err) { console.error('Error erasing memory:', err); }
    finally { setForgetting(false); }
  };

  const EMOTION_EMOJI = {
    joy: '☀️', sadness: '💙', anger: '🔥', fear: '😰', grief: '💧',
    nervousness: '😬', love: '💖', gratitude: '🙏', excitement: '🚀',
    neutral: '🌿', default: '💜',
  };

  return (
    <motion.aside
      className="memory-panel glass-card"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      aria-label="Memory Panel"
    >
      {/* Header */}
      <div className="memory-header">
        <div>
          <h2 className="memory-title">🧠 My Memory</h2>
          <p className="memory-subtitle">What WarmWhisper remembers about you</p>
        </div>
        <button className="memory-close" onClick={onClose} aria-label="Close memory panel">✕</button>
      </div>

      {/* Consent toggle */}
      <div className="memory-consent-row">
        <div>
          <p className="memory-consent-label">Long-term memory</p>
          <p className="memory-consent-hint">
            {optIn ? 'WarmWhisper is learning from your sessions' : 'Turn on to allow personalised support'}
          </p>
        </div>
        <button
          className={`memory-toggle ${optIn ? 'memory-toggle--on' : ''}`}
          onClick={handleConsentToggle}
          role="switch"
          aria-checked={optIn}
          aria-label="Toggle long-term memory"
          id="memory-toggle-btn"
        >
          <motion.div className="memory-toggle-thumb" layout transition={{ type: 'spring', stiffness: 600, damping: 40 }} />
        </button>
      </div>

      {loading ? (
        <div className="memory-loading" aria-label="Loading memory">
          <motion.div className="memory-spinner"
            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
          <p>Loading memories…</p>
        </div>
      ) : !optIn ? (
        <div className="memory-empty">
          <p className="memory-empty-icon" aria-hidden="true">💤</p>
          <p>Memory is turned off. Enable it above to let WarmWhisper remember your journey.</p>
        </div>
      ) : (
        <>
          {/* Semantic memory */}
          {semantic && (
            <div className="memory-section">
              <h3 className="memory-section-title">What I know about you</h3>

              {semantic.themes?.length > 0 && (
                <div className="memory-tags">
                  <p className="memory-tags-label">Common themes</p>
                  <div className="memory-tag-list">
                    {semantic.themes.map(t => <span key={t} className="memory-tag">{t}</span>)}
                  </div>
                </div>
              )}

              {semantic.copingStrategies?.length > 0 && (
                <div className="memory-tags">
                  <p className="memory-tags-label">What's helped you</p>
                  <div className="memory-tag-list">
                    {semantic.copingStrategies.map(c => <span key={c} className="memory-tag memory-tag--green">{c}</span>)}
                  </div>
                </div>
              )}

              {semantic.triggers?.length > 0 && (
                <div className="memory-tags">
                  <p className="memory-tags-label">Known stressors</p>
                  <div className="memory-tag-list">
                    {semantic.triggers.map(t => <span key={t} className="memory-tag memory-tag--orange">{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Emotion timeline */}
          <div className="memory-section">
            <h3 className="memory-section-title">Emotion timeline</h3>
            {timeline.length === 0 ? (
              <p className="memory-no-events">No events yet — start chatting!</p>
            ) : (
              <div className="memory-timeline">
                {timeline.slice(0, 20).map((ev, i) => (
                  <motion.div key={ev._id || i} className="timeline-event"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <span className="timeline-emoji" aria-hidden="true">
                      {EMOTION_EMOJI[ev.emotion] || EMOTION_EMOJI.default}
                    </span>
                    <div className="timeline-content">
                      <span className="timeline-emotion">{ev.emotion}</span>
                      <span className="timeline-date">
                        {new Date(ev.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {ev.confidence && (
                      <div className="timeline-conf-bar">
                        <div className="timeline-conf-fill" style={{ width: `${Math.round(ev.confidence * 100)}%` }} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Forget button */}
      <div className="memory-footer">
        <button
          id="memory-forget-btn"
          className="memory-forget-btn"
          onClick={handleForget}
          disabled={forgetting}
          aria-label="Erase all memory"
        >
          {forgetting ? '⏳ Erasing…' : '🗑️ Erase all my memory'}
        </button>
      </div>
    </motion.aside>
  );
};

export default MemoryPanel;
