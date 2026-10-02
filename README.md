# Finance Tracker API Backend

A production-ready Node.js, Express & TypeScript backend for personal finance, bill tracking, budgeting, and asset valuation.

## 🚀 Features
- **Bills & Subscriptions**: Track upcoming bills with automated due alerts (1-3 days window) and automatic subscription rollovers.
- **Budget Limits**: Category-based budget caps with threshold alerts (%80 and %100).
- **Currency & Gold Valuation**: Live USD, EUR, and Gram Gold rates with 24-hour caching.
- **Savings Progress**: Real-time progress percentage, velocity run-rate, and ETA calculations.
- **CSV Reports**: Export transactions to CSV.
- **PostgreSQL & Docker**: Multi-stage Dockerfile, auto-schema migration, optimized for Neon.tech and Railway.

## 🛠️ Local Development
```bash
npm install
npm run build
npm run dev
```

## 📦 Deployment on Railway
1. Push this repository to GitHub.
2. Open Railway.app, select **"Deploy from GitHub repo"**.
3. Set Environment Variables:
   - `DATABASE_URL`: Your Neon.tech connection string with `?sslmode=require`.
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
