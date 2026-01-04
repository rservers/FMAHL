import bcrypt from 'bcryptjs'

/**
 * Password utilities for EPIC 01 - Platform Foundation & Access Control
 * 
 * Requirements:
 * - bcrypt cost factor 12 (per EPIC 01 spec)
 * - Password validation (8+ chars, uppercase, lowercase, number, special char)
 * - Cannot contain email address
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

// EPIC 01: Cost factor 12 for password hashing
const SALT_ROUNDS = 12

// Password validation regex patterns
const PASSWORD_RULES = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[!@#$%^&*(),.?":{}|<>]/,
}

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Validate password strength per EPIC 01 requirements
 * 
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * - Cannot contain the email address
 */
export function validatePassword(password: string, email?: string): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters`)
  }

  if (!PASSWORD_RULES.hasUppercase.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!PASSWORD_RULES.hasLowercase.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!PASSWORD_RULES.hasNumber.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!PASSWORD_RULES.hasSpecial.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  // Check if password contains email (if provided)
  if (email) {
    const emailLocal = email.split('@')[0].toLowerCase()
    if (password.toLowerCase().includes(emailLocal)) {
      errors.push('Password cannot contain your email address')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Hash a password using bcrypt with cost factor 12
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a secure random token for email verification or password reset
 * Returns a hex string
 */
export function generateSecureToken(): string {
  // Use crypto for secure random bytes
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a token for storage (email verification, password reset)
 * Uses SHA-256 for token hashing (not bcrypt, since tokens are already high-entropy)
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify a token against its hash
 */
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  const tokenHash = await hashToken(token)
  return tokenHash === hash
}
