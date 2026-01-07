# Find Me a Hot Lead
## Product Requirements Document — Phase 3: CRM, Communication & Ecosystem

**Document:** PRD — Phase 3  
**Version:** 1.1 (Revised)  
**Status:** Approved for Development  
**Scope:** Post-Phase 2 Expansion  
**Design Principle:** Trust-first, auditable, AI-ready, abuse-resistant  

---

## 1. Purpose & Strategic Intent

Phase 3 introduces a **controlled, auditable communication layer** and **provider CRM capabilities** that enable:

- Masked communication between end users and service providers
- Full message capture for admin review, fraud prevention, and ML/AI readiness
- End-user account creation for multi-lead, multi-niche engagement
- Provider workflows that prevent off-platform contact and spam

> **Core invariant:**  
> All communication originating from platform-generated leads must be observable, enforceable, and auditable by the platform.

---

## 2. Explicit Non-Goals (Hard Guardrails)

Phase 3 does **not** include:
- Platform ownership of sales outcomes
- Revenue sharing on closed deals
- Provider bidding or negotiation logic
- Open or anonymous chat systems
- Provider marketing or newsletter tools
- Replacing provider CRMs

Masked communication exists to **protect users, providers, and the marketplace**.

---

## 3. Personas & Roles

### 3.1 End User (Authenticated, Global Account)

End users may:
- Communicate with providers via masked channels
- Manage multiple leads across niches
- View matched providers per lead
- Control closure of conversations and leads

End-user accounts are **global across all niches**.

End users may not:
- Browse providers outside assigned matches
- Initiate unsolicited conversations

---

### 3.2 Service Provider — Sales User

- Initiates first contact after lead assignment
- Communicates via masked email only
- Views delivery/read status
- Reports outcomes and feedback

---

### 3.3 Service Provider — Manager

- Oversees team conversations
- Reviews delivery/read rates
- Ensures SLA adherence

---

### 3.4 Admin (Critical Oversight Role)

Admins have:
- Full visibility into all messages
- Delivery, read, bounce, and error details
- Authority to intervene or suspend communication
- Access to data for fraud detection and ML/AI

---

## 4. End-User Entry, Consent & Account Model

### 4.1 Masked Communication Opt-In

At lead submission, end users may select:

> ☑ **“Hide my email from service providers and communicate securely through the platform”**

If enabled:
- End-user email is **never shared**
- All communication is routed via the platform
- Consent is recorded

---

### 4.2 Account Creation & Authentication

If masked communication is enabled:

- Confirmation email:
  - Verifies email
  - Creates account
  - Prompts password setup

Accounts support:
- Login
- Password reset
- Session management

---

## 5. Masked Communication System (Core Capability)

### 5.1 Communication Rules (Authoritative)

- Providers **must initiate first contact**
- Communication occurs only via:
  - End-user email on profile
  - Service provider email on profile
- No CC/BCC to external addresses
- No forwarding to marketing lists

This prevents spam and off-platform abuse.

---

### 5.2 Relay Model

- Platform-owned relay addresses:
  - `user+leadID@platform`
  - `provider+leadID@platform`
- Replies are ingested, stored, and relayed
- All messages are HTML-capable

---

### 5.3 Delivery & Read Receipts

For each message, the platform records:
- Sent
- Delivered
- Read (where supported)

Visibility:
- End User: sent / delivered / read
- Service Provider: sent / delivered / read
- Admin: full technical details

---

### 5.4 Attachments & Content Support

Masked communication must support:
- Standard email HTML
- Attachments (quotes, PDFs, images)

Constraints:
- File size limits (configurable)
- Virus/malware scanning
- Attachment metadata logged

---

### 5.5 Message Size & Rate Limits

To prevent abuse:
- Max message size defined
- Rate limits per thread and per user
- Burst detection logged

Admins may adjust limits.

---

## 6. Message Capture, Storage & Integrity

All messages:
- Stored verbatim
- Immutable
- Associated with:
  - Lead ID
  - Provider ID
  - User ID
  - Asset / niche context
- Timestamped

Used for:
- Admin review
- Disputes
- Fraud analysis
- ML/AI (future)

---

## 7. Provider CRM Capabilities

### 7.1 Lead Inbox
- Assigned leads
- Conversation status
- Delivery/read indicators
- SLA timers

---

### 7.2 Conversation View
- Threaded messages
- Read-only lead data
- Attachment access

---

### 7.3 Outcome Reporting (Expanded)

Providers may report:
- Converted
- Not a fit
- Duplicate
- Bad lead (with reason)
- **No response**

Outcomes are **signals**, not authoritative truth.

---

## 8. End-User Offer & Conversation Management

End users may:
- View matched service providers per lead
- View conversations and attachments
- Close conversations with individual providers
- Close the entire lead

On closure, end users may optionally provide feedback:
- Offer not competitive
- No longer interested
- Chose a provider:
  - From platform
  - Outside the platform

Feedback is used for quality signals.

---

## 9. Conversation Closure & Lifecycle Rules

### 9.1 Who Can Close

- Service Provider: may close their thread only
- End User:
  - May close individual provider threads
  - May close the entire lead (stops all communication)

Closed conversations:
- Cannot receive new messages
- Remain visible for audit

---

### 9.2 Thread Expiry

- Conversations do **not auto-expire**
- Anti-spam enforcement handled via:
  - Rate limits
  - Manual/admin enforcement
  - Future automation

---

## 10. Undeliverable Messages & Bounce Handling

When a message fails:
- Sender sees status: **Not Delivered**
- Admin receives:
  - Bounce reason
  - Error classification:
    - Technical failure
    - Invalid email / bounce

If due to invalid end-user contact:
- Flagged as potential bad lead
- Admin may take corrective action for all providers

---

## 11. Admin Oversight & Intervention

Admins may:
- View all conversations
- See delivery/read/bounce diagnostics
- Suspend threads or users
- Use messages in disputes and enforcement

Admin access is read-only unless enforcement is triggered.

---

## 12. Permissions & Data Isolation

- End users: own conversations only
- Providers: own leads only
- Partners: no message access
- Admins: full access

Strict RBAC enforced.

---

## 13. Integrations & Exports

### 13.1 Webhooks
- Lead status changes
- Conversation metadata events

### 13.2 Exports
- Lead metadata
- Outcomes
- **No message body export by default**

---

## 14. Compliance, Privacy & Retention

- Message retention aligned with legal and business requirements
- Right-to-be-forgotten supported:
  - User account and profile data deleted
  - Conversation records anonymized (PII replaced, not deleted)
  - Message bodies retained as business records
  - Other parties see anonymized conversation history
- Providers subject to same anonymization rules on offboarding
- Audit logs immutable and retained per compliance requirements
- Data retention periods configurable by admin

---

## 15. Phase 4 Guardrails

Out of scope:
- Real-time chat
- AI auto-responses
- AI deal coaching
- Unmasked communication by default
- Marketing automation

---

## 16. Success Criteria (Phase 3)

Phase 3 succeeds when:
- End users feel safer and less spammed
- Providers communicate effectively
- Admins have visibility and control
- Message data enables ML/AI
- Fraud and abuse decrease measurably

---

## 17. Transition Readiness (AI & Automation)

Phase 3 must deliver:
- Structured message corpus
- Reliable delivery/read metrics
- Outcome and feedback signals

These are prerequisites for:
- AI moderation
- Auto-flagging
- Smart lead routing

---

## Conclusion

Phase 3 establishes a **secure communication and intelligence layer** that protects users, providers, and the platform while enabling future automation and AI-driven quality improvements.

**Status:** Phase 3 PRD — Revised & Approved
