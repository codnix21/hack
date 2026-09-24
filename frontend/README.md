# Фронтенд

React + Vite + TypeScript интерфейс платформы.

Подробности запуска и архитектуры — в корневой документации:

- [../README.md](../README.md)
- [../docs/ЗАПУСК.md](../docs/ЗАПУСК.md)
- [../docs/API_И_АРХИТЕКТУРА.md](../docs/API_И_АРХИТЕКТУРА.md)

```bash
npm install
npm run dev      # разработка
npm test         # Vitest
npm run build    # production-сборка
npm run test:e2e # Playwright (нужен стек на :3000)
```

Переменная окружения: `VITE_API_URL` (по умолчанию `http://localhost:8000/api`).
