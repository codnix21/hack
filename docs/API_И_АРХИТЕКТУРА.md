# Архитектура и API

## Стек

| Слой | Технологии |
|------|------------|
| Backend | Python, FastAPI, SQLAlchemy, Alembic, ReportLab, openpyxl |
| Frontend | React, TypeScript, Vite, Tailwind, TanStack Query |
| БД | PostgreSQL (Docker) / SQLite (локальные тесты) |
| Доставка | Docker Compose, nginx (frontend) |

## Модули backend

```
backend/app/
  api/          маршруты HTTP
  models/       модели БД
  schemas/      Pydantic-схемы
  services/     бизнес-логика (matching, economics, export, import_*)
  seed.py       начальные данные
```

Ключевые сервисы:

- `matching` — подбор и статусы;
- `economics` — CAPEX/OPEX/TCO/ROI, what-if, чувствительность;
- `visualization` — генерация демо-схемы объекта;
- `export` — PDF и Excel;
- `import_source_catalog` / `import_source_datasets` / `import_docx_examples` — материалы хакатона.

## Модули frontend

```
frontend/src/
  pages/              экраны
  components/         UI и панели проекта
  api/                клиент API
  store/              auth, toast
  utils/              форматы и русские подписи
```

## Основные группы API

Префикс: `/api`

| Группа | Назначение |
|--------|------------|
| `/auth` | вход, регистрация, гость, профиль |
| `/projects` | проекты и параметры |
| `/catalog` | каталог, фильтры, статистика |
| `/matching` | запуск и результаты подбора |
| `/economics` | расчёт, explain, what-if, sensitivity, fleet-compare |
| `/scenarios` | сценарии проекта (в т.ч. `fleet_*`) |
| `/visualization` | раскладка 2D / симуляция |
| `/export` | PDF / Excel |
| `/public` | просмотр и клон по токену (`/p/{token}`) |
| `/demo` | демонстрационные проекты |
| `/admin` | админка, импорт, cleanup-guests |

Интерактивная спецификация: http://127.0.0.1:8010/docs (Docker) или http://127.0.0.1:8000/docs (локально).

## Роли

| Роль | Возможности |
|------|-------------|
| guest | уникальная сессия; свои проекты (создание/правка/экспорт/публикация); демо — только чтение + копия |
| user | свои проекты, подбор, экономика, экспорт, публикация |
| admin | всё + админка, импорт, очистка гостей |

## Экспорт

- PDF: титул, резюме, параметры, решения, экономика, NPV/IRR, денежные потоки, сравнение сценариев, what-if, допущения, источники;
- Excel: «Титул», «Объект», «Параметры объекта», «Роботы», «Сравнение», «Симуляция», «Экономика», «Как рассчитано», «Сценарии», «Что если», «Допущения», «Источники и допущения».

Значения экономики в отчёте берутся из backend; отсутствующие расчёты помечаются «Нет данных».
