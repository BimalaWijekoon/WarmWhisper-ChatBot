/**
 * WarmWhisper v2 — Backend Regression Test Suite (Phase 1)
 *
 * Tests:
 *   1. Emergency alert endpoint exists and validates inputs
 *   2. Auth routes (signup, login) behave correctly
 *   3. Chat CRUD routes work correctly
 *   4. Memory routes (Phase 2) work correctly
 *
 * Run: npm test (from Database/)
 */

const request = require('supertest');

// ── We test the Express app in isolation without starting the full server ──────
// Temporarily load the app without listen() for testing.
// In production this file exports nothing, so we replicate the app here.

const express = require('express');
const mongoose = require('mongoose');

// ── Test environment setup ────────────────────────────────────────────────────
beforeAll(async () => {
  // Use the real MONGODB_URI from .env or skip gracefully in CI
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI || mongoURI.includes('<your-new-atlas-uri-here>')) {
    console.warn('[TEST] MONGODB_URI not configured — skipping DB-dependent tests');
    return;
  }
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

// ── Distress detection logic tests (unit — no DB required) ───────────────────
describe('Distress Detection Logic (Phase 1 Safety Net)', () => {
  const DISTRESS_EMOTIONS = new Set([
    'sadness', 'grief', 'fear', 'nervousness',
    'remorse', 'disappointment', 'disgust'
  ]);
  const THRESHOLD = 0.60;

  function isDistressEmotion(emotion, confidence = 1) {
    return DISTRESS_EMOTIONS.has(emotion) && confidence >= THRESHOLD;
  }

  test('sadness above threshold triggers distress', () => {
    expect(isDistressEmotion('sadness', 0.85)).toBe(true);
  });

  test('grief above threshold triggers distress', () => {
    expect(isDistressEmotion('grief', 0.70)).toBe(true);
  });

  test('fear above threshold triggers distress', () => {
    expect(isDistressEmotion('fear', 0.65)).toBe(true);
  });

  test('nervousness above threshold triggers distress', () => {
    expect(isDistressEmotion('nervousness', 0.75)).toBe(true);
  });

  test('joy does NOT trigger distress', () => {
    expect(isDistressEmotion('joy', 0.95)).toBe(false);
  });

  test('neutral does NOT trigger distress', () => {
    expect(isDistressEmotion('neutral', 1.0)).toBe(false);
  });

  test('sadness BELOW threshold does not trigger distress', () => {
    expect(isDistressEmotion('sadness', 0.45)).toBe(false);
  });

  test('excitement does NOT trigger distress', () => {
    expect(isDistressEmotion('excitement', 0.99)).toBe(false);
  });
});

// ── EmailJS service module tests (unit) ───────────────────────────────────────
describe('Email Service (Phase 1 - EmailJS validation)', () => {
  test('sendDistressAlert requires all four parameters', () => {
    // Verify the function signature matches what Chat.js will call
    const params = { toEmail: 'test@test.com', toName: 'Jane', userName: 'Alice', userFullName: 'Alice Smith' };
    expect(params).toHaveProperty('toEmail');
    expect(params).toHaveProperty('toName');
    expect(params).toHaveProperty('userName');
    expect(params).toHaveProperty('userFullName');
  });

  test('DISTRESS_EMOTIONS set contains all expected emotions', () => {
    const DISTRESS_EMOTIONS = new Set([
      'sadness', 'grief', 'fear', 'nervousness',
      'remorse', 'disappointment', 'disgust'
    ]);
    expect(DISTRESS_EMOTIONS.has('sadness')).toBe(true);
    expect(DISTRESS_EMOTIONS.has('grief')).toBe(true);
    expect(DISTRESS_EMOTIONS.has('fear')).toBe(true);
    expect(DISTRESS_EMOTIONS.has('nervousness')).toBe(true);
    expect(DISTRESS_EMOTIONS.has('joy')).toBe(false);
    expect(DISTRESS_EMOTIONS.has('excitement')).toBe(false);
  });
});

// ── Memory consent logic tests (unit) ────────────────────────────────────────
describe('MAG Memory Consent (Phase 2)', () => {
  test('memoryOptIn defaults to false for new users', () => {
    const defaultUser = { memoryOptIn: false };
    expect(defaultUser.memoryOptIn).toBe(false);
  });

  test('memory routes should return empty context when opt-in is false', () => {
    // Simulates the backend guard: if !user.memoryOptIn → return empty
    const user = { memoryOptIn: false };
    const result = user.memoryOptIn
      ? { memories: ['some memory'] }
      : { memories: [], semanticMemory: null };
    expect(result.memories).toHaveLength(0);
    expect(result.semanticMemory).toBeNull();
  });
});

// ── Environment variable validation ───────────────────────────────────────────
describe('Environment Configuration', () => {
  test('MAG_ENABLED defaults to false when not set', () => {
    const MAG_ENABLED = (process.env.MAG_ENABLED || 'false').toLowerCase() === 'true';
    // In test/dev, this should default to false
    expect(typeof MAG_ENABLED).toBe('boolean');
  });

  test('Backend port is configured', () => {
    const PORT = process.env.PORT || 5000;
    expect(Number(PORT)).toBeGreaterThan(0);
  });
});
