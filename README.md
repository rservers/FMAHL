# 🔥 Find Me A Hot Lead

Multi-tenant B2B SaaS Lead Marketplace

## 🚀 Quick Start

1. Run setup:
```bash
./scripts/setup-local.sh

npm run dev
# ============================================
# ROOT FILES
# ============================================

cat > package.json << 'EOF'
{
  "name": "findmeahotlead",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspace=apps/web",
    "dev:worker": "npm run dev --workspace=apps/worker",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:worker\"",
    "build": "npm run build --workspaces",
    "docker:up": "docker-compose -f infrastructure/docker/docker-compose.local.yml up -d",
    "docker:down": "docker-compose -f infrastructure/docker/docker-compose.local.yml down",
    "docker:logs": "docker-compose -f infrastructure/docker/docker-compose.local.yml logs -f"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "typescript": "^5.3.3"
  }
}
