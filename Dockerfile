FROM node:24-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
