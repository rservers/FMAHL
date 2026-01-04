/**
 * Form schema validator for EPIC 02
 * 
 * Validates form_data against niche.form_schema
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import type { FormSchema, FormData, FormField } from './types'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Validates form data against a form schema
 */
export function validateFormData(
  formData: FormData,
  schema: FormSchema
): ValidationResult {
  const errors: ValidationError[] = []

  // Check required fields
  for (const field of schema) {
    const value = formData[field.field_key]

    // Check required
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field.field_key,
        message: `${field.label} is required`,
      })
      continue // Skip further validation if field is missing
    }

    // Skip validation if field is empty and not required
    if (!field.required && (value === undefined || value === null || value === '')) {
      continue
    }

    // Type-specific validation
    const fieldError = validateFieldValue(field, value)
    if (fieldError) {
      errors.push(fieldError)
    }
  }

  // Check for extra fields not in schema (warn but don't fail)
  // This is allowed for flexibility

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates a single field value against its field definition
 */
function validateFieldValue(
  field: FormField,
  value: any
): ValidationError | null {
  const { field_key, label, type, validation_rules } = field

  // Type validation
  switch (type) {
    case 'text':
    case 'textarea':
      if (typeof value !== 'string') {
        return { field: field_key, message: `${label} must be text` }
      }
      if (validation_rules) {
        if (validation_rules.min_length && value.length < validation_rules.min_length) {
          return {
            field: field_key,
            message: `${label} must be at least ${validation_rules.min_length} characters`,
          }
        }
        if (validation_rules.max_length && value.length > validation_rules.max_length) {
          return {
            field: field_key,
            message: `${label} must be no more than ${validation_rules.max_length} characters`,
          }
        }
        if (validation_rules.pattern) {
          const regex = new RegExp(validation_rules.pattern)
          if (!regex.test(value)) {
            return {
              field: field_key,
              message: `${label} format is invalid`,
            }
          }
        }
      }
      break

    case 'email':
      if (typeof value !== 'string') {
        return { field: field_key, message: `${label} must be an email address` }
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return { field: field_key, message: `${label} must be a valid email address` }
      }
      break

    case 'phone':
      if (typeof value !== 'string') {
        return { field: field_key, message: `${label} must be a phone number` }
      }
      // E.164 format or basic phone format
      const phoneRegex = /^\+?[1-9]\d{1,14}$|^[\d\s\-\(\)]+$/
      if (!phoneRegex.test(value.replace(/\s/g, ''))) {
        return { field: field_key, message: `${label} must be a valid phone number` }
      }
      break

    case 'number':
      const numValue = typeof value === 'string' ? parseFloat(value) : value
      if (isNaN(numValue)) {
        return { field: field_key, message: `${label} must be a number` }
      }
      if (validation_rules) {
        if (validation_rules.min !== undefined && numValue < validation_rules.min) {
          return {
            field: field_key,
            message: `${label} must be at least ${validation_rules.min}`,
          }
        }
        if (validation_rules.max !== undefined && numValue > validation_rules.max) {
          return {
            field: field_key,
            message: `${label} must be no more than ${validation_rules.max}`,
          }
        }
      }
      break

    case 'select':
    case 'radio':
      if (typeof value !== 'string') {
        return { field: field_key, message: `${label} must be selected` }
      }
      if (validation_rules?.options && !validation_rules.options.includes(value)) {
        return {
          field: field_key,
          message: `${label} must be one of the available options`,
        }
      }
      break

    case 'checkbox':
      if (typeof value !== 'boolean') {
        return { field: field_key, message: `${label} must be checked or unchecked` }
      }
      break

    default:
      // Unknown type - allow it but log warning
      console.warn(`Unknown field type: ${type} for field ${field_key}`)
  }

  return null
}

