/**
 * Ledger Service for EPIC 07 - Billing & Payments
 *
 * Manages immutable provider ledger entries and balance tracking.
 *
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */
import type { LedgerEntryType, LedgerActorRole, BillingHistoryQuery, BillingHistoryResponse } from '../types/billing';
/**
 * Create a ledger entry and update cached balance
 *
 * @param entry - Ledger entry data
 * @returns Created ledger entry ID
 */
export declare function createLedgerEntry(entry: {
    provider_id: string;
    entry_type: LedgerEntryType;
    amount: number;
    related_lead_id?: string | null;
    related_subscription_id?: string | null;
    related_payment_id?: string | null;
    actor_id?: string | null;
    actor_role?: LedgerActorRole | null;
    memo?: string | null;
}): Promise<string>;
/**
 * Update provider's cached balance
 */
export declare function updateProviderBalance(providerId: string, balance: number): Promise<void>;
/**
 * Get provider's cached balance (fast read)
 */
export declare function getProviderBalance(providerId: string): Promise<number>;
/**
 * Calculate balance from ledger entries (for reconciliation)
 */
export declare function calculateBalance(providerId: string): Promise<number>;
/**
 * Get ledger history with pagination and filters
 */
export declare function getLedgerHistory(providerId: string, query: BillingHistoryQuery): Promise<BillingHistoryResponse>;
//# sourceMappingURL=ledger.d.ts.map