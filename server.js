const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
const fs = require('fs');

// ... (existing middleware)

// Debug: Check public folder contents
try {
    const pubDir = path.join(__dirname, 'public');
    if (fs.existsSync(pubDir)) {
        console.log('Contents of public/ folder:', fs.readdirSync(pubDir));
    } else {
        console.log('Public folder does not exist!');
    }
} catch(e) { console.error('Error reading public dir:', e); }

app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MESH_LLM_URL = process.env.MESH_LLM_URL || 'http://localhost:9337';
const ALLOWED_ACP_AGENT_HOSTS = new Set(
    (process.env.ALLOWED_ACP_AGENT_HOSTS || 'localhost,127.0.0.1')
        .split(',')
        .map(host => host.trim().toLowerCase())
        .filter(Boolean)
);

const ALLOWED_GEMINI_MODELS = new Set([
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash',
    'gemini-2.5-pro'
]);

if (!GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not set in .env file');
    process.exit(1);
}

function isAllowedAgentUrl(agentUrl) {
    try {
        const parsed = new URL(agentUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        return ALLOWED_ACP_AGENT_HOSTS.has(parsed.hostname.toLowerCase());
    } catch (e) {
        return false;
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// Gemini proxy
app.post('/api/proxy', async (req, res) => {
    const { model, modelName, geminiPayload } = req.body;
    const targetModel = model || modelName;

    if (!targetModel || !geminiPayload) {
        return res.status(400).json({ error: { message: 'Missing model or geminiPayload' } });
    }
    if (!ALLOWED_GEMINI_MODELS.has(targetModel)) {
        return res.status(400).json({ error: { message: `Invalid model: ${targetModel}` } });
    }

    try {
        const url = `${GEMINI_API_URL}/${encodeURIComponent(targetModel)}:generateContent?key=${GEMINI_API_KEY}`;
        console.log(`📤 Gemini → ${targetModel}`);
        const response = await axios.post(url, geminiPayload, {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`✅ Gemini response OK`);
        res.json(response.data);
    } catch (error) {
        console.error('❌ Gemini Error:', error.response?.data || error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error?.message || error.message;
        res.status(status).json({ error: { message } });
    }
});

// Mesh-LLM proxy (OpenAI-compatible)
app.post('/api/mesh', async (req, res) => {
    try {
        console.log(`🕸️  Mesh-LLM → ${req.body.model}`);
        const response = await axios.post(`${MESH_LLM_URL}/v1/chat/completions`, req.body, {
            timeout: 120000,
            headers: { 'Content-Type': 'application/json' }
        });
        res.json(response.data);
    } catch (error) {
        console.error('❌ Mesh-LLM Error:', error.message);
        res.status(503).json({ error: { message: `Mesh-LLM unavailable: ${error.message}` } });
    }
});

// ACP proxy (Claude Agent)
app.post('/api/acp-proxy', async (req, res) => {
    const { agentUrl, ...payload } = req.body;
    if (!agentUrl) return res.status(400).json({ error: 'Missing agentUrl' });
    if (!isAllowedAgentUrl(agentUrl)) {
        return res.status(400).json({ error: 'Invalid or disallowed agentUrl' });
    }
    try {
        const response = await axios.post(agentUrl, payload, {
            timeout: 120000,
            headers: { 'Content-Type': 'application/json' }
        });
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ error: { message: `ACP agent unavailable: ${error.message}` } });
    }
});

// SPA fallback
app.use((req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('Serving index from:', indexPath);
    res.sendFile(indexPath);
});

app.use((err, req, res, next) => {
    console.error('🔥 Server error:', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🙂 Smiley OS v2.0 running at http://localhost:${PORT}`);
    console.log(`🔌 Gemini proxy:   POST /api/proxy`);
    console.log(`🕸️  Mesh-LLM proxy: POST /api/mesh`);
    console.log(`🤖 ACP proxy:      POST /api/acp-proxy`);
    console.log(`${'═'.repeat(60)}\n`);
});
