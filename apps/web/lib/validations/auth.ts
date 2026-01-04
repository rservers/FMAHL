import { z } from 'zod'

// ============================================
// PASSWORD VALIDATION (EPIC 01)
// ============================================

/**
 * Password requirements per EPIC 01:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * - Cannot contain the email address
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')

// Helper to validate password doesn't contain email
export function validatePasswordNotContainsEmail(password: string, email: string): boolean {
  const emailLocal = email.split('@')[0].toLowerCase()
  return !password.toLowerCase().includes(emailLocal)
}

// ============================================
// REGISTRATION (EPIC 01)
// ============================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  company_name: z.string().min(1, 'Company name is required').optional(),
  role: z.enum(['provider', 'end_user']).default('provider'),
}).refine(
  (data) => validatePasswordNotContainsEmail(data.password, data.email),
  {
    message: 'Password cannot contain your email address',
    path: ['password'],
  }
)

// Legacy signup schema for backwards compatibility
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  role: z.enum(['provider', 'end_user']).default('end_user'),
})

// ============================================
// LOGIN (EPIC 01)
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// ============================================
// EMAIL VERIFICATION (EPIC 01)
// ============================================

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// ============================================
// PASSWORD RESET (EPIC 01)
// ============================================

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: passwordSchema,
})

// ============================================
// MFA (EPIC 01)
// ============================================

export const mfaEnrollSchema = z.object({
  // No input required, generates new secret
})

export const mfaVerifySchema = z.object({
  code: z.string().length(6, 'MFA code must be 6 digits').regex(/^\d+$/, 'MFA code must contain only numbers'),
})

export const mfaChallengeSchema = z.object({
  mfa_token: z.string().min(1, 'MFA token is required'),
  code: z.string().length(6, 'MFA code must be 6 digits').regex(/^\d+$/, 'MFA code must contain only numbers'),
})

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>
export type MfaChallengeInput = z.infer<typeof mfaChallengeSchema>
