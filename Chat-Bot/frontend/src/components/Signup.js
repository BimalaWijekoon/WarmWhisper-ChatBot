import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../App';
import './Login.css';
import './Signup.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const STEPS = ['Your Info', 'Contact', 'Trusted Contact'];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
  exit:  (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.25 } }),
};

const Field = ({ id, label, name, type = 'text', placeholder, autoComplete, value, error, onChange }) => (
  <div className="auth-field">
    <label htmlFor={id} className="input-label">{label}</label>
    <input
      id={id}
      className={`input-field ${error ? 'input-field--error' : ''}`}
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
    />
    <AnimatePresence>
      {error && (
        <motion.span className="signup-field-error"
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {error}
        </motion.span>
      )}
    </AnimatePresence>
  </div>
);

const Signup = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [step, setStep]     = useState(0);
  const [dir, setDir]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    telephone: '', relative: '', relativeNum: '', relativeEmail: '',
    profilePicture: null,
  });

  const [preview, setPreview] = useState(null);
  const [errors, setErrors]   = useState({});

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'profilePicture' && files?.[0]) {
      const file = files[0];
      setPreview(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onloadend = () => setForm(f => ({ ...f, profilePicture: reader.result }));
      reader.readAsDataURL(file);
      return;
    }
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }));
  };

  const validateStep = () => {
    const errs = {};
    if (step === 0) {
      if (!form.firstName) errs.firstName = 'Required';
      if (!form.lastName)  errs.lastName  = 'Required';
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Valid email required';
      if (!form.password || form.password.length < 6) errs.password = 'Min. 6 characters';
    }
    if (step === 1) {
      if (!form.telephone) errs.telephone = 'Required';
    }
    if (step === 2) {
      if (!form.relative)    errs.relative    = 'Required';
      if (!form.relativeNum) errs.relativeNum = 'Required';
      if (!form.relativeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.relativeEmail)) {
        errs.relativeEmail = 'Valid email required';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) { setDir(1); setStep(s => s + 1); }
  };

  const goBack = () => { setDir(-1); setStep(s => s - 1); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Signup failed');
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" role="main">
      <motion.button
        className="startup-theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </motion.button>

      <motion.div
        className="auth-card glass-card"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Header */}
        <div className="auth-header">
          <div className="auth-icon" aria-hidden="true">✨</div>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          {/* Step progress dots */}
          <div className="auth-steps" role="progressbar" aria-valuenow={step + 1} aria-valuemax={STEPS.length}>
            {STEPS.map((_, i) => (
              <div key={i} className={`auth-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
            ))}
          </div>
        </div>

        {/* Profile picture (step 0 only) */}
        {step === 0 && (
          <div className="signup-avatar-row">
            <input type="file" id="profilePicture" name="profilePicture"
              accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
            <label htmlFor="profilePicture" className="signup-avatar-label" aria-label="Upload profile picture">
              {preview
                ? <img src={preview} alt="Profile preview" className="signup-avatar-img" />
                : <span className="signup-avatar-placeholder">📷</span>}
            </label>
            <span className="signup-avatar-hint">Optional photo</span>
          </div>
        )}

        {/* Sliding form steps */}
        <form onSubmit={step === STEPS.length - 1 ? handleSubmit : (e) => { e.preventDefault(); goNext(); }}
          className="auth-form" noValidate>

          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit">

              {step === 0 && (
                <div className="auth-form-inner">
                  <div className="signup-row">
                    <Field id="su-first" label="First Name"  name="firstName"  placeholder="Alice"       autoComplete="given-name" value={form.firstName} error={errors.firstName} onChange={handleChange} />
                    <Field id="su-last"  label="Last Name"   name="lastName"   placeholder="Smith"       autoComplete="family-name" value={form.lastName} error={errors.lastName} onChange={handleChange} />
                  </div>
                  <Field id="su-email"    label="Email"    name="email"    type="email"    placeholder="you@example.com"  autoComplete="email" value={form.email} error={errors.email} onChange={handleChange} />
                  <Field id="su-password" label="Password" name="password" type="password" placeholder="Min. 6 characters" autoComplete="new-password" value={form.password} error={errors.password} onChange={handleChange} />
                </div>
              )}

              {step === 1 && (
                <div className="auth-form-inner">
                  <Field id="su-phone" label="Your Phone Number" name="telephone"
                    placeholder="+1 555 000 0000" autoComplete="tel" value={form.telephone} error={errors.telephone} onChange={handleChange} />
                  <p className="signup-step-hint">
                    In an emergency, we'll help notify someone who cares about you.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="auth-form-inner">
                  <Field id="su-rel-name"  label="Trusted Contact's Name"  name="relative"
                    placeholder="Jane Smith" autoComplete="off" value={form.relative} error={errors.relative} onChange={handleChange} />
                  <Field id="su-rel-phone" label="Their Phone Number"      name="relativeNum"
                    placeholder="+1 555 000 0001" autoComplete="off" value={form.relativeNum} error={errors.relativeNum} onChange={handleChange} />
                  <Field id="su-rel-email" label="Their Email Address"     name="relativeEmail"
                    type="email" placeholder="jane@example.com" autoComplete="off" value={form.relativeEmail} error={errors.relativeEmail} onChange={handleChange} />
                  <p className="signup-step-hint signup-step-hint--privacy">
                    🔒 This info is only used for emergency alerts — never shared or sold.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div className="auth-error" role="alert"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className={`signup-nav ${step === 0 ? 'signup-nav--single' : ''}`}>
            {step > 0 && (
              <motion.button type="button" className="btn-ghost signup-back"
                onClick={goBack} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                ← Back
              </motion.button>
            )}

            <motion.button
              id={step === STEPS.length - 1 ? 'signup-submit-btn' : 'signup-next-btn'}
              className={`btn-primary signup-next ${success ? 'auth-submit--success' : ''}`}
              type="submit"
              disabled={loading || success}
              whileHover={{ scale: loading ? 1 : 1.03 }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
            >
              {success ? '✓ Account created!'
                : loading ? <span className="auth-spinner" aria-label="Loading" />
                : step === STEPS.length - 1 ? 'Create Account' : 'Continue →'}
            </motion.button>
          </div>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <button className="auth-link" onClick={() => navigate('/login')}>Sign in</button>
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
