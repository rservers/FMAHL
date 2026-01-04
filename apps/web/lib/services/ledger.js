/**
 * Ledger Service for EPIC 07 - Billing & Payments
 *
 * Manages immutable provider ledger entries and balance tracking.
 *
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */
import { sql } from '../db';
/**
 * Create a ledger entry and update cached balance
 *
 * @param entry - Ledger entry data
 * @returns Created ledger entry ID
 */
export async function createLedgerEntry(entry) {
    // Get current balance
    const [provider] = await sql `
    SELECT balance FROM providers WHERE id = ${entry.provider_id}
  `;
    if (!provider) {
        throw new Error(`Provider not found: ${entry.provider_id}`);
    }
    const currentBalance = parseFloat(provider.balance.toString());
    // Calculate new balance based on entry type
    let newBalance;
    if (entry.entry_type === 'deposit' || entry.entry_type === 'refund' || entry.entry_type === 'manual_credit') {
        newBalance = currentBalance + entry.amount;
    }
    else if (entry.entry_type === 'lead_purchase' || entry.entry_type === 'manual_debit') {
        newBalance = currentBalance - entry.amount;
        if (newBalance < 0) {
            throw new Error(`Insufficient balance: ${currentBalance.toFixed(2)} < ${entry.amount.toFixed(2)}`);
        }
    }
    else {
        throw new Error(`Invalid entry type: ${entry.entry_type}`);
    }
    // Insert ledger entry
    const [ledgerEntry] = await sql `
    INSERT INTO provider_ledger (
      provider_id,
      entry_type,
      amount,
      balance_after,
      related_lead_id,
      related_subscription_id,
      related_payment_id,
      actor_id,
      actor_role,
      memo
    ) VALUES (
      ${entry.provider_id},
      ${entry.entry_type},
      ${entry.amount},
      ${newBalance},
      ${entry.related_lead_id || null},
      ${entry.related_subscription_id || null},
      ${entry.related_payment_id || null},
      ${entry.actor_id || null},
      ${entry.actor_role || null},
      ${entry.memo || null}
    )
    RETURNING id
  `;
    // Update cached balance
    await updateProviderBalance(entry.provider_id, newBalance);
    return ledgerEntry.id;
}
/**
 * Update provider's cached balance
 */
export async function updateProviderBalance(providerId, balance) {
    await sql `
    UPDATE providers
    SET balance = ${balance}
    WHERE id = ${providerId}
  `;
}
/**
 * Get provider's cached balance (fast read)
 */
export async function getProviderBalance(providerId) {
    const [provider] = await sql `
    SELECT balance FROM providers WHERE id = ${providerId}
  `;
    if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
    }
    return parseFloat(provider.balance.toString());
}
/**
 * Calculate balance from ledger entries (for reconciliation)
 */
export async function calculateBalance(providerId) {
    const entries = await sql `
    SELECT 
      entry_type,
      amount
    FROM provider_ledger
    WHERE provider_id = ${providerId}
    ORDER BY created_at ASC
  `;
    let balance = 0;
    for (const entry of entries) {
        const amount = parseFloat(entry.amount.toString());
        if (entry.entry_type === 'deposit' ||
            entry.entry_type === 'refund' ||
            entry.entry_type === 'manual_credit') {
            balance += amount;
        }
        else if (entry.entry_type === 'lead_purchase' || entry.entry_type === 'manual_debit') {
            balance -= amount;
        }
    }
    return balance;
}
/**
 * Get ledger history with pagination and filters
 */
export async function getLedgerHistory(providerId, query) {
    const { page = 1, limit = 50, entry_type, date_from, date_to } = query;
    const offset = (page - 1) * limit;
    // Build WHERE conditions
    const conditions = [`provider_id = $1`];
    const params = [providerId];
    let paramIndex = 2;
    if (entry_type) {
        conditions.push(`entry_type = $${paramIndex++}`);
        params.push(entry_type);
    }
    if (date_from) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(date_from);
    }
    if (date_to) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(date_to);
    }
    const whereClause = conditions.join(' AND ');
    // Get total count
    const countQuery = `
    SELECT COUNT(*) as total
    FROM provider_ledger
    WHERE ${whereClause}
  `;
    const [countResult] = await sql.unsafe(countQuery, params);
    const total = Number(countResult.total);
    // Get entries
    const entriesQuery = `
    SELECT 
      id,
      provider_id,
      entry_type,
      amount,
      balance_after,
      related_lead_id,
      related_subscription_id,
      related_payment_id,
      actor_id,
      actor_role,
      memo,
      created_at
    FROM provider_ledger
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
    params.push(limit, offset);
    const entries = await sql.unsafe(entriesQuery, params);
    const totalPages = Math.ceil(total / limit);
    return {
        entries: entries.map((entry) => ({
            id: entry.id,
            provider_id: entry.provider_id,
            entry_type: entry.entry_type,
            amount: parseFloat(entry.amount.toString()),
            balance_after: parseFloat(entry.balance_after.toString()),
            related_lead_id: entry.related_lead_id,
            related_subscription_id: entry.related_subscription_id,
            related_payment_id: entry.related_payment_id,
            actor_id: entry.actor_id,
            actor_role: entry.actor_role,
            memo: entry.memo,
            created_at: entry.created_at.toISOString(),
        })),
        pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
        },
    };
}
//# sourceMappingURL=ledger.js.map