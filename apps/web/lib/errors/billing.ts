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
  constructor(public currentBalance: number, public requiredAmount: number) {
    super(`Insufficient balance: ${currentBalance.toFixed(2)} < ${requiredAmount.toFixed(2)}`)
    this.name = 'InsufficientBalanceError'
  }
}

/**
 * Payment not found error
 */
export class PaymentNotFoundError extends Error {
  constructor(public paymentId: string) {
    super(`Payment not found: ${paymentId}`)
    this.name = 'PaymentNotFoundError'
  }
}

/**
 * Duplicate payment error (idempotency)
 */
export class DuplicatePaymentError extends Error {
  constructor(public externalPaymentId: string) {
    super(`Payment already processed: ${externalPaymentId}`)
    this.name = 'DuplicatePaymentError'
  }
}

/**
 * Refund already processed error
 */
export class RefundAlreadyProcessedError extends Error {
  constructor(public assignmentId: string) {
    super(`Assignment already refunded: ${assignmentId}`)
    this.name = 'RefundAlreadyProcessedError'
  }
}

/**
 * Invalid refund amount error
 */
export class InvalidRefundAmountError extends Error {
  constructor(public requestedAmount: number, public originalAmount: number) {
    super(`Invalid refund amount: ${requestedAmount.toFixed(2)} != ${originalAmount.toFixed(2)}`)
    this.name = 'InvalidRefundAmountError'
  }
}

