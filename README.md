# 🔥 Find Me A Hot Lead

Multi-tenant B2B SaaS Lead Marketplace

## 📋 Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- Git

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd FMAHL

# Run the setup script (installs dependencies, starts Docker, runs migrations)
./scripts/setup-local.sh
```

The setup script will:
- Create `.env.local` from `.env.example` (if it doesn't exist)
- Start Docker services (PostgreSQL, Redis, MailHog)
- Install npm dependencies
- Run database migrations

### 2. Manual Setup (Alternative)

If you prefer to set up manually:

```bash
# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start Docker services
npm run docker:up

# Install dependencies
npm install

# Run database migrations
npm run db:migrate
```

### 3. Start Development

```bash
# Start web app only
npm run dev

# Start worker only
npm run dev:worker

# Start both web app and worker
npm run dev:all
```

The web app will be available at [http://localhost:3000](http://localhost:3000)

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start web app (Next.js)
- `npm run dev:worker` - Start background worker
- `npm run dev:all` - Start both web app and worker concurrently

### Database
- `npm run db:test` - Test database connection
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database (drops volumes, recreates, migrates)

### Docker
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services
- `npm run docker:logs` - View Docker logs

### Email
- `npm run email:test` - Test email service

### Build
- `npm run build` - Build all workspaces

## 🏗️ Project Structure

```
FMAHL/
├── apps/
│   ├── web/          # Next.js web application
│   └── worker/        # Background job worker (BullMQ)
├── packages/
│   ├── database/      # Database client and migrations
│   ├── email/         # Email service (MailHog, SES)
│   └── shared/        # Shared utilities and types
├── infrastructure/
│   ├── docker/        # Docker Compose configurations
│   ├── postgres/      # PostgreSQL initialization scripts
│   └── nginx/         # Nginx configuration (production)
└── scripts/           # Setup and utility scripts
```

## 🔧 Services

When running locally, the following services are available:

- **Web App**: http://localhost:3000
- **MailHog UI**: http://localhost:8025 (view emails sent in development)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📝 Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `EMAIL_PROVIDER` - Email provider (`mailhog` for local dev)

### Billing & Payments (EPIC 07)

**Stripe:**
- `STRIPE_SECRET_KEY` - Stripe secret key (test mode: `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (`whsec_...`)
- `STRIPE_SUCCESS_URL` - Success redirect URL (default: `http://localhost:3000/billing/success`)
- `STRIPE_CANCEL_URL` - Cancel redirect URL (default: `http://localhost:3000/billing/cancel`)

**PayPal:**
- `PAYPAL_CLIENT_ID` - PayPal client ID
- `PAYPAL_CLIENT_SECRET` - PayPal client secret
- `PAYPAL_MODE` - PayPal mode (`sandbox` or `live`, default: `sandbox`)
- `PAYPAL_SUCCESS_URL` - Success redirect URL
- `PAYPAL_CANCEL_URL` - Cancel redirect URL

**Billing Configuration:**
- `MIN_DEPOSIT_USD` - Minimum deposit amount (default: `10.00`)

**Note:** For local development, you can use dummy values:
```env
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
PAYPAL_CLIENT_ID=dummy
PAYPAL_CLIENT_SECRET=dummy
```

## 🗄️ Database

The database uses PostgreSQL with PostGIS extension for location-based features.

- **Migrations**: Run `npm run db:migrate` to apply schema changes
- **Schema**: Defined in `packages/database/schema.sql`
- **Connection Test**: Run `npm run db:test` to verify connectivity

## 📧 Email

For local development, emails are captured by MailHog. View them at http://localhost:8025

For production, configure AWS SES or Resend in `.env.local`.

## 🧪 Testing

```bash
# Test database connection
npm run db:test

# Test email service
npm run email:test
```

## 📚 Documentation

### Getting Started

| Document | Purpose |
|----------|---------|
| `.cursor/docs/DEVELOPMENT_GUIDE.md` | **Start here!** Development workflow |
| `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` | **Epic order & dependencies** |

### Epic Status

| Phase | Epic | Name | Status |
|-------|------|------|--------|
| 1 | 01 | Platform Foundation | ✅ Done |
| 1 | 01 | Platform Foundation | ✅ Done |
| 2 | 10 | Email Infrastructure | ✅ Done |
| 3 | 02 | Lead Intake | ✅ Done |
| 3 | 03 | Admin Lead Review | ✅ Done |
| 2 | 04 | Competition Levels | ✅ Done |
| 3 | 05 | Filters & Eligibility | ✅ Done |
| 2 | 07 | Billing & Payments | ✅ Done |
| 4 | 06 | Distribution Engine | ✅ Done |
| 5 | 08-09 | Provider UX & Refunds | ⬜ Pending |
| 6 | 11-12 | Reporting & Ops | ⬜ Pending |

### Product Requirements
- `Document_0_Product_Overview.md` - Product vision
- `Document_1_PRD_MVP.md` - MVP requirements
- `Document_4_Technical_Architecture.md` - System architecture

### Delivery Epics
- `EPIC_EXECUTION_PLAN.md` - **Epic order & timeline**
- `build_plan_mvp_epics.md` - Epic summaries
- `Epic_01` through `Epic_12` - Detailed epic specs

### Email & Auth Flows (EPIC 10)
- Verification: `POST /api/v1/auth/register`, `POST /api/v1/auth/resend-verification`
- Password reset: `POST /api/v1/auth/forgot-password`
- Webhook: `POST /api/v1/webhooks/ses` (SNS → SES events)
- Admin: `/api/v1/admin/email-templates`, `/api/v1/admin/email-events`
- Local email UI: MailHog http://localhost:8025

### Billing & Payments (EPIC 07)
- Provider deposits: `POST /api/v1/provider/deposits` (Stripe/PayPal)
- Billing history: `GET /api/v1/provider/billing/history`
- Webhooks: `POST /api/v1/webhooks/stripe`, `POST /api/v1/webhooks/paypal`
- Admin refunds: `POST /api/v1/admin/lead-assignments/:id/refund`
- Admin balance adjustments: `POST /api/v1/admin/providers/:id/balance-adjust`
- Admin billing oversight: `GET /api/v1/admin/billing/providers`, `GET /api/v1/admin/payments`

### Distribution Engine (EPIC 06)
- Manual distribution trigger: `POST /api/v1/admin/leads/:id/distribute`
- Distribution status: `GET /api/v1/admin/leads/:id/distribution-status`
- Lead assignments list: `GET /api/v1/admin/leads/:id/assignments`
- Auto-distribution: Enabled via `AUTO_DISTRIBUTE_ON_APPROVAL=true` env var

## 🚢 Deployment

See individual app READMEs for deployment instructions:
- `apps/web/README.md` - Web app deployment
- `apps/worker/README.md` - Worker deployment

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

[Add your license here]
