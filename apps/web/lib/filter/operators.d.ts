/**
 * Filter Operator Evaluators for EPIC 05
 *
 * Implements evaluation logic for each filter operator.
 *
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */
/**
 * Evaluate eq (equals) operator
 */
export declare function evaluateEq(fieldValue: unknown, ruleValue: unknown): boolean;
/**
 * Evaluate neq (not equals) operator
 */
export declare function evaluateNeq(fieldValue: unknown, ruleValue: unknown): boolean;
/**
 * Evaluate in (in set) operator
 */
export declare function evaluateIn(fieldValue: unknown, ruleValue: unknown[]): boolean;
/**
 * Evaluate not_in (not in set) operator
 */
export declare function evaluateNotIn(fieldValue: unknown, ruleValue: unknown[]): boolean;
/**
 * Evaluate contains (contains substring/element) operator
 */
export declare function evaluateContains(fieldValue: unknown, ruleValue: unknown): boolean;
/**
 * Evaluate gte (>=) operator
 */
export declare function evaluateGte(fieldValue: unknown, ruleValue: unknown): boolean;
/**
 * Evaluate lte (<=) operator
 */
export declare function evaluateLte(fieldValue: unknown, ruleValue: unknown): boolean;
/**
 * Evaluate between (between inclusive) operator
 */
export declare function evaluateBetween(fieldValue: unknown, ruleValue: [number, number]): boolean;
/**
 * Evaluate exists (field exists and not empty) operator
 */
export declare function evaluateExists(fieldValue: unknown, ruleValue?: boolean): boolean;
//# sourceMappingURL=operators.d.ts.map