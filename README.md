# Taxxa ERP Aggregator

This platform enables accounting firms to manage clients across multiple ERP systems via a unified interface. It serves as foundational infrastructure for cross-ERP financial intelligence.

## System Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Integrated Platforms

The following platforms are currently supported:
- **Tripletex** (Norway) - Token-based Session Auth
- **Xero** (UK/Global) - OAuth 2.0 + PKCE Flow
- **e-conomic** (Denmark) - Dual-key Token System

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (or any Prisma-supported database)
- ERP Sandbox Accounts (Tripletex, Xero, e-conomic)

### Environment Setup
Create a `.env` file, copy the contents of `.env.example` and fill in the values.

### Installation
```bash
npm install
npx prisma generate
npx prisma db push
```

### Running the App
```bash
npm run dev
```

### Running Tests
```bash
npm test
```
