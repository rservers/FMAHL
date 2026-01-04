/**
 * Eligibility Evaluator for EPIC 05
 *
 * Evaluates lead form data against filter rules to determine eligibility.
 * Implements fail-safe behavior: invalid filters = ineligible.
 *
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */
import { FilterRules, NicheFormSchema } from '../types/filter';
export interface EligibilityResult {
    eligible: boolean;
    reasons?: string[];
}
export interface EligibilityOptions {
    debug?: boolean;
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
export declare function evaluateEligibility(leadFormData: Record<string, unknown>, filterRules: FilterRules, nicheSchema: NicheFormSchema, options?: EligibilityOptions): EligibilityResult;
//# sourceMappingURL=evaluator.d.ts.map