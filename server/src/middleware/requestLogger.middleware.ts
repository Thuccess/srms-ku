import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { addBreadcrumb } from '../utils/errorTracker.js';

/**
 * Request Logging Middleware
 * 
 * Logs all incoming requests and responses with:
 * - Method, URL, IP
 * - Response status and time taken
 * - User information (if authenticated)
 * - Request size
 * 
 * Excludes sensitive routes (login, password reset) from detailed logging
 */

// Routes to exclude from detailed logging (sensitive operations)
const EXCLUDED_ROUTES = [
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/register',
];

/**
 * Check if route should be excluded from detailed logging
 */
const shouldExcludeRoute = (path: string): boolean => {
  return EXCLUDED_ROUTES.some(route => path.startsWith(route));
};

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('user-agent') || 'Unknown';
  const isExcluded = shouldExcludeRoute(url);

  // Log request start (only for non-excluded routes)
  if (!isExcluded) {
    const requestInfo: any = {
      method,
      url,
      ip,
      userAgent,
    };

    // Add user info if authenticated
    if ((req as any).user) {
      requestInfo.userId = (req as any).user.id;
      requestInfo.userRole = (req as any).user.role;
    }

    logger.debug('Incoming Request:', requestInfo);

    // Add breadcrumb for error tracking
    addBreadcrumb(
      `${method} ${url}`,
      'http',
      'info',
      {
        method,
        url,
        ip,
      }
    );
  }

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    const contentLength = res.get('content-length') || 0;

    // Determine log level based on status code
    let logLevel: 'info' | 'warn' | 'error' = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    }

    const responseInfo: any = {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      contentLength: `${contentLength} bytes`,
      ip,
    };

    // Add user info if authenticated
    if ((req as any).user) {
      responseInfo.userId = (req as any).user.id;
      responseInfo.userRole = (req as any).user.role;
    }

    // Log based on level and exclusion
    if (isExcluded) {
      // For excluded routes, only log errors
      if (logLevel === 'error') {
        logger[logLevel](`${method} ${url} - ${statusCode} (${duration}ms)`, responseInfo);
      }
    } else {
      // For normal routes, log all responses
      logger[logLevel](`${method} ${url} - ${statusCode} (${duration}ms)`, responseInfo);
    }

    // Add breadcrumb for error tracking (only for errors)
    if (statusCode >= 400) {
      addBreadcrumb(
        `${method} ${url} - ${statusCode}`,
        'http',
        statusCode >= 500 ? 'error' : 'warning',
        {
          method,
          url,
          statusCode,
          duration,
        }
      );
    }
  });

  next();
};

