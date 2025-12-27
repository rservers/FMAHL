import { emailService } from './index'

async function testEmails() {
  console.log('🧪 Testing email service...\n')

  const result = await emailService.send({
    to: 'test@example.com',
    subject: 'Test Email from Find Me A Hot Lead',
    html: '<h1>Hello!</h1><p>This is a test email.</p>',
    text: 'Hello! This is a test email.',
  })

  console.log('Result:', result)
  console.log('\n📬 View email at: http://localhost:8025')
}

testEmails()
