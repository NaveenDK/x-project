#!/bin/bash
# Example cron script for automated X posting
# Add this to your crontab: 0 9 * * * /path/to/your/x-project/cron-example.sh

cd "$(dirname "$0")"
export $(cat .env | xargs)

# Post with AI generation (if OPENROUTER_API_KEY is set)
npm run dev -- "daily coding tip"

# Or post raw text
# npm run dev -- --raw "Good morning! Starting another day of coding. #developerlife" 