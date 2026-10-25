const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Database Schema & Model (MongoDB)
// -------------------------------------------------------------
const CaseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  complainantName: { type: String, default: 'Citizen Complainant' },
  phone: { type: String, default: '9876543210' },
  status: { type: String, default: 'ACTIVE_TRIAGE' },
  sviScore: { type: Number, default: 0 },
  riskBand: { type: String, default: 'LOW' },
  criticalOverride: { type: Boolean, default: false },
  overrideReasons: [String],
  detectedIndicators: [
    {
      key: String,
      name: String,
      category: String,
      weight: Number,
      evidence: String,
      timestamp: String
    }
  ],
  messages: [
    {
      sender: { type: String, enum: ['USER', 'BOT'] },
      text: String,
      timestamp: String
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const Case = mongoose.model('Case', CaseSchema);

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Sync & Store Chat Messages in MongoDB
app.post('/api/chat', async (req, res) => {
  try {
    const { case_id, message, complainant_name, phone, sviScore, riskBand, criticalOverride, detectedIndicators } = req.body;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let caseRecord = await Case.findOne({ caseId: case_id });

    if (!caseRecord) {
      caseRecord = new Case({
        caseId: case_id || `NHAA-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        complainantName: complainant_name || 'Citizen Complainant',
        phone: phone || '9876543210',
        sviScore: sviScore || 0,
        riskBand: riskBand || 'LOW',
        criticalOverride: criticalOverride || false,
        detectedIndicators: detectedIndicators || [],
        messages: []
      });
    }

    if (message) {
      caseRecord.messages.push({ sender: 'USER', text: message, timestamp: timeStr });
    }
    if (sviScore !== undefined) caseRecord.sviScore = sviScore;
    if (riskBand) caseRecord.riskBand = riskBand;
    if (criticalOverride !== undefined) caseRecord.criticalOverride = criticalOverride;
    if (detectedIndicators) caseRecord.detectedIndicators = detectedIndicators;

    await caseRecord.save();
    res.status(200).json({ success: true, caseId: caseRecord.caseId, record: caseRecord });
  } catch (err) {
    console.error("Chat sync error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Lookup Case Status (Connected to your Track Case Modal)
app.get('/api/cases/:caseId', async (req, res) => {
  try {
    const caseRecord = await Case.findOne({ caseId: req.params.caseId.toUpperCase() });
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    res.status(200).json({ success: true, case: caseRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve main app pages
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index_standalone.html'));
});

// -------------------------------------------------------------
// Database Connection & Server Startup
// -------------------------------------------------------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nhaa_triage_db';
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Database'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
