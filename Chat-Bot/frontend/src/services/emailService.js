/**
 * emailService.js
 *
 * Handles emergency distress alert emails via EmailJS (client-side).
 *
 * Setup instructions:
 * 1. Create a free account at https://www.emailjs.com
 * 2. Add a Gmail (or any SMTP) service → note the Service ID
 * 3. Create an Email Template with these variables:
 *      {{to_email}}       → recipient email (relative)
 *      {{to_name}}        → relative's name
 *      {{user_name}}      → user's first name
 *      {{user_full_name}} → user's full name
 * 4. Paste your credentials into frontend/.env (REACT_APP_EMAILJS_*)
 *
 * Suggested template body:
 * ─────────────────────────────────────────────────────────
 * Subject: Emergency Alert — {{user_name}} may need your support
 *
 * Dear {{to_name}},
 *
 * This is an automated message from WarmWhisper.
 *
 * {{user_full_name}} is currently using the WarmWhisper mental health
 * support platform and their responses suggest they may need immediate
 * emotional support.
 *
 * Please reach out to them as soon as possible.
 *
 * — WarmWhisper Support System
 * ─────────────────────────────────────────────────────────
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID  = process.env.REACT_APP_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;

/**
 * Sends an emergency alert email to a user's trusted contact.
 *
 * @param {Object} params
 * @param {string} params.toEmail      - Relative's email address
 * @param {string} params.toName       - Relative's name
 * @param {string} params.userName     - User's first name
 * @param {string} params.userFullName - User's full name
 * @returns {Promise<void>}
 */
export async function sendDistressAlert({ toEmail, toName, userName, userFullName }) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.error(
      '[EmailJS] Missing configuration. Set REACT_APP_EMAILJS_* in frontend/.env'
    );
    return;
  }

  const templateParams = {
    to_email:       toEmail,
    to_name:        toName,
    user_name:      userName,
    user_full_name: userFullName,
  };

  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('[EmailJS] Emergency alert sent:', result.text);
    return result;
  } catch (error) {
    console.error('[EmailJS] Failed to send emergency alert:', error);
    throw error;
  }
}

/**
 * Distress emotion labels — any of these detected should trigger an alert.
 * Moving away from string-match to slot-based detection (Phase 1 fix).
 */
export const DISTRESS_EMOTIONS = new Set([
  'sadness',
  'grief',
  'fear',
  'nervousness',
  'remorse',
  'disappointment',
  'disgust',
]);

/**
 * Returns true if the detected emotion should trigger a distress alert.
 * @param {string} emotion - emotion slot value from RASA
 * @param {number} confidence - probability score (0-1)
 */
export function isDistressEmotion(emotion, confidence = 1) {
  return DISTRESS_EMOTIONS.has(emotion) && confidence >= 0.6;
}
