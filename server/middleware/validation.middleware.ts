import type { Request, Response, NextFunction } from 'express';

// Request validation middleware
export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  // Prevent extremely large payloads
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1024 * 1024) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload too large'
      }
    });
  }
  next();
};