import 'dotenv/config'
import pino from 'pino'
import { z } from 'zod'
import OpenAI from 'openai'
import { TwitterApi } from 'twitter-api-v2'

const logOptions = process.env.NODE_ENV === 'production' 
  ? {} 
  : { transport: { target: 'pino-pretty' } }

const log = pino(logOptions)

const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  TWITTER_APP_KEY: z.string().optional(),
  TWITTER_APP_SECRET: z.string().optional(),
  TWITTER_ACCESS_TOKEN: z.string().optional(),
  TWITTER_ACCESS_SECRET: z.string().optional(),
})

const env = EnvSchema.parse(process.env)

const openRouterClient = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://local.dev/x-project',
        'X-Title': 'x-project',
      },
    })
  : null

function truncateForX(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 280 ? normalized.slice(0, 280) : normalized
}

function getRawFromArgs(args: string[]): string | null {
  const idx = args.indexOf('--raw')
  if (idx === -1) return null
  return args.slice(idx + 1).join(' ').trim() || null
}

async function generatePost(topic?: string): Promise<string> {
  const subject = topic || 'a useful dev tip'

  if (!openRouterClient) {
    const fallback = `Tip: ${subject}. Keep it short, specific, and actionable. Focus on one insight, avoid fluff.`
    return truncateForX(fallback)
  }

  const prompt = `Write a concise X post (<=260 chars) about ${subject}. No emojis. Minimal or no hashtags. Provide one actionable insight.`

  const response = await openRouterClient.chat.completions.create({
    model: 'openrouter/auto',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 180,
  })

  const text = response.choices?.[0]?.message?.content?.trim() || ''
  return truncateForX(text)
}

function createTwitterClient() {
  const allHaveValues = [
    env.TWITTER_APP_KEY,
    env.TWITTER_APP_SECRET,
    env.TWITTER_ACCESS_TOKEN,
    env.TWITTER_ACCESS_SECRET,
  ].every(Boolean)

  if (!allHaveValues) return null

  return new TwitterApi({
    appKey: env.TWITTER_APP_KEY as string,
    appSecret: env.TWITTER_APP_SECRET as string,
    accessToken: env.TWITTER_ACCESS_TOKEN as string,
    accessSecret: env.TWITTER_ACCESS_SECRET as string,
  })
}

async function postToX(status: string) {
  const client = createTwitterClient()
  if (!client) {
    log.warn('No X API credentials found. Dry-run only. Generated: %s', status)
    return
  }

  const rw = client.readWrite
  const res = await rw.v2.tweet(status)
  log.info({ id: res.data.id }, 'Posted to X')
}

async function main() {
  const args = process.argv.slice(2)
  const raw = getRawFromArgs(args)

  let postText: string
  if (raw) {
    postText = truncateForX(raw)
    log.info('Using raw text from --raw flag')
  } else {
    const topic = args.filter((a) => a !== '--raw').join(' ') || undefined
    postText = await generatePost(topic)
  }

  log.info({ postText }, 'Prepared post text')
  if (postText) await postToX(postText)
}

main().catch((error) => {
  log.error({ error }, 'Fatal error')
  process.exit(1)
})
