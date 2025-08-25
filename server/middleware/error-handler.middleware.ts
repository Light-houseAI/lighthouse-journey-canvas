import { Request, Response, NextFunction } from "express";

export const errorHandlerMiddleware = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Force JSON content type for all API routes
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json');
  }

  // Return structured JSON error response matching BaseController format
  const errorResponse = {
    success: false,
    error: {
      code: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
      message: message,
    }
  };

  res.status(status).json(errorResponse);
};