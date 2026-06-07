# Smiley OS Self-Hosted Setup Guide

## Quick Start (macOS iMac)

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Google Gemini API Key ([Get one free](https://aistudio.google.com/apikey))
- Terminal access

### 1️⃣ Clone & Install

```bash
cd ~/Projects  # or wherever you want to store it
git clone https://github.com/smileiv/Smiley-os.git
cd Smiley-os
git checkout goose/self-hosted-setup

npm install
```

### 2️⃣ Configure API Key

```bash
cp .env.example .env
```

Edit `.env` with your favorite editor:
```bash
nano .env
# or
open -a TextEdit .env
```

Paste your Gemini API key:
```
GEMINI_API_KEY=your-key-here
```

### 3️⃣ Start the Server

```bash
npm start
```

You should see:
```
════════════════════════════════════════════════════════════
🎉 Smiley OS running at http://localhost:3000
📁 Serving from: /path/to/Smiley-os/public
🔌 API proxy: http://localhost:3000/api/proxy
════════════════════════════════════════════════════════════
```

### 4️⃣ Open in Browser

Visit: **http://localhost:3000**

## Development Mode

With live reload:

```bash
npm install --save-dev nodemon  # one time only
npm run dev
```

Changes to `server.js` will auto-restart the server.

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser (http://localhost:3000)        │
│  ├─ React UI (index.html)               │
│  └─ Tailwind CSS + PDF.js               │
└─────────────────────────────────────────┘
           ↕ HTTP
┌─────────────────────────────────────────┐
│  Express Backend (server.js)            │
│  ├─ Static files serving                │
│  ├─ CORS handling                       │
│  └─ /api/proxy → Gemini API             │
└─────────────────────────────────────────┘
           ↕ HTTPS
┌─────────────────────────────────────────┐
│  Google Gemini API                      │
│  ├─ Flash Core (fast, cheap)            │
│  └─ Pro Core (powerful)                 │
└─────────────────────────────────────────┘
```

## Features

✅ **Command Module** - Chat with Gemini  
✅ **Hopper Module** - Ingest PDFs, ZIP files, folders  
✅ **Memory Banks** - Store and retrieve insights  
✅ **Utilities** - Phone number extraction, threat analysis  
✅ **Model Switching** - Flash ↔ Pro in real-time  

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill it (note the PID)
kill -9 <PID>

# Or use a different port
PORT=3001 npm start
```

### "Cannot find module" errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### API Key Issues

- Verify your key is set: `echo $GEMINI_API_KEY`
- Check it's pasted correctly (no extra spaces)
- Generate a new key at https://aistudio.google.com/apikey

### CORS Errors

The backend has CORS enabled for all origins. If issues persist:
1. Check browser console (F12 → Console tab)
2. Verify `server.js` is running
3. Check API key validity

## Production Deployment

For hosting on a server or cloud:

1. Set `NODE_ENV=production`
2. Use a process manager (PM2, systemd, etc.)
3. Configure environment variables securely
4. Use a reverse proxy (nginx, Apache)
5. Set up SSL/TLS certificates

Example with PM2:
```bash
npm install -g pm2
pm2 start server.js --name "smiley-os"
pm2 save
pm2 startup
```

## File Structure

```
Smiley-os/
├── server.js              # Express backend
├── package.json           # Dependencies
├── .env.example           # Config template
├── public/
│   └── index.html         # React app
└── README.md              # This file
```

## Support

- **Goose Docs**: https://goose-docs.ai/
- **Gemini API Docs**: https://ai.google.dev/
- **Express Docs**: https://expressjs.com/

---

🦆 **Built with Goose** - An open-source AI agent
