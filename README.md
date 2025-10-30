# SOC Watchtower Backend

> A production-ready Node.js backend for SOC Watchtower Dashboard (MERN stack).  
> Fully ESM + Node v22 compatible, includes Jest tests, ESLint, Prettier, and MongoDB integration.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Linting & Formatting](#linting--formatting)
- [Contribution](#contribution)

---

## Project Overview

SOC Watchtower Backend is a modern Node.js backend designed for scalability, maintainability, and enterprise-grade best practices.  
It currently supports:

- Express.js server setup
- Middleware for error handling & 404 routes
- ESM module syntax (Node v22)
- Jest for unit & integration tests
- ESLint + Prettier for code quality & formatting

---

## Features

- Node.js v22 + ESM modules
- Express-based API
- Preconfigured middleware for errors and 404
- Comprehensive Jest testing setup (unit & integration)
- ESLint flat config (v9+) for linting
- Prettier for auto-formatting
- Git ignore configured for production-safe commits

---

## Tech Stack

| Layer                | Technology           |
| -------------------- | -------------------- |
| Runtime              | Node.js v22          |
| Framework            | Express.js           |
| Testing              | Jest + Supertest     |
| Linting & Formatting | ESLint v9 + Prettier |
| Version Control      | Git                  |
| DB                   | MongoDB              |

---

## Prerequisites

- Node.js v22.x
- npm v9.x or above
- Git
- MongoDB

---

## Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/<your-org>/soc-watchtower-backend.git
cd soc-watchtower-backend

# Install dependencies
npm install
```

## Scripts

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `npm run dev`      | Start the server in development mode    |
| `npm test`         | Run all Jest tests (unit & integration) |
| `npm run lint`     | Check code for linting issues           |
| `npm run lint:fix` | Auto-fix linting issues                 |
| `npm run format`   | Auto-format code using Prettier         |

## Project Structure

```bash
soc-watchtower-backend/
│
├── src/
│   ├── controllers/        # Route handlers
│   ├── middlewares/        # Express middlewares (error, 404)
│   ├── routes/             # API routes
│   ├── services/           # Business logic / service layer
│   ├── config/             # App configuration (logger, db, etc.)
│   ├── utils/              # Utility functions
│   ├── tests/
│   │   ├── unit/           # Unit tests
│   │   └── integration/    # Integration tests
│   └── server.js           # App entrypoint
│
├── .env                    # Environment variables
├── package.json
├── eslint.config.js        # ESLint flat config
├── .prettierrc             # Prettier config
├── .gitignore
└── README.md
```

## Testing

Jest is configured for **unit and integration tests**:

```bash
npm test
```

Tests are written in ESM syntax (import/export)

Jest globals (describe, it, expect) are preconfigured

Example test folders: src/tests/unit and src/tests/integration

## Linting & Formatting

Check lint:

```bash
npm run lint
```

Auto-fix lint issues:

```bash
npm run lint:fix
```

Format code using Prettier:

```bash
npm run format
```

This ensures your code is consistent and production-ready.

## Contribution

1. Clone the repo
2. Create a new branch (`feature/your-feature`)
3. Commit your changes
4. Open a Pull Request

> Please ensure linting and tests pass before submitting a PR.
