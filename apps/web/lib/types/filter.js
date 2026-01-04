/**
 * Filter Types for EPIC 05 - Filters & Eligibility
 *
 * Defines TypeScript types for filter rules, operators, and validation.
 *
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */
/**
 * Field type to allowed operators mapping
 */
export const FIELD_TYPE_OPERATORS = {
    select: ['eq', 'neq', 'in', 'not_in', 'exists'],
    'multi-select': ['in', 'not_in', 'contains', 'exists'],
    text: ['eq', 'neq', 'contains', 'exists'],
    number: ['eq', 'neq', 'gte', 'lte', 'between', 'exists'],
    boolean: ['eq', 'exists'],
    radio: ['eq', 'neq', 'exists'],
};
/**
 * Operator value shape requirements
 */
export const OPERATOR_VALUE_SHAPES = {
    eq: 'scalar',
    neq: 'scalar',
    in: 'array',
    not_in: 'array',
    contains: 'scalar',
    gte: 'scalar',
    lte: 'scalar',
    between: 'array', // [min, max]
    exists: 'boolean',
};
//# sourceMappingURL=filter.js.map