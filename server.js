const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

if (!GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not set in .env file');
    console.error('   Copy .env.example to .env and add your API key');
    process.exit(1);
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Proxy endpoint - replaces Cloudflare Worker
app.post('/api/proxy', async (req, res) => {
    const { modelName, geminiPayload } = req.body;

    if (!modelName || !geminiPayload) {
        return res.status(400).json({ 
            error: { message: 'Missing modelName or geminiPayload' } 
        });
    }

    try {
        const url = `${GEMINI_API_URL}/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        console.log(`📤 Calling Gemini ${modelName}...`);

        const response = await axios.post(url, geminiPayload, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`✅ Gemini response received`);
        res.json(response.data);

    } catch (error) {
        console.error('❌ Gemini API Error:', error.response?.data || error.message);
        
        const status = error.response?.status || 500;
        const message = error.response?.data?.error?.message || error.message;
        
        res.status(status).json({
            error: { message }
        });
    }
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('🔥 Server error:', err);
    res.status(500).json({ 
        error: { message: 'Internal server error' } 
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎉 Smiley OS running at http://localhost:${PORT}`);
    console.log(`📁 Serving from: ${__dirname}/public`);
    console.log(`🔌 API proxy: http://localhost:${PORT}/api/proxy`);
    console.log(`${'═'.repeat(60)}\n`);
});
