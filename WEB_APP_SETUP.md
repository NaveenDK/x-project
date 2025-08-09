# Web App Setup Guide

## Overview

This web app provides a user-friendly interface to approve posts before they're sent to X. You can:

- 🤖 **Generate AI content** with topics
- 👁️ **Preview posts** before sending
- ✅ **Approve/reject** posts with one click
- 📱 **Mobile-friendly** interface
- 🌐 **Hosted web URL** for easy access

## Local Development

### 1. Start the web server

```bash
# Install dependencies (if not already done)
npm install

# Start the web server
npm run web
```

### 2. Access the web interface

Open your browser and go to: `http://localhost:3031`

## Deployment Options

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Set environment variables** in Vercel dashboard:
   - `TWITTER_APP_KEY`
   - `TWITTER_APP_SECRET`
   - `TWITTER_ACCESS_TOKEN`
   - `TWITTER_ACCESS_SECRET`
   - `OPENROUTER_API_KEY` (optional)

4. **Access your app**: `https://your-app.vercel.app`

### Option 2: Netlify

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**:
   - Drag and drop the `dist` folder to Netlify
   - Or connect your GitHub repository

3. **Set environment variables** in Netlify dashboard

### Option 3: Railway

1. **Connect GitHub repository** to Railway
2. **Set environment variables** in Railway dashboard
3. **Deploy automatically** on push

## Features

### 🤖 AI Content Generation
- Enter a topic and click "Generate AI Post"
- Uses OpenRouter for dynamic content
- Falls back to template if no AI key

### 👁️ Preview System
- Preview posts before sending
- Character count display
- Mobile-responsive design

### ✅ Approval Workflow
- One-click approval
- Instant posting to X
- Success/error feedback

### 📊 Post History
- View recent posts
- Post timestamps
- Status tracking

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

## Usage

### 1. Generate AI Content
1. Enter a topic (e.g., "coding tips")
2. Click "🤖 Generate AI Post"
3. Review the generated content
4. Click "👁️ Preview" to see how it looks

### 2. Manual Content
1. Enter your post content directly
2. Click "👁️ Preview" to review
3. Make any edits if needed

### 3. Approve and Post
1. Review the preview
2. Click "✅ Approve & Post" to send to X
3. Get instant feedback on success/failure

## Mobile Access

The web interface is fully responsive and works great on mobile devices. Simply:

1. **Deploy to Vercel/Netlify**
2. **Bookmark the URL** on your phone
3. **Access anytime** to approve posts

## Security

- **Environment variables** are secure
- **No data stored** permanently (in-memory only)
- **HTTPS required** for production
- **No authentication** (add your own if needed)

## Customization

### Styling
Edit the CSS in `src/web-server.ts` to match your brand:
- Colors (currently uses X blue: `#1da1f2`)
- Fonts
- Layout
- Mobile responsiveness

### Features
Add new features by modifying:
- `src/web-server.ts` - Backend logic
- HTML/CSS in the route - Frontend interface
- API endpoints - New functionality

## Troubleshooting

### Common Issues

**Web server won't start**:
- Check if port 3000 is available
- Verify all dependencies are installed
- Check environment variables

**Posts not sending**:
- Verify X API credentials
- Check network connectivity
- Review error logs

**AI not working**:
- Verify OpenRouter API key
- Check account credits
- Review API limits

## Next Steps

1. **Deploy to Vercel** for easy hosting
2. **Set up environment variables**
3. **Test the approval workflow**
4. **Bookmark the URL** on your phone
5. **Start approving posts!**

## Support

For issues or questions:
1. Check the logs in your hosting platform
2. Verify environment variables
3. Test locally first
4. Review the troubleshooting section 