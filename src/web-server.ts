import 'dotenv/config'
import express from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import pino from 'pino'
import { TwitterApi } from 'twitter-api-v2'
import OpenAI from 'openai'
import nodemailer from 'nodemailer'

const logOptions = process.env.NODE_ENV === 'production' 
  ? {} 
  : { transport: { target: 'pino-pretty' } }

const log = pino(logOptions)

const app = express()
const PORT = process.env.PORT || 3031

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Environment validation
const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  TWITTER_APP_KEY: z.string().optional(),
  TWITTER_APP_SECRET: z.string().optional(),
  TWITTER_ACCESS_TOKEN: z.string().optional(),
  TWITTER_ACCESS_SECRET: z.string().optional(),
  // Email notifications (optional)
  EMAIL_USER: z.string().optional(), // Gmail address
  EMAIL_PASS: z.string().optional(), // Gmail app password
  EMAIL_TO: z.string().optional(),   // Email address to receive notifications
})

const env = EnvSchema.parse(process.env)

// Initialize clients
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

// Email transporter
const emailTransporter = env.EMAIL_USER && env.EMAIL_PASS
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    })
  : null

async function sendEmailNotification(post: PendingPost) {
  if (!emailTransporter || !env.EMAIL_TO) {
    log.info('Email notifications not configured - skipping email')
    return
  }

  try {
    const mailOptions = {
      from: env.EMAIL_USER,
      to: env.EMAIL_TO,
      subject: '🐦 New X Post Ready for Approval',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1da1f2;">🐦 X Post Manager - New Post Ready</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Generated Content:</h3>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 15px;">${post.content}</p>
            
            <div style="font-size: 14px; color: #666;">
              <strong>Topic:</strong> ${post.topic || 'No topic specified'}<br>
              <strong>Generated:</strong> ${new Date(post.timestamp).toLocaleString()}<br>
              <strong>Status:</strong> <span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Pending Approval</span>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:3031" style="background: #1da1f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              🎯 Review & Approve Post
            </a>
          </div>
          
          <div style="font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px;">
            <p>This email was sent automatically by your X Post Manager.</p>
            <p>To stop receiving these notifications, remove the EMAIL_TO environment variable.</p>
          </div>
        </div>
      `,
    }

    await emailTransporter.sendMail(mailOptions)
    log.info({ postId: post.id, email: env.EMAIL_TO }, 'Email notification sent')
  } catch (error) {
    log.error({ error, postId: post.id }, 'Failed to send email notification')
  }
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

// Data storage (in production, use a database)
interface Topic {
  id: string
  name: string
  createdAt: Date
  isActive: boolean
}

interface PendingPost {
  id: string
  content: string
  topic?: string
  timestamp: Date
  status: 'pending' | 'approved' | 'rejected'
  scheduledFor?: Date
}

interface Schedule {
  frequency: 'daily' | 'weekly' | 'monthly'
  time: string // HH:MM format
  timezone: string
  isActive: boolean
}

// In-memory storage (replace with database in production)
const topics = new Map<string, Topic>()
const pendingPosts = new Map<string, PendingPost>()
const schedule: Schedule = {
  frequency: 'daily',
  time: '09:00',
  timezone: 'UTC',
  isActive: true
}

// Scheduling functionality
let scheduleInterval: NodeJS.Timeout | null = null

function startScheduler() {
  // Clear existing scheduler
  if (scheduleInterval) {
    clearInterval(scheduleInterval)
  }

  if (!schedule.isActive) {
    log.info('Scheduler is disabled')
    return
  }

  // Calculate next run time based on schedule
  const now = new Date()
  const [hours, minutes] = schedule.time.split(':').map(Number)
  
  // Convert to user's timezone
  const userTime = new Date(now.toLocaleString("en-US", {timeZone: schedule.timezone}))
  const nextRun = new Date(userTime)
  nextRun.setHours(hours || 9, minutes || 0, 0, 0)
  
  // If time has passed today, schedule for tomorrow
  if (nextRun <= userTime) {
    nextRun.setDate(nextRun.getDate() + 1)
  }

  const delay = nextRun.getTime() - userTime.getTime()
  
  log.info({ 
    nextRun: nextRun.toISOString(), 
    delay: delay / 1000 / 60, // minutes
    timezone: schedule.timezone,
    frequency: schedule.frequency 
  }, 'Scheduling next post generation')

  // Schedule the first run
  setTimeout(async () => {
    await generateScheduledPost()
    // Then set up recurring schedule
    setupRecurringSchedule()
  }, delay)
}

function setupRecurringSchedule() {
  if (!schedule.isActive) return

  let intervalMs: number
  switch (schedule.frequency) {
    case 'daily':
      intervalMs = 24 * 60 * 60 * 1000 // 24 hours
      break
    case 'weekly':
      intervalMs = 7 * 24 * 60 * 60 * 1000 // 7 days
      break
    case 'monthly':
      intervalMs = 30 * 24 * 60 * 60 * 1000 // 30 days (approximate)
      break
    default:
      intervalMs = 24 * 60 * 60 * 1000
  }

  scheduleInterval = setInterval(async () => {
    await generateScheduledPost()
  }, intervalMs)

  log.info({ intervalMs: intervalMs / 1000 / 60 / 60 }, 'Recurring schedule set up')
}

async function generateScheduledPost() {
  try {
    // Get active topics
    const activeTopics = Array.from(topics.values()).filter(topic => topic.isActive)
    
    if (activeTopics.length === 0) {
      log.warn('No active topics found for scheduled post generation')
      return
    }
    
    // Pick a random active topic
    const randomTopic = activeTopics[Math.floor(Math.random() * activeTopics.length)]!
    const content = await generatePost(randomTopic.name)
    
    // Create pending post
    const postId = Date.now().toString()
    const post: PendingPost = {
      id: postId,
      content,
      topic: randomTopic.name,
      timestamp: new Date(),
      status: 'pending'
    }
    
    pendingPosts.set(postId, post)
    
    log.info({ 
      postId, 
      topic: randomTopic.name, 
      content,
      scheduledTime: new Date().toISOString()
    }, 'Generated scheduled post')
    
    // Send email notification
    await sendEmailNotification(post)
    
  } catch (error) {
    log.error({ error }, 'Error generating scheduled post')
  }
}

async function generatePost(topic?: string): Promise<string> {
  const subject = topic || 'a useful dev tip'

  if (!openRouterClient) {
    const fallback = `Tip: ${subject}. Keep it short, specific, and actionable. Focus on one insight, avoid fluff.`
    return fallback.length > 280 ? fallback.slice(0, 279) : fallback
  }

  const prompt = `Write a concise X post (<=260 chars) about ${subject}. No emojis. Minimal or no hashtags. Provide one actionable insight.`

  const response = await openRouterClient.chat.completions.create({
    model: 'openrouter/auto',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 180,
  })

  const text = response.choices?.[0]?.message?.content?.trim() || ''
  return text.length > 280 ? text.slice(0, 279) : text
}

async function postToX(content: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = createTwitterClient()
  if (!client) {
    return { success: false, error: 'X API credentials not configured' }
  }

  try {
    const rw = client.readWrite
    const res = await rw.v2.tweet(content)
    return { success: true, id: res.data.id }
  } catch (error) {
    log.error({ error }, 'Failed to post to X')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Routes
app.get('/', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>X Post Manager</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            color: #1da1f2;
            margin-bottom: 30px;
            text-align: center;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #1da1f2;
            padding-bottom: 10px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #333;
        }
        input[type="text"], textarea, select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e8ed;
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
        }
        textarea {
            height: 120px;
            resize: vertical;
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        button {
            flex: 1;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #1da1f2;
            color: white;
        }
        .btn-primary:hover {
            background: #1991db;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background: #5a6268;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover {
            background: #218838;
        }
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background: #c82333;
        }
        .btn-warning {
            background: #ffc107;
            color: #212529;
        }
        .btn-warning:hover {
            background: #e0a800;
        }
        .topic-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .topic-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #1da1f2;
            position: relative;
        }
        .topic-item.active {
            border-left-color: #28a745;
        }
        .topic-item.inactive {
            border-left-color: #6c757d;
            opacity: 0.6;
        }
        .topic-name {
            font-weight: 600;
            margin-bottom: 5px;
        }
        .topic-date {
            font-size: 12px;
            color: #666;
        }
        .topic-actions {
            position: absolute;
            top: 10px;
            right: 10px;
        }
        .post-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #1da1f2;
        }
        .post-content {
            font-size: 16px;
            margin-bottom: 10px;
            line-height: 1.5;
        }
        .post-meta {
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
        }
        .status {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
        }
        .status.pending {
            background: #fff3cd;
            color: #856404;
        }
        .status.approved {
            background: #d4edda;
            color: #155724;
        }
        .status.rejected {
            background: #f8d7da;
            color: #721c24;
        }
        .notification {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        @media (max-width: 768px) {
            .grid-2 {
                grid-template-columns: 1fr;
            }
            .button-group {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐦 X Post Manager</h1>
        
        <!-- Schedule Settings -->
        <div class="section">
            <h2>📅 Schedule Settings</h2>
            <div class="grid-2">
                <div class="form-group">
                    <label for="frequency">Posting Frequency:</label>
                    <select id="frequency">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="time">Posting Time:</label>
                    <input type="time" id="time" value="09:00">
                </div>
            </div>
            <div class="form-group">
                <label for="timezone">Timezone:</label>
                <select id="timezone">
                    <option value="UTC">UTC</option>
                    <option value="Pacific/Auckland">New Zealand (Auckland)</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                </select>
            </div>
            <button class="btn-primary" onclick="updateSchedule()">Update Schedule</button>
        </div>

        <!-- Topic Management -->
        <div class="section">
            <h2>📝 Topic Management</h2>
            <div class="form-group">
                <label for="newTopic">Add New Topic:</label>
                <input type="text" id="newTopic" placeholder="e.g., coding tips, productivity, developer advice">
            </div>
            <div class="button-group">
                <button class="btn-primary" onclick="addTopic()">Add Topic</button>
                <button class="btn-warning" onclick="generatePostFromTopics()">🤖 Generate Post from Topics</button>
            </div>
            
            <div class="topic-list" id="topicList"></div>
        </div>

        <!-- Pending Posts -->
        <div class="section">
            <h2>⏳ Pending Posts</h2>
            <div id="pendingPosts"></div>
        </div>

        <!-- Recent Posts -->
        <div class="section">
            <h2>📊 Recent Posts</h2>
            <div id="recentPosts"></div>
        </div>
    </div>

    <script>
        // Load data on page load
        loadTopics();
        loadPendingPosts();
        loadRecentPosts();
        loadSchedule();
        
        async function addTopic() {
            const topicName = document.getElementById('newTopic').value.trim();
            if (!topicName) {
                alert('Please enter a topic name');
                return;
            }
            
            try {
                const response = await fetch('/api/topics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: topicName })
                });
                
                const data = await response.json();
                if (data.success) {
                    document.getElementById('newTopic').value = '';
                    loadTopics();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error adding topic: ' + error.message);
            }
        }
        
        async function toggleTopic(topicId) {
            try {
                const response = await fetch(\`/api/topics/\${topicId}/toggle\`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                if (data.success) {
                    loadTopics();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error toggling topic: ' + error.message);
            }
        }
        
        async function deleteTopic(topicId) {
            if (!confirm('Are you sure you want to delete this topic?')) return;
            
            try {
                const response = await fetch(\`/api/topics/\${topicId}\`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                if (data.success) {
                    loadTopics();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error deleting topic: ' + error.message);
            }
        }
        
        async function approvePost(postId) {
            try {
                const response = await fetch(\`/api/posts/\${postId}/approve\`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('✅ Post approved and sent to X!');
                    loadPendingPosts();
                    loadRecentPosts();
                } else {
                    alert('❌ Error: ' + data.error);
                }
            } catch (error) {
                alert('Error approving post: ' + error.message);
            }
        }
        
        async function rejectPost(postId) {
            if (!confirm('Are you sure you want to reject this post?')) return;
            
            try {
                const response = await fetch(\`/api/posts/\${postId}/reject\`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                if (data.success) {
                    loadPendingPosts();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error rejecting post: ' + error.message);
            }
        }
        
        async function updateSchedule() {
            const frequency = document.getElementById('frequency').value;
            const time = document.getElementById('time').value;
            const timezone = document.getElementById('timezone').value;
            
            try {
                const response = await fetch('/api/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frequency, time, timezone })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('✅ Schedule updated!');
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error updating schedule: ' + error.message);
            }
        }
        
        async function loadTopics() {
            try {
                const response = await fetch('/api/topics');
                const data = await response.json();
                
                const container = document.getElementById('topicList');
                container.innerHTML = '';
                
                data.topics.forEach(topic => {
                    const topicElement = document.createElement('div');
                    topicElement.className = \`topic-item \${topic.isActive ? 'active' : 'inactive'}\`;
                    topicElement.innerHTML = \`
                        <div class="topic-name">\${topic.name}</div>
                        <div class="topic-date">Added: \${new Date(topic.createdAt).toLocaleDateString()}</div>
                        <div class="topic-actions">
                            <button onclick="toggleTopic('\${topic.id}')" class="btn-secondary" style="padding: 5px 10px; font-size: 12px;">
                                \${topic.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button onclick="deleteTopic('\${topic.id}')" class="btn-danger" style="padding: 5px 10px; font-size: 12px;">
                                Delete
                            </button>
                        </div>
                    \`;
                    container.appendChild(topicElement);
                });
            } catch (error) {
                console.error('Error loading topics:', error);
            }
        }
        
        async function loadPendingPosts() {
            try {
                const response = await fetch('/api/posts?status=pending');
                const data = await response.json();
                
                const container = document.getElementById('pendingPosts');
                container.innerHTML = '';
                
                if (data.posts.length === 0) {
                    container.innerHTML = '<p>No pending posts.</p>';
                    return;
                }
                
                data.posts.forEach(post => {
                    const postElement = document.createElement('div');
                    postElement.className = 'post-item';
                    postElement.innerHTML = \`
                        <div class="post-content">\${post.content}</div>
                        <div class="post-meta">
                            \${new Date(post.timestamp).toLocaleString()} • 
                            <span class="status \${post.status}">\${post.status}</span>
                            \${post.topic ? ' • Topic: ' + post.topic : ''}
                        </div>
                        <div class="button-group">
                            <button class="btn-success" onclick="approvePost('\${post.id}')">✅ Approve & Post</button>
                            <button class="btn-danger" onclick="rejectPost('\${post.id}')">❌ Reject</button>
                        </div>
                    \`;
                    container.appendChild(postElement);
                });
            } catch (error) {
                console.error('Error loading pending posts:', error);
            }
        }
        
        async function loadRecentPosts() {
            try {
                const response = await fetch('/api/posts?status=approved');
                const data = await response.json();
                
                const container = document.getElementById('recentPosts');
                container.innerHTML = '';
                
                data.posts.slice(0, 5).forEach(post => {
                    const postElement = document.createElement('div');
                    postElement.className = 'post-item';
                    postElement.innerHTML = \`
                        <div class="post-content">\${post.content}</div>
                        <div class="post-meta">
                            \${new Date(post.timestamp).toLocaleString()} • 
                            <span class="status \${post.status}">\${post.status}</span>
                        </div>
                    \`;
                    container.appendChild(postElement);
                });
            } catch (error) {
                console.error('Error loading recent posts:', error);
            }
        }
        
        async function loadSchedule() {
            try {
                const response = await fetch('/api/schedule');
                const data = await response.json();
                
                if (data.schedule) {
                    document.getElementById('frequency').value = data.schedule.frequency;
                    document.getElementById('time').value = data.schedule.time;
                    document.getElementById('timezone').value = data.schedule.timezone;
                }
            } catch (error) {
                console.error('Error loading schedule:', error);
            }
        }
        
        async function generatePostFromTopics() {
            try {
                const response = await fetch('/api/generate-post', {
                    method: 'POST'
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('✅ Post generated! Check "Pending Posts" section.');
                    loadPendingPosts();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error generating post: ' + error.message);
            }
        }
    </script>
</body>
</html>`
  res.send(html)
})

// API Routes
app.post('/api/topics', async (req: Request, res: Response) => {
  try {
    const { name } = req.body
    
    if (!name) {
      return res.json({ success: false, error: 'Topic name required' })
    }
    
    const topicId = Date.now().toString()
    const topic: Topic = {
      id: topicId,
      name,
      createdAt: new Date(),
      isActive: true
    }
    
    topics.set(topicId, topic)
    log.info({ topicId, name }, 'Topic added')
    res.json({ success: true, topic })
  } catch (error) {
    log.error({ error }, 'Error adding topic')
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.get('/api/topics', (req: Request, res: Response) => {
  const topicsList = Array.from(topics.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  res.json({ topics: topicsList })
})

app.post('/api/topics/:id/toggle', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.json({ success: false, error: 'Topic ID required' })
    }
    const topic = topics.get(id)
    
    if (!topic) {
      return res.json({ success: false, error: 'Topic not found' })
    }
    
    topic.isActive = !topic.isActive
    topics.set(id, topic)
    
    log.info({ topicId: id, isActive: topic.isActive }, 'Topic toggled')
    res.json({ success: true, topic })
  } catch (error) {
    log.error({ error }, 'Error toggling topic')
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.delete('/api/topics/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.json({ success: false, error: 'Topic ID required' })
    }
    const deleted = topics.delete(id)
    
    if (!deleted) {
      return res.json({ success: false, error: 'Topic not found' })
    }
    
    log.info({ topicId: id }, 'Topic deleted')
    res.json({ success: true })
  } catch (error) {
    log.error({ error }, 'Error deleting topic')
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.post('/api/schedule', (req: Request, res: Response) => {
  try {
    const { frequency, time, timezone } = req.body
    
    if (!frequency || !time || !timezone) {
      return res.json({ success: false, error: 'Frequency, time, and timezone required' })
    }
    
    schedule.frequency = frequency as 'daily' | 'weekly' | 'monthly'
    schedule.time = time
    schedule.timezone = timezone
    
    log.info({ frequency, time, timezone }, 'Schedule updated')
    
    // Restart scheduler with new settings
    startScheduler()
    
    res.json({ success: true, schedule })
  } catch (error) {
    log.error({ error }, 'Error updating schedule')
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.get('/api/schedule', (req: Request, res: Response) => {
  res.json({ schedule })
})

app.get('/api/posts', (req: Request, res: Response) => {
  const { status } = req.query
  let posts = Array.from(pendingPosts.values())
  
  if (status && typeof status === 'string') {
    posts = posts.filter(post => post.status === status)
  }
  
  posts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  res.json({ posts })
})

app.post('/api/posts/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.json({ success: false, error: 'Post ID required' })
    }
    const post = pendingPosts.get(id)
    
    if (!post) {
      return res.json({ success: false, error: 'Post not found' })
    }
    
    const result = await postToX(post.content)
    
    if (result.success) {
      post.status = 'approved'
      pendingPosts.set(id, post)
      
      log.info({ postId: id, content: post.content }, 'Post approved and sent to X')
      res.json({ success: true, id: result.id })
    } else {
      res.json({ success: false, error: result.error })
    }
  } catch (error) {
    log.error({ error }, 'Error approving post')
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.post('/api/posts/:id/reject', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.json({ success: false, error: 'Post ID required' })
    }
    const post = pendingPosts.get(id)
    
    if (!post) {
      return res.json({ success: false, error: 'Post not found' })
    }
    
    post.status = 'rejected'
    pendingPosts.set(id, post)
    
    log.info({ postId: id }, 'Post rejected')
    res.json({ success: true })
  } catch (error) {
    log.error({ error }, 'Error rejecting post')
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.post('/api/generate-post', async (req: Request, res: Response) => {
  try {
    // Get active topics
    const activeTopics = Array.from(topics.values()).filter(topic => topic.isActive)
    
    if (activeTopics.length === 0) {
      return res.json({ success: false, error: 'No active topics found. Please add and enable some topics first.' })
    }
    
    // Pick a random active topic
    const randomTopic = activeTopics[Math.floor(Math.random() * activeTopics.length)]!
    const content = await generatePost(randomTopic.name)
    
    // Create pending post
    const postId = Date.now().toString()
    const post: PendingPost = {
      id: postId,
      content,
      topic: randomTopic.name,
      timestamp: new Date(),
      status: 'pending'
    }
    
    pendingPosts.set(postId, post)
    
    log.info({ postId, topic: randomTopic.name, content }, 'Generated post from topic')
    
    // Send email notification
    await sendEmailNotification(post)
    
    res.json({ success: true, post })
  } catch (error) {
    log.error({ error }, 'Error generating post')
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Start server
app.listen(PORT, () => {
  log.info({ port: PORT }, 'Web server started')
  startScheduler() // Start scheduler on server start
}) 