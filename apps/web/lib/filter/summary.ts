/**
 * Filter Summary Generator for EPIC 05
 * 
 * Generates human-readable summaries of filter rules.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { FilterRules, NicheFormSchema, NicheFormField } from '../types/filter'

/**
 * Get field label from schema
 */
function getFieldLabel(fieldKey: string, schema: NicheFormSchema): string {
  const field = schema.fields.find((f) => f.key === fieldKey)
  return field?.label || fieldKey
}

/**
 * Format value for display
 */
function formatValue(value: unknown, operator: string): string {
  if (Array.isArray(value)) {
    if (operator === 'between' && value.length === 2) {
      return `${value[0]} - ${value[1]}`
    }
    return value.join(', ')
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no'
  }
  return String(value)
}

/**
 * Generate human-readable filter summary
 */
export function generateFilterSummary(
  filterRules: FilterRules | null,
  nicheSchema: NicheFormSchema
): string {
  if (!filterRules || !filterRules.rules || filterRules.rules.length === 0) {
    return 'No filters (all leads eligible)'
  }

  const summaries: string[] = []

  for (const rule of filterRules.rules) {
    const fieldLabel = getFieldLabel(rule.field_key, nicheSchema)
    const valueStr = formatValue(rule.value, rule.operator)

    switch (rule.operator) {
      case 'eq':
        summaries.push(`${fieldLabel} equals ${valueStr}`)
        break
      case 'neq':
        summaries.push(`${fieldLabel} not equals ${valueStr}`)
        break
      case 'in':
        summaries.push(`${fieldLabel} is one of: ${valueStr}`)
        break
      case 'not_in':
        summaries.push(`${fieldLabel} is not one of: ${valueStr}`)
        break
      case 'contains':
        summaries.push(`${fieldLabel} contains "${valueStr}"`)
        break
      case 'gte':
        summaries.push(`${fieldLabel} >= ${valueStr}`)
        break
      case 'lte':
        summaries.push(`${fieldLabel} <= ${valueStr}`)
        break
      case 'between':
        summaries.push(`${fieldLabel} is between ${valueStr}`)
        break
      case 'exists':
        const existsValue = rule.value === false ? 'not exist' : 'exists'
        summaries.push(`${fieldLabel} ${existsValue}`)
        break
      default:
        summaries.push(`${fieldLabel} ${rule.operator} ${valueStr}`)
    }
  }

  return summaries.join(' AND ')
}

