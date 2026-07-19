FROM node:20-alpine AS build
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
RUN npm install --workspace=@codeatlas/frontend --include-workspace-root=false || npm install
COPY . .
RUN npm run build -w frontend

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
