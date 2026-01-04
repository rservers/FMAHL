/**
 * Filter Types for EPIC 05 - Filters & Eligibility
 * 
 * Defines TypeScript types for filter rules, operators, and validation.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

/**
 * Filter operators supported in MVP
 */
export type FilterOperator =
  | 'eq' // equals
  | 'neq' // not equals
  | 'in' // in set
  | 'not_in' // not in set
  | 'contains' // contains substring/element
  | 'gte' // >=
  | 'lte' // <=
  | 'between' // between inclusive [min, max]
  | 'exists' // field exists and not empty

/**
 * Field types from niche form schema
 */
export type FieldType = 'select' | 'multi-select' | 'text' | 'number' | 'boolean' | 'radio'

/**
 * Single filter rule
 */
export interface FilterRule {
  field_key: string
  operator: FilterOperator
  value: unknown // scalar, array, or [min, max] for between
}

/**
 * Filter rules container (versioned)
 */
export interface FilterRules {
  version: number
  rules: FilterRule[]
}

/**
 * Niche form field definition
 */
export interface NicheFormField {
  key: string
  type: FieldType
  label: string
  required?: boolean
  options?: Array<{ value: string; label: string }> // For select/radio/multi-select
}

/**
 * Niche form schema
 */
export interface NicheFormSchema {
  fields: NicheFormField[]
}

/**
 * Filter validation error
 */
export interface FilterValidationError {
  field_key?: string
  operator?: string
  message: string
}

/**
 * Filter validation result
 */
export interface FilterValidationResult {
  valid: boolean
  errors: FilterValidationError[]
}

/**
 * Field type to allowed operators mapping
 */
export const FIELD_TYPE_OPERATORS: Record<FieldType, FilterOperator[]> = {
  select: ['eq', 'neq', 'in', 'not_in', 'exists'],
  'multi-select': ['in', 'not_in', 'contains', 'exists'],
  text: ['eq', 'neq', 'contains', 'exists'],
  number: ['eq', 'neq', 'gte', 'lte', 'between', 'exists'],
  boolean: ['eq', 'exists'],
  radio: ['eq', 'neq', 'exists'],
}

/**
 * Operator value shape requirements
 */
export const OPERATOR_VALUE_SHAPES: Record<FilterOperator, 'scalar' | 'array' | 'boolean'> = {
  eq: 'scalar',
  neq: 'scalar',
  in: 'array',
  not_in: 'array',
  contains: 'scalar',
  gte: 'scalar',
  lte: 'scalar',
  between: 'array', // [min, max]
  exists: 'boolean',
}

