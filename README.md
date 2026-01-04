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

- Architecture and design docs: `.cursor/docs/`
- Epics and delivery plans: `.cursor/docs/Delivery/`
- Product requirements: `.cursor/docs/Products/`

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
