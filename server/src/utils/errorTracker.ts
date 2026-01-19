/**
 * Error Tracking Service
 * 
 * Integrates with error tracking services like Sentry, Rollbar, etc.
 * Currently supports Sentry, but can be extended for other services.
 * 
 * In production, set SENTRY_DSN environment variable to enable Sentry tracking.
 */

import * as Sentry from '@sentry/node';

let isInitialized = false;

/**
 * Initialize error tracking
 * Call this once at application startup
 */
export const initializeErrorTracking = (): void => {
  if (isInitialized) {
    return;
  }

  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (sentryDsn && sentryDsn.trim() !== '') {
    try {
      Sentry.init({
        dsn: sentryDsn,
        environment,
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
        profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
        beforeSend(event, hint) {
          // Filter out sensitive information
          if (event.request) {
            // Remove sensitive headers
            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['cookie'];
            }
            // Remove sensitive query params
            if (event.request.query_string) {
              const queryString = event.request.query_string;
              const queryStr = typeof queryString === 'string' ? queryString : String(queryString);
              if (queryStr.includes('password') || queryStr.includes('token')) {
                event.request.query_string = '[Filtered]';
              }
            }
          }
          return event;
        },
      });

      isInitialized = true;
      console.log('✅ Error tracking (Sentry) initialized');
    } catch (error) {
      console.error('❌ Failed to initialize error tracking:', error);
    }
  } else {
    console.log('ℹ️  Error tracking (Sentry) not configured - SENTRY_DSN not set');
  }
};

/**
 * Capture an exception/error
 * 
 * @param error - Error object or message
 * @param context - Additional context (user, request, etc.)
 */
export const captureException = (error: Error | string, context?: Record<string, any>): void => {
  if (!isInitialized) {
    return;
  }

  try {
    if (context) {
      Sentry.withScope((scope) => {
        // Add context
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });

        if (typeof error === 'string') {
          Sentry.captureMessage(error, 'error');
        } else {
          Sentry.captureException(error);
        }
      });
    } else {
      if (typeof error === 'string') {
        Sentry.captureMessage(error, 'error');
      } else {
        Sentry.captureException(error);
      }
    }
  } catch (err) {
    // Silently fail - don't break the application if error tracking fails
    console.error('Failed to capture exception in error tracker:', err);
  }
};

/**
 * Capture a message (non-error)
 * 
 * @param message - Message to capture
 * @param level - Log level (info, warning, error)
 * @param context - Additional context
 */
export const captureMessage = (
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void => {
  if (!isInitialized) {
    return;
  }

  try {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureMessage(message, level);
      });
    } else {
      Sentry.captureMessage(message, level);
    }
  } catch (err) {
    console.error('Failed to capture message in error tracker:', err);
  }
};

/**
 * Set user context for error tracking
 * 
 * @param user - User object with id, email, etc.
 */
export const setUser = (user: { id?: string; email?: string; role?: string } | null): void => {
  if (!isInitialized) {
    return;
  }

  try {
    if (user) {
      Sentry.setUser({
        id: user.id || '',
        email: user.email || '',
        username: user.email || '',
        role: user.role || '',
      });
    } else {
      Sentry.setUser(null);
    }
  } catch (err) {
    console.error('Failed to set user in error tracker:', err);
  }
};

/**
 * Add breadcrumb for debugging
 * 
 * @param message - Breadcrumb message
 * @param category - Breadcrumb category
 * @param level - Breadcrumb level
 * @param data - Additional data
 */
export const addBreadcrumb = (
  message: string,
  category: string = 'default',
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void => {
  if (!isInitialized) {
    return;
  }

  try {
    const breadcrumb: any = {
      message,
      category,
      level,
    };
    if (data) {
      breadcrumb.data = data;
    }
    Sentry.addBreadcrumb(breadcrumb);
  } catch (err) {
    // Silently fail
  }
};

