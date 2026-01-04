/**
 * Seed default niches for EPIC 02
 * 
 * Seeds VPS/Server hosting niche with form schema
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import { sql } from '../client'

const VPS_NICHE_FORM_SCHEMA = [
  {
    field_key: 'server_type',
    label: 'Server Type',
    type: 'select',
    required: true,
    validation_rules: {
      options: ['vps', 'dedicated', 'cloud'],
    },
    placeholder: 'Select server type',
    help_text: 'Choose the type of server you need',
  },
  {
    field_key: 'cpu_cores',
    label: 'CPU Cores Needed',
    type: 'number',
    required: true,
    validation_rules: {
      min: 1,
      max: 128,
    },
    placeholder: 'e.g., 4',
    help_text: 'Number of CPU cores required',
  },
  {
    field_key: 'ram_gb',
    label: 'RAM (GB)',
    type: 'number',
    required: true,
    validation_rules: {
      min: 1,
      max: 1024,
    },
    placeholder: 'e.g., 8',
    help_text: 'Amount of RAM in gigabytes',
  },
  {
    field_key: 'storage_gb',
    label: 'Storage (GB)',
    type: 'number',
    required: true,
    validation_rules: {
      min: 10,
      max: 10000,
    },
    placeholder: 'e.g., 100',
    help_text: 'Storage capacity in gigabytes',
  },
  {
    field_key: 'os_preference',
    label: 'Operating System',
    type: 'select',
    required: false,
    validation_rules: {
      options: ['linux', 'windows', 'no_preference'],
    },
    placeholder: 'Select OS preference',
    help_text: 'Preferred operating system (optional)',
  },
  {
    field_key: 'additional_requirements',
    label: 'Additional Requirements',
    type: 'textarea',
    required: false,
    validation_rules: {
      max_length: 1000,
    },
    placeholder: 'Any additional requirements or notes...',
    help_text: 'Optional: Describe any specific requirements',
  },
]

export async function seedNiches() {
  console.log('🌱 Seeding default niches...')

  try {
    // Check if VPS niche already exists
    const [existing] = await sql`
      SELECT id FROM niches WHERE slug = 'vps-hosting'
    `

    if (existing) {
      console.log('   ✅ VPS niche already exists')
      return
    }

    // Create VPS niche
    const [niche] = await sql`
      INSERT INTO niches (
        slug,
        name,
        description,
        is_active,
        is_location_based,
        lead_price_cents,
        form_schema,
        active_schema_version
      ) VALUES (
        'vps-hosting',
        'VPS & Dedicated Servers',
        'Get quotes from VPS and dedicated server providers',
        true,
        false,
        2500,
        ${JSON.stringify(VPS_NICHE_FORM_SCHEMA)},
        1
      )
      RETURNING id, name, slug
    `

    console.log(`   ✅ Created niche: ${niche.name} (${niche.slug})`)
    console.log(`      ID: ${niche.id}`)
    console.log(`      Form schema: ${VPS_NICHE_FORM_SCHEMA.length} fields`)

  } catch (error: any) {
    // Handle duplicate key error gracefully
    if (error.code === '23505') {
      console.log('   ✅ VPS niche already exists')
    } else {
      console.error('   ❌ Failed to seed niches:', error.message)
      throw error
    }
  }
}

