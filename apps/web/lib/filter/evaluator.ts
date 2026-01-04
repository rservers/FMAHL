/**
 * Eligibility Evaluator for EPIC 05
 * 
 * Evaluates lead form data against filter rules to determine eligibility.
 * Implements fail-safe behavior: invalid filters = ineligible.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import {
  FilterRule,
  FilterRules,
  NicheFormSchema,
  NicheFormField,
} from '../types/filter'
import {
  evaluateEq,
  evaluateNeq,
  evaluateIn,
  evaluateNotIn,
  evaluateContains,
  evaluateGte,
  evaluateLte,
  evaluateBetween,
  evaluateExists,
} from './operators'

export interface EligibilityResult {
  eligible: boolean
  reasons?: string[]
}

export interface EligibilityOptions {
  debug?: boolean // Enable debug trace mode
}

/**
 * Get field value from lead form data
 */
function getFieldValue(fieldKey: string, leadFormData: Record<string, unknown>): unknown {
  return leadFormData[fieldKey]
}

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
 * Evaluate a single filter rule
 */
function evaluateRule(
  rule: FilterRule,
  leadFormData: Record<string, unknown>,
  schema: NicheFormSchema,
  options?: EligibilityOptions
): { eligible: boolean; reason?: string } {
  const field = getFieldDefinition(rule.field_key, schema)
  const fieldValue = getFieldValue(rule.field_key, leadFormData)

  // If field doesn't exist in schema, fail-safe: ineligible
  if (!field) {
    const reason = `Field '${rule.field_key}' not found in schema`
    if (options?.debug) {
      console.warn(`[Eligibility] ${reason}`)
    }
    return { eligible: false, reason }
  }

  // If field is required and missing, fail-safe: ineligible (unless exists operator)
  if (field.required && (fieldValue === null || fieldValue === undefined || fieldValue === '')) {
    if (rule.operator !== 'exists') {
      const reason = `Required field '${rule.field_key}' is missing`
      if (options?.debug) {
        console.warn(`[Eligibility] ${reason}`)
      }
      return { eligible: false, reason }
    }
  }

  // Evaluate based on operator
  let result: boolean
  try {
    switch (rule.operator) {
      case 'eq':
        result = evaluateEq(fieldValue, rule.value)
        break
      case 'neq':
        result = evaluateNeq(fieldValue, rule.value)
        break
      case 'in':
        result = evaluateIn(fieldValue, rule.value as unknown[])
        break
      case 'not_in':
        result = evaluateNotIn(fieldValue, rule.value as unknown[])
        break
      case 'contains':
        result = evaluateContains(fieldValue, rule.value)
        break
      case 'gte':
        result = evaluateGte(fieldValue, rule.value)
        break
      case 'lte':
        result = evaluateLte(fieldValue, rule.value)
        break
      case 'between':
        result = evaluateBetween(fieldValue, rule.value as [number, number])
        break
      case 'exists':
        result = evaluateExists(fieldValue, rule.value as boolean | undefined)
        break
      default:
        const reason = `Unknown operator: ${rule.operator}`
        if (options?.debug) {
          console.error(`[Eligibility] ${reason}`)
        }
        return { eligible: false, reason }
    }
  } catch (error: any) {
    // Fail-safe: any error = ineligible
    const reason = `Error evaluating rule: ${error.message}`
    if (options?.debug) {
      console.error(`[Eligibility] ${reason}`, error)
    }
    return { eligible: false, reason }
  }

  // Type mismatch check (warning only, still evaluate)
  if (options?.debug && !result) {
    const fieldType = field.type
    const valueType = Array.isArray(fieldValue)
      ? 'array'
      : fieldValue === null
      ? 'null'
      : typeof fieldValue

    if (
      (fieldType === 'number' && valueType !== 'number') ||
      (fieldType === 'boolean' && valueType !== 'boolean')
    ) {
      console.warn(
        `[Eligibility] Type mismatch for field '${rule.field_key}': expected ${fieldType}, got ${valueType}`
      )
    }
  }

  return { eligible: result }
}

/**
 * Evaluate eligibility of lead form data against filter rules
 * 
 * @param leadFormData - Lead form data (key-value pairs)
 * @param filterRules - Filter rules to evaluate
 * @param nicheSchema - Niche form schema
 * @param options - Evaluation options
 * @returns Eligibility result with reasons
 */
export function evaluateEligibility(
  leadFormData: Record<string, unknown>,
  filterRules: FilterRules,
  nicheSchema: NicheFormSchema,
  options?: EligibilityOptions
): EligibilityResult {
  // Fail-safe: malformed filter_rules = ineligible
  if (!filterRules || !Array.isArray(filterRules.rules)) {
    const reason = 'Invalid filter rules structure'
    if (options?.debug) {
      console.error(`[Eligibility] ${reason}`)
    }
    return { eligible: false, reasons: [reason] }
  }

  // Empty rules = all eligible (no filters)
  if (filterRules.rules.length === 0) {
    return { eligible: true }
  }

  // Evaluate all rules (AND logic - all must pass)
  const reasons: string[] = []
  for (const rule of filterRules.rules) {
    const ruleResult = evaluateRule(rule, leadFormData, nicheSchema, options)
    if (!ruleResult.eligible) {
      reasons.push(ruleResult.reason || `Rule failed: ${rule.field_key} ${rule.operator}`)
    }
  }

  // All rules must pass (AND logic)
  const eligible = reasons.length === 0

  return {
    eligible,
    reasons: eligible ? undefined : reasons,
  }
}

