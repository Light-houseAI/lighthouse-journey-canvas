/**
 * Production Security Middleware
 * Implements comprehensive security headers and protections for production environment
 */

import { NextFunction,Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';


export interface SecurityConfig {
  enableHSTS?: boolean;
  enableCSP?: boolean;
  enableCORS?: boolean;
  enableRateLimiting?: boolean;
  customCSPDirectives?: Record<string, string[]>;
  trustedDomains?: string[];
}

/**
 * Production Security Middleware
 */
export class SecurityMiddleware {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      enableHSTS: true,
      enableCSP: true,
      enableCORS: true,
      enableRateLimiting: true,
      ...config
    };
  }

  /**
   * Get comprehensive security middleware stack
   */
  getSecurityMiddleware() {
    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

    // Only apply security headers in production or when explicitly enabled
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SECURITY_HEADERS) {
      middlewares.push(this.createHelmetMiddleware());
      middlewares.push(this.createCustomSecurityHeaders());
    }

    if (this.config.enableCORS) {
      middlewares.push(this.createCORSMiddleware());
    }

    if (this.config.enableRateLimiting && process.env.NODE_ENV === 'production') {
      middlewares.push(this.createGlobalRateLimiting());
    }

    middlewares.push(this.createRequestSanitization());
    middlewares.push(this.createRequestLogging());

    return middlewares;
  }

  /**
   * Create Helmet middleware with production-ready security headers
   */
  private createHelmetMiddleware() {
    return helmet({
      // HTTP Strict Transport Security
      hsts: this.config.enableHSTS ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      } : false,

      // Content Security Policy
      contentSecurityPolicy: this.config.enableCSP ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for some React features
            "'unsafe-eval'", // Required for development
            ...this.config.customCSPDirectives?.scriptSrc || []
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for styled-components
            ...this.config.customCSPDirectives?.styleSrc || []
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            ...this.config.customCSPDirectives?.imgSrc || []
          ],
          connectSrc: [
            "'self'",
            "wss:",
            "ws:",
            ...this.config.customCSPDirectives?.connectSrc || []
          ],
          fontSrc: [
            "'self'",
            "data:",
            ...this.config.customCSPDirectives?.fontSrc || []
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          ...this.config.customCSPDirectives
        }
      } : false,

      // X-Frame-Options
      frameguard: { action: 'deny' },

      // X-Content-Type-Options
      noSniff: true,

      // X-XSS-Protection
      xssFilter: true,

      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

      // Hide X-Powered-By header
      hidePoweredBy: true,

      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },

      // Don't infer MIME type
      noSniff: true,

      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: false, // Disabled for compatibility

      // Permissions Policy (Feature Policy)
      permissionsPolicy: {
        camera: ['none'],
        microphone: ['none'],
        geolocation: ['none'],
        notifications: ['none'],
        push: ['none'],
        'payment-handler': ['none']
      }
    });
  }

  /**
   * Create custom security headers
   */
  private createCustomSecurityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Additional security headers
      res.setHeader('X-Request-ID', this.generateRequestId());
      res.setHeader('X-API-Version', '1.0');
      
      // Cache control for API responses
      if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      // Remove potentially sensitive headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      // Cross-Origin Resource Policy
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      // Cross-Origin Opener Policy
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

      next();
    };
  }

  /**
   * Create CORS middleware
   */
  private createCORSMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const allowedOrigins = this.getAllowedOrigins();
      const origin = req.headers.origin;

      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (process.env.NODE_ENV === 'development') {
        // Allow all origins in development
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-MCP-Token, X-Request-ID'
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }

      next();
    };
  }

  /**
   * Create global rate limiting
   */
  private createGlobalRateLimiting() {
    return rateLimit({
      windowMs: process.env.$1 || 15 * 60 * 1000, // 15 minutes
      max: process.env.$1 || 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP',
        message: 'Please try again later',
        retryAfter: Math.ceil((process.env.$1 || 15 * 60 * 1000) / 1000)
      },
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      
      // Skip rate limiting for certain conditions
      skip: (req) => {
        // Skip for health checks
        if (req.path === '/health' || req.path === '/api/health') {
          return true;
        }

        // Skip for whitelisted IPs (if configured)
        const whitelistedIPs = ['127.0.0.1', '::1']; // localhost
        const clientIP = req.ip || req.connection.remoteAddress;
        if (whitelistedIPs.includes(clientIP)) {
          return true;
        }

        return false;
      },

      // Custom key generator (can be used for more sophisticated rate limiting)
      keyGenerator: (req) => {
        // Use IP + User ID for authenticated requests
        const userId = (req as any).user?.id;
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        return userId ? `${ip}:${userId}` : ip;
      }
    });
  }

  /**
   * Create request sanitization middleware
   */
  private createRequestSanitization() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Sanitize common attack vectors in query parameters
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            // Remove potential XSS vectors
            req.query[key] = this.sanitizeInput(value);
          }
        }
      }

      // Check for suspicious patterns in headers
      const suspiciousHeaders = ['x-forwarded-host', 'x-original-host', 'x-rewrite-host'];
      for (const header of suspiciousHeaders) {
        if (req.headers[header] && process.env.NODE_ENV === 'production') {
          console.warn(`⚠️ Suspicious header detected: ${header}=${req.headers[header]} from IP: ${req.ip}`);
        }
      }

      // Validate Content-Type for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'] || '';
        const allowedTypes = [
          'application/json',
          'application/x-www-form-urlencoded',
          'multipart/form-data'
        ];

        if (!allowedTypes.some(type => contentType.includes(type)) && req.body) {
          return res.status(415).json({
            error: 'Unsupported Media Type',
            message: 'Content-Type must be application/json, application/x-www-form-urlencoded, or multipart/form-data'
          });
        }
      }

      next();
    };
  }

  /**
   * Create request logging middleware for security monitoring
   */
  private createRequestLogging() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Log suspicious requests in production
      if (process.env.NODE_ENV === 'production') {
        const suspiciousPatterns = [
          /\.\./,  // Path traversal
          /<script/i,  // XSS attempts
          /union\s+select/i,  // SQL injection
          /eval\(/i,  // Code injection
          /exec\(/i   // Command injection
        ];

        const requestData = `${req.method} ${req.path} ${JSON.stringify(req.query)}`;
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(requestData)) {
            console.warn(`🚨 Suspicious request detected: ${requestData} from IP: ${req.ip}`);
            
            // Optionally block the request
            if (process.env.NODE_ENV === 'production') {
              return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid request pattern detected'
              });
            }
            break;
          }
        }
      }

      next();
    };
  }

  /**
   * Get allowed origins for CORS
   */
  private getAllowedOrigins(): string[] {
    const origins: string[] = [];

    if (process.env.$1) {
      origins.push(...process.env.$1.split(',').map(o => o.trim()));
    }

    if (this.config.trustedDomains) {
      origins.push(...this.config.trustedDomains);
    }

    // Default allowed origins for development
    if (process.env.NODE_ENV === 'development') {
      origins.push(
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      );
    }

    return [...new Set(origins)]; // Remove duplicates
  }

  /**
   * Sanitize input to prevent XSS
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
      .trim();
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create HTTPS redirect middleware
   */
  createHTTPSRedirect() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.$1 && process.env.NODE_ENV === 'production') {
        if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
          const httpsUrl = `https://${req.headers.host}${req.url}`;
          return res.redirect(301, httpsUrl);
        }
      }
      next();
    };
  }

  /**
   * Create IP whitelisting middleware
   */
  createIPWhitelist(allowedIPs: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Check if IP is in whitelist
      const isAllowed = allowedIPs.some(allowedIP => {
        if (allowedIP.includes('/')) {
          // CIDR notation support (basic implementation)
          return this.isIPInCIDR(clientIP, allowedIP);
        }
        return clientIP === allowedIP || clientIP.startsWith(allowedIP);
      });

      if (!isAllowed) {
        console.warn(`🚫 IP blocked: ${clientIP} attempted to access ${req.path}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied from your IP address'
        });
      }

      next();
    };
  }

  /**
   * Basic CIDR check (simplified implementation)
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    // This is a simplified implementation
    // In production, use a proper CIDR library like 'ip-range-check'
    const [network, prefixLength] = cidr.split('/');
    return ip.startsWith(network.split('.').slice(0, Math.ceil(parseInt(prefixLength) / 8)).join('.'));
  }

  /**
   * Create request size limiting middleware
   */
  createRequestSizeLimit(limit: string = '10mb') {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      const maxSize = this.parseSize(limit);

      if (contentLength > maxSize) {
        return res.status(413).json({
          error: 'Payload Too Large',
          message: `Request body exceeds maximum size of ${limit}`
        });
      }

      next();
    };
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+)(\w+)?$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2] || 'b';

    return value * (units[unit] || 1);
  }
}

/**
 * Create default security middleware for the application
 */
export function createSecurityMiddleware(config?: SecurityConfig): SecurityMiddleware {
  return new SecurityMiddleware(config);
}

/**
 * Export default instance
 */
export const securityMiddleware = createSecurityMiddleware();