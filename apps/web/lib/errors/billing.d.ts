/**
 * Billing Errors for EPIC 07
 *
 * Custom error classes for billing operations.
 *
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */
/**
 * Insufficient balance error
 */
export declare class InsufficientBalanceError extends Error {
    currentBalance: number;
    requiredAmount: number;
    constructor(currentBalance: number, requiredAmount: number);
}
/**
 * Payment not found error
 */
export declare class PaymentNotFoundError extends Error {
    paymentId: string;
    constructor(paymentId: string);
}
/**
 * Duplicate payment error (idempotency)
 */
export declare class DuplicatePaymentError extends Error {
    externalPaymentId: string;
    constructor(externalPaymentId: string);
}
/**
 * Refund already processed error
 */
export declare class RefundAlreadyProcessedError extends Error {
    assignmentId: string;
    constructor(assignmentId: string);
}
/**
 * Invalid refund amount error
 */
export declare class InvalidRefundAmountError extends Error {
    requestedAmount: number;
    originalAmount: number;
    constructor(requestedAmount: number, originalAmount: number);
}
//# sourceMappingURL=billing.d.ts.map