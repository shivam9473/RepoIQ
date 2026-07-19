# CodeAtlas AI

AI-powered Code Intelligence Platform for understanding large codebases with RAG, AST-aware parsing, vector embeddings, and semantic search.

**Repository:** [shivam9473/RepoIQ](https://github.com/shivam9473/RepoIQ)

## Features

- GitHub OAuth + demo login
- Import public/private GitHub repositories
- Background indexing with BullMQ workers (progress tracking)
- AST-style symbol chunking (functions, classes, methods, interfaces)
- Embeddings via OpenAI / Voyage AI (local fallback for demo)
- Pinecone vector store (in-memory fallback for demo)
- Streaming repository Q&A with citations
- AI README / API docs / code review
- Duplicate detection
- Dependency graph (React Flow)
- Architecture overview
- Chat + search history dashboard

## Monorepo structure

```
frontend/            React + TypeScript + Tailwind + Monaco + React Flow
backend/             Express API (auth, repos, chat, insights)
workers/             BullMQ indexing pipeline
parser/              Multi-language AST-aware chunker
embedding-service/   Embedding generation
vector-service/      Pinecone / local vector search
ai-service/          RAG, docs, review, architecture
shared/              Shared TypeScript types
```

## Quick start

### 1. Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis) **or** local Postgres 16 + Redis 7

### 2. Environment

```bash
cp .env.example .env
```

Fill in optional keys:

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `OPENAI_API_KEY` — full LLM answers + embeddings
- `VOYAGE_API_KEY` — code-optimized embeddings
- `PINECONE_API_KEY` — production vector store

Without AI keys the platform still runs in **offline demo mode** (local embeddings + heuristic answers).

### 3. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 4. Install & run

```bash
npm install
npm run build -w shared
npm run db:migrate
npm run dev
```

Apps:

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:4000 |
| Workers  | background process |

### 5. Full Docker stack

```bash
cp .env.example .env
docker compose up -d --build
```

## Core workflow

1. Sign in (GitHub or demo)
2. Import a repository (`owner/repo`)
3. Worker clones → parses → embeds → stores vectors
4. Ask questions in Chat — semantic retrieval + streamed answer with file/function citations
5. Open Insights for architecture, dependency graph, README, review, duplicates

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/demo` | Demo login |
| GET | `/api/auth/github` | GitHub OAuth |
| GET | `/api/dashboard` | Dashboard stats |
| GET/POST | `/api/repos` | List / import repos |
| POST | `/api/chat/ask` | Streaming RAG Q&A |
| GET | `/api/insights/:id/*` | Architecture, docs, review, graph |

## Tech stack

**Frontend:** React, TypeScript, Tailwind CSS, React Router, React Query, Monaco, React Flow, Framer Motion  

**Backend:** Node.js, Express, TypeScript, PostgreSQL, Redis, BullMQ, JWT  

**AI:** OpenAI GPT-4.1, Voyage/OpenAI embeddings, Pinecone  

**Ops:** Docker Compose, GitHub Actions CI

## License

MIT
