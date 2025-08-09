import 'dotenv/config'
import pino from 'pino'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const logOptions = process.env.NODE_ENV === 'production' 
  ? {} 
  : { transport: { target: 'pino-pretty' } }

const log = pino(logOptions)

// This would be replaced with actual database calls in production
const topics = new Map<string, { id: string; name: string; isActive: boolean }>()
const pendingPosts = new Map<string, { id: string; content: string; topic?: string; timestamp: Date; status: string }>()

async function generatePost(topic?: string): Promise<string> {
  const subject = topic || 'a useful dev tip'

  // This would call the actual AI service
  const fallback = `Tip: ${subject}. Keep it short, specific, and actionable. Focus on one insight, avoid fluff.`
  return fallback.length > 280 ? fallback.slice(0, 279) : fallback
}

async function createPendingPost(topic?: string) {
  const content = await generatePost(topic)
  const postId = Date.now().toString()
  
  const post: { id: string; content: string; topic?: string; timestamp: Date; status: string } = {
    id: postId,
    content,
    timestamp: new Date(),
    status: 'pending'
  }
  
  if (topic) {
    post.topic = topic
  }
  
  pendingPosts.set(postId, post)
  log.info({ postId, topic, content }, 'Created pending post')
  return post
}

async function schedulePosts(intervalHours: number = 24) {
  const intervalMs = intervalHours * 60 * 60 * 1000
  
  log.info({ intervalHours }, 'Starting scheduled posts')
  
  // Generate initial post
  await createPendingPost()
  
  // Then schedule regular posts
  setInterval(async () => {
    await createPendingPost()
  }, intervalMs)
}

// CLI usage
if (process.argv.includes('--schedule')) {
  const scheduleIndex = process.argv.indexOf('--schedule')
  const hours = scheduleIndex !== -1 && process.argv[scheduleIndex + 1] 
    ? parseInt(process.argv[scheduleIndex + 1]!) 
    : 24
  schedulePosts(hours)
} else if (process.argv.includes('--post-now')) {
  const postNowIndex = process.argv.indexOf('--post-now')
  const topic = postNowIndex !== -1 && process.argv[postNowIndex + 1] 
    ? process.argv[postNowIndex + 1] 
    : undefined
  createPendingPost(topic)
} else {
  log.info(`
Usage:
  npm run scheduler -- --schedule [hours]  # Run continuous scheduler
  npm run scheduler -- --post-now [topic]  # Post once with optional topic
  
Examples:
  npm run scheduler -- --schedule 6        # Post every 6 hours
  npm run scheduler -- --post-now "coding tips"
  `)
} 