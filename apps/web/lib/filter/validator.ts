/**
 * Filter Validation Helper for EPIC 05
 * 
 * Validates filter rules against niche form schema and enforces
 * field type → operator mapping.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import {
  FilterRule,
  FilterRules,
  FilterValidationError,
  FilterValidationResult,
  NicheFormSchema,
  NicheFormField,
  FIELD_TYPE_OPERATORS,
} from '../types/filter'
import { validateOperatorValueShape } from '../validations/filter'

/**
 * Get field definition from niche schema
 */
function getFieldDefinition(
  fieldKey: string,
  schema: NicheFormSchema
): NicheFormField | undefined {
  return schema.fields.find((f) => f.key === fieldKey)
}

/**
 * Get dropdown values for select/radio/multi-select fields
 */
function getDropdownValues(field: NicheFormField): string[] {
  if (!field.options) {
    return []
  }
  return field.options.map((opt) => opt.value)
}

/**
 * Validate filter rules against niche schema
 */
export function validateFilterRules(
  filterRules: FilterRules,
  nicheSchema: NicheFormSchema,
  options?: {
    strict?: boolean // If true, require all fields to exist in schema
  }
): FilterValidationResult {
  const errors: FilterValidationError[] = []

  // Validate version
  if (filterRules.version !== 1) {
    errors.push({
      message: `Unsupported filter version: ${filterRules.version}. Only version 1 is supported.`,
    })
  }

  // Validate each rule
  for (const rule of filterRules.rules) {
    const field = getFieldDefinition(rule.field_key, nicheSchema)

    if (!field) {
      errors.push({
        field_key: rule.field_key,
        message: `Field '${rule.field_key}' does not exist in niche schema`,
      })
      continue
    }

    // Validate operator is allowed for field type
    const allowedOperators = FIELD_TYPE_OPERATORS[field.type]
    if (!allowedOperators.includes(rule.operator)) {
      errors.push({
        field_key: rule.field_key,
        operator: rule.operator,
        message: `Operator '${rule.operator}' is not allowed for field type '${field.type}'. Allowed: ${allowedOperators.join(', ')}`,
      })
    }

    // Validate value shape matches operator
    const valueShapeResult = validateOperatorValueShape(rule.operator, rule.value)
    if (!valueShapeResult.valid) {
      errors.push({
        field_key: rule.field_key,
        operator: rule.operator,
        message: valueShapeResult.error || 'Invalid value shape for operator',
      })
    }

    // Validate select/radio values are in allowed options
    if (field.type === 'select' || field.type === 'radio') {
      const dropdownValues = getDropdownValues(field)
      if (dropdownValues.length > 0) {
        if (rule.operator === 'eq' || rule.operator === 'neq') {
          if (typeof rule.value !== 'string' || !dropdownValues.includes(rule.value)) {
            errors.push({
              field_key: rule.field_key,
              operator: rule.operator,
              message: `Value '${rule.value}' is not in allowed options: ${dropdownValues.join(', ')}`,
            })
          }
        } else if (rule.operator === 'in' || rule.operator === 'not_in') {
          if (!Array.isArray(rule.value)) {
            errors.push({
              field_key: rule.field_key,
              operator: rule.operator,
              message: 'Expected array value for in/not_in operator',
            })
          } else {
            const invalidValues = (rule.value as string[]).filter(
              (v) => !dropdownValues.includes(v)
            )
            if (invalidValues.length > 0) {
              errors.push({
                field_key: rule.field_key,
                operator: rule.operator,
                message: `Values not in allowed options: ${invalidValues.join(', ')}`,
              })
            }
          }
        }
      }
    }

    // Validate multi-select values
    if (field.type === 'multi-select') {
      const dropdownValues = getDropdownValues(field)
      if (dropdownValues.length > 0) {
        if (rule.operator === 'in' || rule.operator === 'not_in') {
          if (!Array.isArray(rule.value)) {
            errors.push({
              field_key: rule.field_key,
              operator: rule.operator,
              message: 'Expected array value for multi-select field',
            })
          } else {
            const invalidValues = (rule.value as string[]).filter(
              (v) => !dropdownValues.includes(v)
            )
            if (invalidValues.length > 0) {
              errors.push({
                field_key: rule.field_key,
                operator: rule.operator,
                message: `Values not in allowed options: ${invalidValues.join(', ')}`,
              })
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

