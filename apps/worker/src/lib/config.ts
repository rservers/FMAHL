/**
 * Worker Configuration
 */

export const EXPORT_MAX_ROWS = parseInt(process.env.EXPORT_MAX_ROWS || '5000', 10)
export const EXPORT_FILE_RETENTION_HOURS = parseInt(process.env.EXPORT_FILE_RETENTION_HOURS || '24', 10)
export const EXPORT_URL_TTL_HOURS = parseInt(process.env.EXPORT_URL_TTL_HOURS || '1', 10)

