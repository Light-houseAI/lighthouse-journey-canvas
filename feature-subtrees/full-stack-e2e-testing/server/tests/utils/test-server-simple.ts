// Simple test server for API testing
import express from 'express'
import session from 'express-session'
import './auth' // Import to get session type declarations

const app = express()
const PORT = process.env.PORT || 3000

// Set test environment defaults
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'test-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}))

// Test endpoints for API testing
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Journey Canvas API Test Server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: [
      'GET /',
      'GET /api/health',
      'POST /api/signup',
      'POST /api/signin',
      'POST /api/logout',
      'GET /api/me',
      'POST /api/profile',
      'GET /api/profile',
      'POST /api/ai/chat',
      'POST /api/ai/extract-skills',
      'GET /api/skills',
      'POST /api/milestones',
      'GET /api/milestones'
    ]
  })
})

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Journey Canvas API is running',
    timestamp: new Date().toISOString()
  })
})

// Mock authentication endpoints
app.post('/api/signup', (req, res) => {
  const { email, password } = req.body
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }
  
  // Mock user creation
  const mockUser = {
    id: 1,
    email,
    hasCompletedOnboarding: false,
    createdAt: new Date().toISOString()
  }
  
  // Set session
  req.session.user = mockUser
  
  res.json(mockUser)
})

app.post('/api/signin', (req, res) => {
  const { email, password } = req.body
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }
  
  // Mock authentication
  const mockUser = {
    id: 1,
    email,
    hasCompletedOnboarding: false,
    createdAt: new Date().toISOString()
  }
  
  // Set session
  req.session.user = mockUser
  
  res.json(mockUser)
})

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' })
    }
    res.json({ message: 'Logged out successfully' })
  })
})

app.get('/api/me', (req, res) => {
  const user = req.session.user
  
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }
  
  res.json(user)
})

// Mock profile endpoints
app.post('/api/profile', (req, res) => {
  const user = req.session.user
  
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }
  
  const profile = {
    id: 1,
    userId: user.id,
    username: req.body.username || 'testuser',
    filteredData: req.body.filteredData || {},
    createdAt: new Date().toISOString()
  }
  
  res.json(profile)
})

app.get('/api/profile', (req, res) => {
  const user = req.session.user
  
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }
  
  const mockProfile = {
    id: 1,
    userId: user.id,
    username: 'testuser',
    filteredData: {
      name: 'Test User',
      headline: 'Software Engineer',
      experiences: [
        {
          title: 'Senior Software Engineer',
          company: 'Google',
          start: '2023-01',
          end: 'present'
        }
      ],
      education: [
        {
          school: 'Stanford University',
          degree: 'BS Computer Science'
        }
      ],
      skills: ['React', 'TypeScript', 'Node.js']
    },
    createdAt: new Date().toISOString()
  }
  
  res.json(mockProfile)
})

// Mock AI endpoints
app.post('/api/ai/chat', (req, res) => {
  const { message, userInterest } = req.body
  
  if (!message) {
    return res.status(400).json({ message: 'Message is required' })
  }
  
  // Simulate streaming response
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Transfer-Encoding': 'chunked'
  })
  
  const mockResponse = `Thanks for sharing! I understand you're interested in ${userInterest || 'career growth'}. Based on your message about "${message}", I can help you track this as a milestone in your professional journey. Would you like me to create a detailed STAR story for this experience?`
  
  // Simulate streaming
  const words = mockResponse.split(' ')
  let index = 0
  
  const streamInterval = setInterval(() => {
    if (index < words.length) {
      res.write(`data: {"type": "text", "content": "${words[index]} "}\n\n`)
      index++
    } else {
      res.write(`data: {"type": "done"}\n\n`)
      res.end()
      clearInterval(streamInterval)
    }
  }, 50)
})

app.post('/api/ai/extract-skills', (req, res) => {
  const { message } = req.body
  
  if (!message) {
    return res.status(400).json({ message: 'Message is required' })
  }
  
  // Mock skill extraction
  const mockSkills = {
    skills: {
      technical: ['React', 'TypeScript', 'Node.js', 'AWS'],
      soft: ['Leadership', 'Communication', 'Problem Solving'],
      domain: ['Web Development', 'Software Engineering'],
      tools: ['Git', 'Docker', 'VS Code']
    },
    confidence: 0.85,
    sources: [
      {
        text: message.substring(0, 100),
        skills: ['React', 'Leadership'],
        confidence: 0.9
      }
    ]
  }
  
  res.json(mockSkills)
})

// Mock skill management endpoints
app.get('/api/skills', (req, res) => {
  const user = req.session.user
  
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }
  
  const mockSkills = [
    {
      id: 1,
      userId: user.id,
      name: 'React',
      category: 'technical',
      proficiency: 4,
      firstMentioned: new Date().toISOString()
    },
    {
      id: 2,
      userId: user.id,
      name: 'Leadership',
      category: 'soft',
      proficiency: 3,
      firstMentioned: new Date().toISOString()
    }
  ]
  
  res.json(mockSkills)
})

// Mock milestone endpoints
app.post('/api/milestones', (req, res) => {
  const user = req.session.user
  
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }
  
  const milestone = {
    id: Date.now(),
    userId: user.id,
    ...req.body,
    createdAt: new Date().toISOString()
  }
  
  res.json(milestone)
})

app.get('/api/milestones', (req, res) => {
  const user = req.session.user
  
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }
  
  const mockMilestones = [
    {
      id: 1,
      userId: user.id,
      title: 'React Performance Optimization',
      type: 'project',
      category: 'work',
      description: 'Optimized React app performance',
      skills: ['React', 'Performance'],
      startDate: '2024-01-15',
      endDate: '2024-03-30'
    }
  ]
  
  res.json(mockMilestones)
})

// Missing endpoint that PRD requires
app.post('/api/timeline/navigate', (req, res) => {
  const { target } = req.body
  
  if (!target) {
    return res.status(400).json({ message: 'Target is required' })
  }
  
  // Mock timeline navigation response
  const mockResponse = {
    nodeId: 'job-1',
    position: { x: 500, y: 300 },
    relatedNodes: ['project-1', 'project-2']
  }
  
  res.json(mockResponse)
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'test' ? err.message : 'Something went wrong'
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    message: 'The requested endpoint does not exist'
  })
})

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`)
  console.log(`📋 Available endpoints: ${app._router?.stack?.length || 15} routes`)
  console.log(`🧪 Environment: ${process.env.NODE_ENV}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...')
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...')
  server.close(() => process.exit(0))
})

export default app