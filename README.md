# X Project - Automated Posting

A Node.js app that generates and posts content to X (Twitter) using AI or manual input.

## Features

- 🤖 AI-powered content generation (OpenRouter)
- 📝 Manual posting with `--raw` flag
- ⏰ Multiple automation options
- 🔄 Fallback content when AI unavailable
- 📊 Comprehensive logging

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   ```

3. **Test posting**
   ```bash
   # Post with AI (if OPENROUTER_API_KEY set)
   npm run dev -- "coding tips"
   
   # Post exact text
   npm run dev -- --raw "Hello world from my script!"
   ```

## Environment Variables

```bash
# Required for X posting
TWITTER_APP_KEY=your_app_key
TWITTER_APP_SECRET=your_app_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# Optional for AI generation
OPENROUTER_API_KEY=your_openrouter_key
```

## Automation Options

### 1. GitHub Actions (Recommended)

**Setup:**
1. Fork this repo
2. Add secrets in GitHub: Settings → Secrets and variables → Actions
3. Add your `.env` variables as secrets

**Usage:**
- **Automatic**: Runs daily at 9 AM UTC
- **Manual**: Go to Actions → "Daily X Post" → "Run workflow"

**Files:**
- `.github/workflows/daily-post.yml`

### 2. Local Cron Job

**Setup:**
1. Make script executable: `chmod +x cron-example.sh`
2. Edit `cron-example.sh` with your preferred topic
3. Add to crontab: `crontab -e`

**Example crontab:**
```bash
# Post daily at 9 AM
0 9 * * * /path/to/your/x-project/cron-example.sh

# Post every 6 hours
0 */6 * * * /path/to/your/x-project/cron-example.sh
```

**Files:**
- `cron-example.sh`

### 3. Node.js Scheduler

**Setup:**
```bash
# Post every 6 hours
npm run scheduler -- --schedule 6

# Post once with topic
npm run scheduler -- --post-now "coding tips"

# Post once with random topic
npm run scheduler -- --post-now
```

**Features:**
- Continuous scheduling
- Random topic selection
- Configurable intervals

**Files:**
- `src/scheduler.ts`

### 4. Vercel Cron (Alternative)

**Setup:**
1. Deploy to Vercel
2. Add `vercel.json` with cron configuration
3. Set environment variables in Vercel dashboard

**Example `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/post",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## Usage Examples

### Manual Posting
```bash
# AI-generated post about coding
npm run dev -- "coding best practices"

# Exact text post
npm run dev -- --raw "Just deployed my new app! 🚀"

# Random topic (uses fallback if no AI)
npm run dev
```

### Automated Posting
```bash
# Start scheduler (posts every 24 hours)
npm run scheduler -- --schedule 24

# Post once now
npm run scheduler -- --post-now "daily update"

# Post every 6 hours
npm run scheduler -- --schedule 6
```

## Content Generation

### With OpenRouter AI
- Dynamic, context-aware content
- Varied responses each time
- X-optimized (no emojis, minimal hashtags)
- Cost: $5/month free credits

### Without AI (Fallback)
- Static template: `"Tip: {topic}. Keep it short, specific, and actionable. Focus on one insight, avoid fluff."`
- Always works, no external dependencies
- Predictable content

### Raw Mode
- Posts exact text you provide
- Bypasses all generation
- Complete control over content

## Troubleshooting

### Common Issues

**403 Error (Not allowed to create Tweet)**
- Check app permissions are set to "Read and write"
- Regenerate tokens after changing permissions

**401 Error (Unauthorized)**
- Verify all 4 X API keys are correct
- Ensure keys match the current app

**AI not working**
- Check `OPENROUTER_API_KEY` is set
- Verify OpenRouter account has credits

### Logs
- All actions are logged with timestamps
- Check console output for detailed information
- Use `pino-pretty` for formatted logs

## Development

### Scripts
```bash
npm run dev          # Run with tsx (development)
npm run build        # Build TypeScript
npm run start        # Run built version
npm run scheduler    # Run scheduler
```

### Project Structure
```
x-project/
├── src/
│   ├── index.ts     # Main posting logic
│   └── scheduler.ts # Automation scheduler
├── .github/         # GitHub Actions
├── cron-example.sh  # Cron script
└── README.md        # This file
```

## License

ISC 