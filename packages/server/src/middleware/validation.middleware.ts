import type { NextFunction,Request, Response } from 'express';

import { ErrorCode, HttpStatus } from '../core';

// Request validation middleware
export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  // Prevent extremely large payloads
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1024 * 1024) {
    return res.status(HttpStatus.REQUEST_ENTITY_TOO_LARGE).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request payload too large'
      }
    });
  }
  next();
};