FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY parser/package.json ./parser/
COPY embedding-service/package.json ./embedding-service/
COPY vector-service/package.json ./vector-service/
COPY ai-service/package.json ./ai-service/
COPY backend/package.json ./backend/
COPY workers/package.json ./workers/
COPY frontend/package.json ./frontend/
RUN npm install --workspace=@codeatlas/backend --include-workspace-root=false || npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w shared && npm run build -w parser && npm run build -w embedding-service && npm run build -w vector-service && npm run build -w ai-service && npm run build -w backend

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["node", "backend/dist/index.js"]
