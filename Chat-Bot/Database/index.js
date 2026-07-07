require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const helmet = require('helmet');

// ─── NOTE ON EMAIL ────────────────────────────────────────────────────────────
// Emergency alert emails are now sent via EmailJS directly from the React
// frontend (see frontend/src/services/emailService.js).
// Nodemailer has been removed. No SMTP credentials are needed on the server.
// ─────────────────────────────────────────────────────────────────────────────

// ─── NOTE ON MONGODB URI ──────────────────────────────────────────────────────
// Replace MONGODB_URI in your Database/.env with the updated Atlas connection
// string when ready. Current placeholder:
//   MONGODB_URI=<your-new-atlas-uri-here>
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // tightened from 50mb
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet());

// ── MongoDB connection ────────────────────────────────────────────────────────
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// ── User Schema ───────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  firstName:     { type: String, required: true },
  lastName:      { type: String, required: true },
  email:         { type: String, required: true, unique: true },
  password:      { type: String, required: true },
  relative:      { type: String, required: true },
  relativeNum:   { type: String, required: true },
  telephone:     { type: String, required: true },
  relativeEmail: { type: String, required: true },
  profilePicture:{ type: String, default: null },
  lastLogin:     { type: String, default: '00:00:00 0000-00-00' },
  lastLogout:    { type: String, default: '00:00:00 0000-00-00' },
  // ── MAG Phase 2: memory consent ──────────────────────────────────────────
  memoryOptIn:   { type: Boolean, default: false },
});

const User = mongoose.model('User', userSchema);

// ── Chat History Schema ───────────────────────────────────────────────────────
const chatHistorySchema = new mongoose.Schema({
  email:     { type: String, required: true, index: true },
  sessionId: { type: String, required: true },
  messages:  { type: Array,  required: true },
  savedAt:   { type: Date,   default: Date.now },
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

// ── MAG Phase 2: Episodic Memory Schema ──────────────────────────────────────
const emotionEventSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email:          { type: String, required: true },
  sessionId:      { type: String, required: true },
  timestamp:      { type: Date,   default: Date.now },
  emotion:        { type: String, required: true },
  confidence:     { type: Number },
  messageSummary: { type: String }, // brief LLM-extracted summary (Phase 3)
});

const EmotionEvent = mongoose.model('EmotionEvent', emotionEventSchema);

// ── MAG Phase 2: Semantic Memory Schema ──────────────────────────────────────
const userMemorySchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email:     { type: String, required: true, unique: true },
  themes:    { type: [String], default: [] },  // e.g. ["exam stress", "loneliness"]
  triggers:  { type: [String], default: [] },  // recurring stressors
  copingStrategies: { type: [String], default: [] }, // what has helped
  notes:     { type: String, default: '' },    // free-form memory from LLM extraction
  updatedAt: { type: Date,   default: Date.now },
});

const UserMemory = mongoose.model('UserMemory', userMemorySchema);

