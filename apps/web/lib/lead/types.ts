/**
 * Lead-related types for EPIC 02
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

/**
 * Form field types supported by niche form schemas
 */
export type FormFieldType = 
  | 'text' 
  | 'number' 
  | 'email' 
  | 'phone' 
  | 'select' 
  | 'checkbox' 
  | 'radio' 
  | 'textarea'

/**
 * Validation rules for form fields
 */
export interface FormFieldValidationRules {
  min_length?: number
  max_length?: number
  min?: number
  max?: number
  pattern?: string
  options?: string[] // For select/radio/checkbox
}

/**
 * Form field definition from niche.form_schema
 */
export interface FormField {
  field_key: string
  label: string
  type: FormFieldType
  required: boolean
  validation_rules?: FormFieldValidationRules
  placeholder?: string
  help_text?: string
}

/**
 * Form schema is an array of form fields
 */
export type FormSchema = FormField[]

/**
 * Form data submitted by user (key-value pairs)
 */
export type FormData = Record<string, any>

/**
 * Attribution data for lead tracking
 */
export interface Attribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer_url?: string
  partner_id?: string
}

