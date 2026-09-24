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
| `/economics` | расчёт, explain, what-if, sensitivity |
| `/scenarios` | сценарии проекта |
| `/visualization` | раскладка 2D |
| `/export` | PDF / Excel |
| `/demo` | демонстрационные проекты |
| `/analytics` | сводная аналитика |
| `/admin` | админка и импорт |

Интерактивная спецификация: http://localhost:8000/docs

## Роли

| Роль | Возможности |
|------|-------------|
| guest | демо, каталог, чтение без записи в общие данные |
| user | свои проекты, подбор, экономика, экспорт |
| admin | всё + админка и импорт материалов |

## Экспорт

- PDF: титул, резюме, параметры, решения, экономика, формулы, what-if, допущения, источники;
- Excel: листы «Титул», «Проект», «Параметры объекта», «Подобранные решения», «Сравнение», «Экономика», «Как рассчитано», «Сценарии», «Что если», «Допущения», «Источники».

Значения экономики в отчёте берутся из backend («Рассчитано платформой»), без расхождения с Excel-формулами.
