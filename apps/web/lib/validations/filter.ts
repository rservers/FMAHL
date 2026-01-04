/**
 * Filter Validation Schemas for EPIC 05
 * 
 * Zod schemas for validating filter rules and updates.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { z } from 'zod'
import { FilterOperator, OPERATOR_VALUE_SHAPES } from '../types/filter'

/**
 * Filter operator enum schema
 */
export const filterOperatorSchema = z.enum([
  'eq',
  'neq',
  'in',
  'not_in',
  'contains',
  'gte',
  'lte',
  'between',
  'exists',
])

/**
 * Single filter rule schema
 */
export const filterRuleSchema = z.object({
  field_key: z.string().min(1, 'Field key is required'),
  operator: filterOperatorSchema,
  value: z.unknown(), // Will be validated based on operator
})

/**
 * Filter rules container schema (versioned)
 */
export const filterRulesSchema = z.object({
  version: z.number().int().positive().default(1),
  rules: z.array(filterRuleSchema).default([]),
})

/**
 * Update filter request schema
 */
export const updateFilterSchema = z.object({
  filter_rules: filterRulesSchema,
})

/**
 * Helper to validate value shape matches operator
 */
export function validateOperatorValueShape(
  operator: FilterOperator,
  value: unknown
): { valid: boolean; error?: string } {
  const expectedShape = OPERATOR_VALUE_SHAPES[operator]

  if (expectedShape === 'scalar') {
    if (value === null || value === undefined) {
      return { valid: false, error: 'Scalar value cannot be null or undefined' }
    }
    if (Array.isArray(value)) {
      return { valid: false, error: 'Expected scalar value, got array' }
    }
    return { valid: true }
  }

  if (expectedShape === 'array') {
    if (!Array.isArray(value)) {
      return { valid: false, error: 'Expected array value' }
    }
    if (operator === 'between' && value.length !== 2) {
      return { valid: false, error: 'Between operator requires [min, max] array' }
    }
    if (operator === 'between') {
      const [min, max] = value as [unknown, unknown]
      if (typeof min !== 'number' || typeof max !== 'number') {
        return { valid: false, error: 'Between operator requires numeric [min, max]' }
      }
      if (min > max) {
        return { valid: false, error: 'Between min must be <= max' }
      }
    }
    return { valid: true }
  }

  if (expectedShape === 'boolean') {
    if (typeof value !== 'boolean' && value !== undefined) {
      return { valid: false, error: 'Exists operator value should be boolean or omitted' }
    }
    return { valid: true }
  }

  return { valid: true }
}

