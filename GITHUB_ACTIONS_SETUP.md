# GitHub Actions Setup Guide

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it: `x-project` (or whatever you prefer)
4. Make it **Public** (required for free GitHub Actions)
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

## Step 2: Push Your Code

Run these commands in your terminal:

```bash
# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/x-project.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Add Secrets

1. Go to your GitHub repository
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions** in the left sidebar
4. Click **New repository secret**
5. Add these secrets one by one:

### Required Secrets (for X posting):
- **Name**: `TWITTER_APP_KEY`
  - **Value**: Your X App Key (from X Developer Portal)

- **Name**: `TWITTER_APP_SECRET`
  - **Value**: Your X App Secret (from X Developer Portal)

- **Name**: `TWITTER_ACCESS_TOKEN`
  - **Value**: Your X Access Token (from X Developer Portal)

- **Name**: `TWITTER_ACCESS_SECRET`
  - **Value**: Your X Access Secret (from X Developer Portal)

### Optional Secret (for AI generation):
- **Name**: `OPENROUTER_API_KEY`
  - **Value**: Your OpenRouter API key (if you want AI-generated posts)

## Step 4: Test the Workflow

1. Go to **Actions** tab in your GitHub repository
2. You should see "Daily X Post" workflow
3. Click on it → **Run workflow** → **Run workflow**
4. This will manually trigger a post to test everything

## Step 5: Verify It Works

1. Check the Actions tab for the workflow run
2. Click on the run to see detailed logs
3. Look for "Post to X" step - should show success
4. Check your X account for the new post

## Schedule

- **Automatic**: Posts daily at 9 AM UTC
- **Manual**: Can trigger anytime from Actions tab

## Troubleshooting

### Common Issues:

**Workflow not running:**
- Check if repository is public (required for free Actions)
- Verify secrets are added correctly
- Check Actions tab for error logs

**Posting fails:**
- Verify all 4 X API keys are correct
- Check X app permissions are "Read and write"
- Look at workflow logs for specific error messages

**AI not working:**
- Verify `OPENROUTER_API_KEY` is set
- Check OpenRouter account has credits

## Next Steps

Once working:
1. **Customize topics**: Edit the workflow file to change post topics
2. **Adjust schedule**: Change the cron schedule in the workflow
3. **Add variety**: Use the scheduler for random topics

## Files Created

- `.github/workflows/main.yml` - GitHub Actions workflow
- `GITHUB_ACTIONS_SETUP.md` - This setup guide
- `README.md` - Complete documentation 