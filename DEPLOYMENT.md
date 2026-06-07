# Smiley OS Deployment Guide

## Quick Start Options

### 1. 🐳 Docker Compose (Recommended for Local Testing)

**Prerequisites:** Docker Desktop installed

```bash
# 1. Clone the repo
git clone https://github.com/smileiv/Smiley-os.git
cd Smiley-os
git checkout goose/self-hosted-setup

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env and add your Gemini API key
nano .env

# 4. Start with Docker Compose
docker-compose up
```

Visit: **http://localhost:3000**

**To stop:**
```bash
docker-compose down
```

---

### 2. ☁️ GitHub Codespaces (Cloud Browser IDE)

Run directly in your browser without installing anything locally:

**Steps:**
1. Go to: https://github.com/smileiv/Smiley-os
2. Click **Code** → **Codespaces** → **Create codespace on goose/self-hosted-setup**
3. Wait ~1 minute for environment to load
4. In terminal, run:
```bash
npm install
GEMINI_API_KEY=your_key_here npm start
```
5. Click notification "Open in Browser" when it appears
6. Your app opens at: **http://localhost-3000.app.github.dev**

**Advantages:**
- ✅ No local installation needed
- ✅ 120 free core-hours per month
- ✅ Full Linux terminal in browser
- ✅ Perfect while your iMac VPN builds

---

### 3. 🚀 Deploy to Render.com (Production Free Tier)

Permanent hosting for free with auto-deploys:

**Steps:**
1. Go to: https://render.com
2. Click **New +** → **Web Service**
3. Select **Deploy existing repository**
4. Choose: `smileiv/Smiley-os`
5. Settings:
   - **Branch:** `goose/self-hosted-setup`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
6. Add Environment Variables:
   - Key: `GEMINI_API_KEY`
   - Value: `your_api_key_here`
7. Click **Deploy Web Service**

**Your app will be live at:** `https://smiley-os.onrender.com`

**Advantages:**
- ✅ Free tier (750 hours/month)
- ✅ Auto-deploys on git push
- ✅ Always running
- ✅ Scales if needed

---

### 4. 🐳 Docker Image (Build Manually)

For complete control:

```bash
# Build image
docker build -t smiley-os:latest .

# Run container
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your_key_here \
  -e NODE_ENV=production \
  smiley-os:latest
```

Visit: **http://localhost:3000**

---

### 5. 📦 Traditional Node.js (No Docker)

```bash
git clone https://github.com/smileiv/Smiley-os.git
cd Smiley-os
git checkout goose/self-hosted-setup

npm install
GEMINI_API_KEY=your_key_here npm start
```

Visit: **http://localhost:3000**

---

## Comparison Table

| Method | Setup Time | Cost | Running Now? | Best For |
|--------|-----------|------|-------------|----------|
| Docker Compose | 5 min | Free | ✅ Yes | Local testing |
| Codespaces | 1 min | Free | ✅ Yes | Quick testing |
| Render.com | 3 min | Free | ✅ Yes | Production |
| Docker Manual | 10 min | Free | ✅ Yes | Control |
| Node.js Direct | 5 min | Free | ✅ Yes | Simple |

---

## Environment Variables

All deployment methods need: `GEMINI_API_KEY=your_key_here`

Get your key: https://aistudio.google.com/apikey

---

## Troubleshooting

### Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
docker-compose up -p 3001:3000
```

### API Key Not Working
- Verify it's set: `echo $GEMINI_API_KEY`
- Check for extra spaces
- Generate new key at https://aistudio.google.com/apikey

### Docker Issues
```bash
# Clear Docker cache
docker system prune -a

# Rebuild fresh
docker-compose down
docker-compose build --no-cache
docker-compose up
```

---

## Next Steps

1. **Now:** Pick one option above and test
2. **Later:** Use Render.com for permanent hosting
3. **When iMac Ready:** Switch to local hosting with VPN integration

---

## File Structure

```
Smiley-os/
├── Dockerfile              # Container image definition
├── docker-compose.yml      # Local development setup
├── server.js               # Express backend
├── package.json            # Dependencies
├── .env.example            # Config template
├── public/
│   └── index.html          # React app
└── DEPLOYMENT.md           # This file
```

---

🦆 Built with Goose | Ready to deploy anywhere!
