/**
 * Report Configuration for EPIC 11 - Reporting & Analytics
 * 
 * Configurable thresholds and limits for reporting features.
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

/**
 * Starvation threshold in days
 * Providers without leads for this many days are considered "starved"
 */
export const STARVATION_THRESHOLD_DAYS = parseInt(
  process.env.STARVATION_THRESHOLD_DAYS || '7',
  10
)

/**
 * Bad lead approval rate threshold
 * Providers with approval rate above this are flagged
 */
export const BAD_LEAD_APPROVAL_RATE_THRESHOLD = parseFloat(
  process.env.BAD_LEAD_APPROVAL_RATE_THRESHOLD || '0.50'
)

/**
 * Bad lead refund rate threshold
 * Providers with refund rate above this are flagged
 */
export const BAD_LEAD_REFUND_RATE_THRESHOLD = parseFloat(
  process.env.BAD_LEAD_REFUND_RATE_THRESHOLD || '0.20'
)

/**
 * Report cache TTL in seconds
 */
export const REPORT_CACHE_TTL_SECONDS = parseInt(
  process.env.REPORT_CACHE_TTL_SECONDS || '300',
  10
)

/**
 * Maximum rows for export
 */
export const EXPORT_MAX_ROWS = parseInt(
  process.env.EXPORT_MAX_ROWS || '5000',
  10
)

/**
 * Export file retention in hours
 */
export const EXPORT_FILE_RETENTION_HOURS = parseInt(
  process.env.EXPORT_FILE_RETENTION_HOURS || '24',
  10
)

/**
 * Export download URL TTL in hours
 */
export const EXPORT_URL_TTL_HOURS = parseInt(
  process.env.EXPORT_URL_TTL_HOURS || '1',
  10
)

/**
 * Provider export daily limit
 */
export const PROVIDER_EXPORT_DAILY_LIMIT = parseInt(
  process.env.PROVIDER_EXPORT_DAILY_LIMIT || '5',
  10
)

