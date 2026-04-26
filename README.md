### Hexlet tests and linter status:
[![Actions Status](https://github.com/tarasovem/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/tarasovem/ai-for-developers-project-386/actions)

## Docker

Сборка образа:

```bash
docker build -t ai-for-developers-project-386 .
```

Запуск контейнера с портом из переменной окружения `PORT`:

```bash
docker run --rm -e PORT=3000 -p 3000:3000 ai-for-developers-project-386
```

## Публичный деплой

- Публичная ссылка: https://ai-for-dev-386-api-v5.onrender.com/public/event-types