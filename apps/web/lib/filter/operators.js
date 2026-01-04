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
export function evaluateEq(fieldValue, ruleValue) {
    return fieldValue === ruleValue;
}
/**
 * Evaluate neq (not equals) operator
 */
export function evaluateNeq(fieldValue, ruleValue) {
    return fieldValue !== ruleValue;
}
/**
 * Evaluate in (in set) operator
 */
export function evaluateIn(fieldValue, ruleValue) {
    if (!Array.isArray(ruleValue)) {
        return false;
    }
    return ruleValue.includes(fieldValue);
}
/**
 * Evaluate not_in (not in set) operator
 */
export function evaluateNotIn(fieldValue, ruleValue) {
    if (!Array.isArray(ruleValue)) {
        return false;
    }
    return !ruleValue.includes(fieldValue);
}
/**
 * Evaluate contains (contains substring/element) operator
 */
export function evaluateContains(fieldValue, ruleValue) {
    if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
        return fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
    }
    if (Array.isArray(fieldValue)) {
        return fieldValue.includes(ruleValue);
    }
    return false;
}
/**
 * Evaluate gte (>=) operator
 */
export function evaluateGte(fieldValue, ruleValue) {
    const fieldNum = typeof fieldValue === 'number' ? fieldValue : Number(fieldValue);
    const ruleNum = typeof ruleValue === 'number' ? ruleValue : Number(ruleValue);
    if (isNaN(fieldNum) || isNaN(ruleNum)) {
        return false;
    }
    return fieldNum >= ruleNum;
}
/**
 * Evaluate lte (<=) operator
 */
export function evaluateLte(fieldValue, ruleValue) {
    const fieldNum = typeof fieldValue === 'number' ? fieldValue : Number(fieldValue);
    const ruleNum = typeof ruleValue === 'number' ? ruleValue : Number(ruleValue);
    if (isNaN(fieldNum) || isNaN(ruleNum)) {
        return false;
    }
    return fieldNum <= ruleNum;
}
/**
 * Evaluate between (between inclusive) operator
 */
export function evaluateBetween(fieldValue, ruleValue) {
    if (!Array.isArray(ruleValue) || ruleValue.length !== 2) {
        return false;
    }
    const [min, max] = ruleValue;
    const fieldNum = typeof fieldValue === 'number' ? fieldValue : Number(fieldValue);
    if (isNaN(fieldNum)) {
        return false;
    }
    return fieldNum >= min && fieldNum <= max;
}
/**
 * Evaluate exists (field exists and not empty) operator
 */
export function evaluateExists(fieldValue, ruleValue) {
    const shouldExist = ruleValue !== false; // Default to true if omitted
    const exists = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    if (Array.isArray(fieldValue)) {
        return shouldExist ? fieldValue.length > 0 : fieldValue.length === 0;
    }
    return shouldExist === exists;
}
//# sourceMappingURL=operators.js.map