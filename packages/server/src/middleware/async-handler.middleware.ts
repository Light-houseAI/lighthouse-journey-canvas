import { NextFunction, Request, Response } from 'express';

/**
 * Wraps an async route handler to catch any errors and pass them to Express error middleware.
 * This prevents unhandled promise rejections from crashing the server.
 *
 * @example
 * router.post('/nodes', asyncHandler(async (req, res) => {
 *   // If this throws, the error will be caught and passed to error middleware
 *   const data = schema.parse(req.body);
 *   res.json(data);
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
