import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations/auth'
import { verifyPassword } from '@/lib/password'
import { signToken } from '@/lib/jwt'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = loginSchema.parse(body)
    
    // Find user
    const [user] = await sql`
      SELECT 
        id,
        email,
        password_hash,
        role,
        status,
        email_verified,
        mfa_enabled,
        first_name,
        last_name
      FROM users 
      WHERE email = ${validatedData.email}
    `
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }
    
    // Check account status (EPIC 01)
    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your account has been suspended. Please contact support.' },
        { status: 403 }
      )
    }
    
    if (user.status === 'deactivated') {
      return NextResponse.json(
        { error: 'Your account has been deactivated.' },
        { status: 403 }
      )
    }
    
    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Your account is pending activation.' },
        { status: 403 }
      )
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(
      validatedData.password,
      user.password_hash
    )
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }
    
    // Update last login
    await sql`
      UPDATE users 
      SET last_login_at = NOW() 
      WHERE id = ${user.id}
    `
    
    // Check email verification for providers (EPIC 01)
    if (user.role === 'provider' && !user.email_verified) {
      return NextResponse.json(
        { error: 'Please verify your email before logging in' },
        { status: 403 }
      )
    }
    
    // TODO: Handle MFA for admin accounts (EPIC 01)
    // if (user.role === 'admin' && user.mfa_enabled) {
    //   // Return MFA challenge token instead of access token
    // }
    
    // Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    })
    
    return NextResponse.json({
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified,
        mfa_enabled: user.mfa_enabled,
      },
    })
    
  } catch (error: any) {
    console.error('Login error:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
