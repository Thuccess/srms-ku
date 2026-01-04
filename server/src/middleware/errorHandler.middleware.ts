import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { captureException } from '../utils/errorTracker.js';

/**
 * Error Handler Middleware
 * 
 * Centralized error handling that:
 * - Logs errors with full details
 * - Hides stack traces in production
 * - Returns user-friendly error messages
 * - Tracks errors in error tracking service
 */

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Create an operational error (expected errors)
 */
export const createError = (
  message: string,
  statusCode: number = 500,
  isOperational: boolean = true
): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = isOperational;
  return error;
};

/**
 * Main error handler middleware
 * Must be added AFTER all routes
 */
export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error values
  const statusCode = (err as AppError).statusCode || 500;
  const isOperational = (err as AppError).isOperational !== false;
  const message = err.message || 'Internal server error';

  // Log error with full details
  const errorDetails = {
    message,
    statusCode,
    isOperational,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    userRole: (req as any).user?.role,
  };

  // Log based on severity
  if (statusCode >= 500) {
    logger.error('Server Error:', errorDetails);
    // Capture in error tracking service
    captureException(err, {
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
      user: (req as any).user ? {
        id: (req as any).user.id,
        role: (req as any).user.role,
      } : undefined,
    });
  } else {
    logger.warn('Client Error:', errorDetails);
  }

  // Prepare error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse: any = {
    error: message,
    statusCode,
  };

  // Include stack trace and details only in development
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
    };
  } else {
    // In production, provide generic message for 500 errors
    if (statusCode >= 500) {
      errorResponse.error = 'An internal server error occurred. Please try again later.';
    }
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Must be added AFTER all routes but BEFORE error handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = createError(
    `Route ${req.method} ${req.url} not found`,
    404
  );
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 * 
 * Usage:
 * router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

