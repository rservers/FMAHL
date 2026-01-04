import * as OTPAuth from 'otpauth'

/**
 * MFA (Multi-Factor Authentication) utilities for EPIC 01
 * 
 * Implements TOTP (Time-based One-Time Password) for admin accounts.
 * Uses the OTPAuth library for RFC 6238 compliant TOTP.
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

const ISSUER = 'FindMeAHotLead'
const TOTP_PERIOD = 30 // seconds
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = 'SHA1'

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(): string {
  // Generate a random 20-byte secret (160 bits)
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32
}

/**
 * Create a TOTP instance for a user
 */
function createTOTP(email: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
}

/**
 * Generate a TOTP URI for QR code generation
 * This URI can be used with authenticator apps like Google Authenticator
 */
export function generateTOTPUri(email: string, secret: string): string {
  const totp = createTOTP(email, secret)
  return totp.toString()
}

/**
 * Verify a TOTP code
 * Returns true if the code is valid (within acceptable time window)
 */
export function verifyTOTPCode(secret: string, code: string, email: string): boolean {
  const totp = createTOTP(email, secret)
  
  // delta is the number of periods to check before/after current
  // 1 means we accept codes from 1 period before to 1 period after
  const delta = totp.validate({ token: code, window: 1 })
  
  // validate returns null if invalid, or the delta if valid
  return delta !== null
}

/**
 * Generate current TOTP code (for testing purposes only)
 */
export function generateCurrentTOTPCode(secret: string, email: string): string {
  const totp = createTOTP(email, secret)
  return totp.generate()
}

/**
 * Get MFA enrollment data for QR code display
 */
export interface MFAEnrollmentData {
  secret: string
  uri: string
  issuer: string
  email: string
}

export function createMFAEnrollment(email: string): MFAEnrollmentData {
  const secret = generateTOTPSecret()
  const uri = generateTOTPUri(email, secret)
  
  return {
    secret,
    uri,
    issuer: ISSUER,
    email,
  }
}

