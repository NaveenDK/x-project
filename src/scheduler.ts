import 'dotenv/config'
import pino from 'pino'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const log = pino({ transport: { target: 'pino-pretty' } })

const TOPICS = [
  'coding best practices',
  'developer productivity tips',
  'software engineering insights',
  'programming wisdom',
  'tech industry trends'
] as const

function getRandomTopic(): string {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)]!
}

async function postToX(topic?: string) {
  const selectedTopic: string = topic ?? getRandomTopic()
  const command = `npm run dev -- "${selectedTopic}"`
  
  try {
    log.info({ topic: selectedTopic }, 'Posting to X...')
    const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() })
    
    if (stdout) log.info(stdout)
    if (stderr) log.warn(stderr)
    
    log.info('Post completed successfully')
  } catch (error) {
    log.error({ error }, 'Failed to post to X')
  }
}

async function schedulePosts(intervalHours: number = 24) {
  const intervalMs = intervalHours * 60 * 60 * 1000
  
  log.info({ intervalHours }, 'Starting scheduled posts')
  
  // Post immediately
  await postToX()
  
  // Then schedule regular posts
  setInterval(async () => {
    await postToX()
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
  await postToX(topic)
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