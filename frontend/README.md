# Фронтенд

React + Vite + TypeScript интерфейс платформы.

Подробности запуска и архитектуры — в корневой документации:

- [../README.md](../README.md)
- [../docs/ЗАПУСК.md](../docs/ЗАПУСК.md)
- [../docs/API_И_АРХИТЕКТУРА.md](../docs/API_И_АРХИТЕКТУРА.md)

```bash
npm install
npm run dev        # разработка (proxy /api → :8010)
npm test           # Vitest
npm run build      # production-сборка
npm run build:demo # сборка с VITE_API_URL=/api (для Docker :8910)
npm run test:e2e   # Playwright (стек на http://127.0.0.1:8910)
```

Переменная окружения: `VITE_API_URL` (в Docker-демо — `/api`).
