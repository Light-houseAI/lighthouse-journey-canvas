// Test-specific server startup with graceful database handling
import express from 'express'
import session from 'express-session'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { router } from './routes'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Set test environment defaults
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-mock-key-for-api-testing'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret'
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Session configuration with fallback
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Serve static files
const distPath = join(__dirname, '../dist')
const clientPath = join(__dirname, '../client')

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
} else if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath))
}

// Test endpoint for health checks
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Journey Canvas API Test Server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  })
})

// API routes
try {
  console.log('🔄 Bootstrapping dependency injection container...')
  console.log('🔄 Using hierarchical timeline system - legacy DI container not needed')
  
} catch (error) {
  console.warn('⚠️  Bootstrap warning:', error.message)
  console.log('📝 Continuing with limited functionality for testing...')
}

// Register routes with error handling
try {
  app.use(router)
  console.log('✅ API routes registered successfully')
} catch (error) {
  console.warn('⚠️  Route registration warning:', error.message)
  
  // Add basic fallback routes for testing
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running in test mode' })
  })
  
  app.post('/api/signup', (req, res) => {
    res.json({ id: 1, email: req.body.email, message: 'Mock signup for testing' })
  })
  
  app.post('/api/signin', (req, res) => {
    res.json({ id: 1, email: req.body.email, message: 'Mock signin for testing' })
  })
  
  app.get('/api/me', (req, res) => {
    res.json({ id: 1, email: 'test@example.com', hasCompletedOnboarding: false })
  })
  
  console.log('📝 Fallback routes registered for testing')
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('💥 Server error:', err)
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
  console.log(`🚀 Test server running on port ${PORT}`)
  console.log(`📍 Health check: http://localhost:${PORT}/`)
  console.log(`🧪 Environment: ${process.env.NODE_ENV}`)
  
  // Log available endpoints
  console.log('\n📋 Available endpoints:')
  console.log('   GET  / - Health check')
  console.log('   GET  /api/health - API health')
  console.log('   POST /api/signup - User registration (mock)')
  console.log('   POST /api/signin - User login (mock)')
  console.log('   GET  /api/me - Current user (mock)')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

export default app