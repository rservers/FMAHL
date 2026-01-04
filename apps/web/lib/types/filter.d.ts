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
export type FilterOperator = 'eq' | 'neq' | 'in' | 'not_in' | 'contains' | 'gte' | 'lte' | 'between' | 'exists';
/**
 * Field types from niche form schema
 */
export type FieldType = 'select' | 'multi-select' | 'text' | 'number' | 'boolean' | 'radio';
/**
 * Single filter rule
 */
export interface FilterRule {
    field_key: string;
    operator: FilterOperator;
    value: unknown;
}
/**
 * Filter rules container (versioned)
 */
export interface FilterRules {
    version: number;
    rules: FilterRule[];
}
/**
 * Niche form field definition
 */
export interface NicheFormField {
    key: string;
    type: FieldType;
    label: string;
    required?: boolean;
    options?: Array<{
        value: string;
        label: string;
    }>;
}
/**
 * Niche form schema
 */
export interface NicheFormSchema {
    fields: NicheFormField[];
}
/**
 * Filter validation error
 */
export interface FilterValidationError {
    field_key?: string;
    operator?: string;
    message: string;
}
/**
 * Filter validation result
 */
export interface FilterValidationResult {
    valid: boolean;
    errors: FilterValidationError[];
}
/**
 * Field type to allowed operators mapping
 */
export declare const FIELD_TYPE_OPERATORS: Record<FieldType, FilterOperator[]>;
/**
 * Operator value shape requirements
 */
export declare const OPERATOR_VALUE_SHAPES: Record<FilterOperator, 'scalar' | 'array' | 'boolean'>;
//# sourceMappingURL=filter.d.ts.map