// ── Simple email-based identity helper (no JWT yet) ───────────────────────────
// TODO Phase 2+: replace with proper JWT middleware
const requireEmail = (req, res, next) => {
  const email = req.body.email || req.query.email;
  if (!email) return res.status(400).json({ error: 'email is required' });
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /user-details
app.get('/user-details', async (req, res) => {
  const { email } = req.query;
  try {
    const user = await User.findOne({ email }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user details:', error.message);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// POST /signup
app.post('/signup', async (req, res) => {
  try {
    const {
      firstName, lastName, email, password,
      relative, relativeNum, telephone, relativeEmail, profilePicture
    } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({
      firstName, lastName, email,
      password: hashedPassword,
      relative, relativeNum, telephone, relativeEmail,
      profilePicture: profilePicture || null,
    });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully.' });
  } catch (error) {
    console.error('Error signing up:', error.message);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid password' });

    user.lastLogin = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    await user.save();

    // Return user without password field
    const userObj = user.toObject();
    delete userObj.password;
    res.status(200).json({ message: 'Login successful', user: userObj });
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// POST /update-logout-time
app.post('/update-logout-time', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.lastLogout = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    await user.save();
    res.status(200).json({ message: 'Logout time updated successfully.' });
  } catch (error) {
    console.error('Error updating logout time:', error.message);
    res.status(500).json({ error: 'Failed to update logout time' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT HISTORY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /save-chat
app.post('/save-chat', async (req, res) => {
  const { email, sessionId, messages } = req.body;
  try {
    const existingChat = await ChatHistory.findOne({ email, sessionId });
    if (existingChat) {
      existingChat.messages = messages;
      existingChat.savedAt = new Date();
      await existingChat.save();
      return res.status(200).json({ message: 'Chat history updated successfully.' });
    }
    const newChatHistory = new ChatHistory({ email, sessionId, messages });
    await newChatHistory.save();
    res.status(201).json({ message: 'Chat history saved successfully.' });
  } catch (error) {
    console.error('Error saving chat history:', error.message);
    res.status(500).json({ error: 'Failed to save chat history' });
  }
});

// GET /get-previous-chats
app.get('/get-previous-chats', async (req, res) => {
  const { email } = req.query;
  try {
    const chats = await ChatHistory.find({ email }).sort({ savedAt: -1 });
    if (!chats || chats.length === 0) {
      return res.status(404).json({ error: 'No chat history found' });
    }
    res.status(200).json({ chats });
  } catch (error) {
    console.error('Error fetching previous chats:', error.message);
    res.status(500).json({ error: 'Failed to fetch previous chats' });
  }
});

// GET /get-chat-history
app.get('/get-chat-history', async (req, res) => {
  const { email, sessionId } = req.query;
  try {
    const chat = await ChatHistory.findOne({ email, sessionId });
    if (!chat) return res.status(404).json({ error: 'Chat history not found' });
    res.status(200).json(chat);
  } catch (error) {
    console.error('Error fetching chat history:', error.message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAG PHASE 2: MEMORY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /memory/write-event  — write a single emotion event (called after each message)
app.post('/memory/write-event', async (req, res) => {
  const { email, sessionId, emotion, confidence, messageSummary } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.memoryOptIn) {
      return res.status(403).json({ error: 'Memory not enabled for this user' });
    }

    await EmotionEvent.create({
      userId: user._id,
      email,
      sessionId,
      emotion,
      confidence,
      messageSummary: messageSummary || '',
    });

    res.status(201).json({ message: 'Emotion event recorded.' });
  } catch (error) {
    console.error('Error writing emotion event:', error.message);
    res.status(500).json({ error: 'Failed to write emotion event' });
  }
});

// GET /memory/:email/context — retrieve top-N relevant memories for context injection
app.get('/memory/:email/context', async (req, res) => {
  const { email } = req.params;
  const limit = parseInt(req.query.limit) || 5;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.memoryOptIn) {
      return res.status(200).json({ memories: [], semanticMemory: null });
    }

    // Recency-weighted: last N emotion events
    const recentEvents = await EmotionEvent.find({ email })
      .sort({ timestamp: -1 })
      .limit(limit);

    // Semantic memory (themes, triggers, coping strategies)
    const semanticMemory = await UserMemory.findOne({ email });

    res.status(200).json({
      memories: recentEvents,
      semanticMemory: semanticMemory || null,
    });
  } catch (error) {
    console.error('Error fetching memory context:', error.message);
    res.status(500).json({ error: 'Failed to fetch memory context' });
  }
});

// GET /memory/:email/timeline — full emotion history for mood timeline UI
app.get('/memory/:email/timeline', async (req, res) => {
  const { email } = req.params;
  try {
    const events = await EmotionEvent.find({ email }).sort({ timestamp: -1 }).limit(100);
    res.status(200).json({ events });
  } catch (error) {
    console.error('Error fetching timeline:', error.message);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// PUT /user/memory-consent — toggle memory opt-in
app.put('/user/memory-consent', async (req, res) => {
  const { email, optIn } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { email },
      { memoryOptIn: !!optIn },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ message: `Memory opt-in set to ${!!optIn}`, user });
  } catch (error) {
    console.error('Error updating memory consent:', error.message);
    res.status(500).json({ error: 'Failed to update consent' });
  }
});

// DELETE /memory/forget — purge all memory for a user (GDPR right to erasure)
app.delete('/memory/forget', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await EmotionEvent.deleteMany({ email });
    await UserMemory.deleteOne({ email });

    res.status(200).json({ message: 'All memory data erased for this user.' });
  } catch (error) {
    console.error('Error erasing memory:', error.message);
    res.status(500).json({ error: 'Failed to erase memory' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`WarmWhisper backend running on port ${PORT}`);
  console.log(`MAG_ENABLED: ${process.env.MAG_ENABLED || 'false'}`);
});
