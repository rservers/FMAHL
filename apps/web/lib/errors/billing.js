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
export class InsufficientBalanceError extends Error {
    currentBalance;
    requiredAmount;
    constructor(currentBalance, requiredAmount) {
        super(`Insufficient balance: ${currentBalance.toFixed(2)} < ${requiredAmount.toFixed(2)}`);
        this.currentBalance = currentBalance;
        this.requiredAmount = requiredAmount;
        this.name = 'InsufficientBalanceError';
    }
}
/**
 * Payment not found error
 */
export class PaymentNotFoundError extends Error {
    paymentId;
    constructor(paymentId) {
        super(`Payment not found: ${paymentId}`);
        this.paymentId = paymentId;
        this.name = 'PaymentNotFoundError';
    }
}
/**
 * Duplicate payment error (idempotency)
 */
export class DuplicatePaymentError extends Error {
    externalPaymentId;
    constructor(externalPaymentId) {
        super(`Payment already processed: ${externalPaymentId}`);
        this.externalPaymentId = externalPaymentId;
        this.name = 'DuplicatePaymentError';
    }
}
/**
 * Refund already processed error
 */
export class RefundAlreadyProcessedError extends Error {
    assignmentId;
    constructor(assignmentId) {
        super(`Assignment already refunded: ${assignmentId}`);
        this.assignmentId = assignmentId;
        this.name = 'RefundAlreadyProcessedError';
    }
}
/**
 * Invalid refund amount error
 */
export class InvalidRefundAmountError extends Error {
    requestedAmount;
    originalAmount;
    constructor(requestedAmount, originalAmount) {
        super(`Invalid refund amount: ${requestedAmount.toFixed(2)} != ${originalAmount.toFixed(2)}`);
        this.requestedAmount = requestedAmount;
        this.originalAmount = originalAmount;
        this.name = 'InvalidRefundAmountError';
    }
}
//# sourceMappingURL=billing.js.map