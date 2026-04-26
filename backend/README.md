# Backend (Calendar Booking API)

## Стек

- Node.js + TypeScript
- Fastify
- Zod
- In-memory хранилище (без БД)
- Vitest + Supertest

## Запуск

```bash
npm install --prefix backend
npm run --prefix backend dev
```

По умолчанию сервер поднимается на `http://localhost:3000`.

## Подключение фронтенда

Во фронтенде уже поддерживается переключение на реальный API через переменную:

- `VITE_API_BASE_URL=http://localhost:3000`

Если `VITE_API_BASE_URL` не задан, фронтенд продолжит использовать mock API.
