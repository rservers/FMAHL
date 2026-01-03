# Cursor Runtime Rules for Find Me A Hot Lead

This document defines the explicit runtime semantics for cursor management, leasing, checkpointing, retry policies, and operational best practices for the Find Me A Hot Lead platform.

---

## 1. Cursor State Storage

A dedicated database table stores cursor positions and lease metadata.

```sql
CREATE TABLE IF NOT EXISTS cursor_positions (
  cursor_name TEXT PRIMARY KEY,                    -- e.g. 'lead_intake_v1', 'distribution_niche_<uuid>'
  last_position TEXT,                              -- opaque position token (message id, offset, etc.)
  last_processed_at TIMESTAMPTZ DEFAULT NOW(),
  lease_owner TEXT,                                -- worker id (hostname/pid/uuid)
  lease_expires_at TIMESTAMPTZ,                    -- when lease expires
  error_count INTEGER DEFAULT 0,
  paused BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'                      -- free-form for versioning, hints
);

CREATE INDEX IF NOT EXISTS idx_cursor_positions_lease_expires_at ON cursor_positions(lease_expires_at);
```

---

## 2. Lease and Heartbeat Semantics

- Lease duration: 60–120 seconds (tunable per cursor)
- Heartbeat renewal interval: 20–30 seconds
- Lease acquisition attempts must be atomic and respect existing leases
- Expired leases can be stolen by other workers

---

## 3. Checkpointing

- Checkpoints represent the last successfully processed position
- Checkpoint updates must be atomic with any side effects (e.g., lead assignment + billing)
- Use database transactions to ensure atomicity

---

## 4. Retry and Backoff Policy

- Max retries per message: 5
- Exponential backoff intervals: 1m, 2m, 5m, 15m, 60m
- After max retries, move message to dead-letter queue or alert for manual intervention

---

## 5. Idempotency

- Use explicit idempotency keys for all domain operations
- Deduplicate retried requests across HTTP and background workers

---

## 6. Concurrency and Ordering

- Limit concurrency per niche or competition level as needed
- Preserve ordering guarantees where required by business logic

---

## 7. Failure and Recovery

- Provide admin controls to pause/resume cursors
- Allow manual checkpoint adjustments for recovery
- Reconcile partially applied work carefully

---

## 8. Monitoring and Alerting

- Metrics to expose:
  - cursor_last_position{cursor_name}
  - cursor_processed_rate_per_minute{cursor_name}
  - cursor_lag_seconds{cursor_name}
  - cursor_error_count{cursor_name}
  - cursor_lease_steal_count{cursor_name}
- Alerts for lag, repeated lease steals, and error thresholds

---

## 9. Testing Requirements

- Integration tests for resume-from-checkpoint
- Worker crash and lease steal scenarios
- Idempotency property tests

---

## 10. Migration and Versioning

- Version cursor rules explicitly
- Provide migration paths for rule changes

---

## 11. Example Lease Management Code (Node.js / TypeScript)

```typescript
// Acquire a lease (returns true if acquired)
async function acquireLease(pg, cursorName, workerId, leaseSeconds = 60) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);
  const res = await pg.query(
    `INSERT INTO cursor_positions(cursor_name, lease_owner, lease_expires_at)
     VALUES($1, $2, $3)
     ON CONFLICT (cursor_name) DO UPDATE
     SET lease_owner = CASE WHEN cursor_positions.lease_expires_at < now() OR cursor_positions.lease_owner = $2 THEN $2 ELSE cursor_positions.lease_owner END,
         lease_expires_at = CASE WHEN cursor_positions.lease_expires_at < now() OR cursor_positions.lease_owner = $2 THEN $3 ELSE cursor_positions.lease_expires_at END
     WHERE cursor_positions.paused = false
     RETURNING lease_owner, lease_expires_at`,
    [cursorName, workerId, leaseUntil.toISOString()]
  );
  return res.rowCount > 0 && res.rows[0].lease_owner === workerId;
}

// Heartbeat / renew lease
async function renewLease(pg, cursorName, workerId, leaseSeconds = 60) {
  const leaseUntil = new Date(Date.now() + leaseSeconds * 1000);
  const res = await pg.query(
    `UPDATE cursor_positions
     SET lease_expires_at = $3
     WHERE cursor_name = $1 AND lease_owner = $2 AND paused = false
     RETURNING lease_expires_at`,
    [cursorName, workerId, leaseUntil.toISOString()]
  );
  return res.rowCount === 1;
}

// Checkpoint after processing a batch (atomic update)
async function checkpoint(pg, cursorName, workerId, newPosition) {
  await pg.query('BEGIN');
  try {
    // ... perform business work here ...
    await pg.query(
      `UPDATE cursor_positions
       SET last_position = $2, last_processed_at = now(), lease_owner = $3, error_count = 0
       WHERE cursor_name = $1 AND lease_owner = $3`,
      [cursorName, newPosition, workerId]
    );
    await pg.query('COMMIT');
    return true;
  } catch (err) {
    await pg.query('ROLLBACK');
    await pg.query(
      `UPDATE cursor_positions SET error_count = error_count + 1 WHERE cursor_name = $1`,
      [cursorName]
    );
    throw err;
  }
}
```

---

## 12. Operational Recommendations

- Lease duration: 60–120s
- Heartbeat renew every 20–30s
- Max retries: 5 with exponential backoff
- Use durable DB transactions for checkpointing
- Admin UI for pause/resume and manual checkpoint

---

## 13. Monitoring Metrics

- cursor_last_position{cursor_name}
- cursor_processed_rate_per_minute{cursor_name}
- cursor_lag_seconds{cursor_name}
- cursor_error_count{cursor_name}
- cursor_lease_steal_count{cursor_name}

---

## 14. Alerts

- Lag > threshold for X minutes
- Repeated lease steals
- Error count > threshold

---

## 15. Testing

- Resume from checkpoint
- Worker crash and lease steal
- Idempotency

---

## 16. Migration

- Versioning and migration paths

---

*End of Cursor Runtime Rules*