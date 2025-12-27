import { NextRequest, NextResponse } from 'next/server'
import { signupSchema } from '@/lib/validations/auth'
import { hashPassword } from '@/lib/password'
import { signToken } from '@/lib/jwt'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Signup request received')
    
    const body = await request.json()
    console.log('📦 Request body:', body)
    
    // Validate input
    const validatedData = signupSchema.parse(body)
    console.log('✅ Validation passed')
    
    // Check if user already exists
    console.log('🔍 Checking if user exists...')
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${validatedData.email}
    `
    console.log('📊 Existing user check result:', existingUser)
    
    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }
    
    // Hash password
    console.log('🔐 Hashing password...')
    const passwordHash = await hashPassword(validatedData.password)
    console.log('✅ Password hashed')
    
    // Create user
    console.log('👤 Creating user...')
    const [user] = await sql`
      INSERT INTO users (
        email,
        password_hash,
        role,
        first_name,
        last_name,
        phone
      ) VALUES (
        ${validatedData.email},
        ${passwordHash},
        ${validatedData.role},
        ${validatedData.firstName},
        ${validatedData.lastName},
        ${validatedData.phone || null}
      )
      RETURNING id, email, role, first_name, last_name
    `
    console.log('✅ User created:', user)
    
    // Generate JWT token
    console.log('🎫 Generating token...')
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
    console.log('✅ Token generated')
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      token,
    })
    
  } catch (error: any) {
    console.error('❌ Signup error:', error)
    console.error('❌ Error name:', error.name)
    console.error('❌ Error message:', error.message)
    console.error('❌ Error stack:', error.stack)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
