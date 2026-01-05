/**
 * Structured Logging Service for Worker (EPIC 12)
 * 
 * Uses Pino for fast, structured JSON logging
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

// Create logger instance
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
})

export interface Logger {
  info(event: string, metadata?: Record<string, any>): void
  warn(event: string, metadata?: Record<string, any>): void
  error(event: string, error: Error | string, metadata?: Record<string, any>): void
  debug(event: string, metadata?: Record<string, any>): void
}

class StructuredLogger implements Logger {
  private enrichMetadata(metadata?: Record<string, any>): Record<string, any> {
    return {
      ...metadata,
      timestamp: new Date().toISOString(),
    }
  }

  info(event: string, metadata?: Record<string, any>): void {
    baseLogger.info(this.enrichMetadata({ event, ...metadata }))
  }

  warn(event: string, metadata?: Record<string, any>): void {
    baseLogger.warn(this.enrichMetadata({ event, ...metadata }))
  }

  error(event: string, error: Error | string, metadata?: Record<string, any>): void {
    const errorMetadata: Record<string, any> = {
      event,
      ...metadata,
    }

    if (error instanceof Error) {
      errorMetadata.error_message = error.message
      errorMetadata.error_stack = error.stack
      errorMetadata.error_name = error.name
    } else {
      errorMetadata.error_message = error
    }

    baseLogger.error(this.enrichMetadata(errorMetadata))
  }

  debug(event: string, metadata?: Record<string, any>): void {
    baseLogger.debug(this.enrichMetadata({ event, ...metadata }))
  }
}

// Default logger instance
export const logger: Logger = new StructuredLogger()

