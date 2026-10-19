# NETCORE — Runbook демонстрации

Дата: 2026-10-18.

## Предварительные требования

- Docker Desktop / Docker Compose
- Node.js 20+ (для `npm run build:demo`)
- Локальные wheels: `backend/.wheels/` (ezdxf 1.3.5 и зависимости; в `.gitignore`)
- **Не** выполнять `docker compose down -v` (том `pgdata`)

## Безопасный запуск

```powershell
cd C:\Users\death\Desktop\hack
docker compose up -d
cd frontend
npm run build:demo
cd ..
docker compose up -d frontend
```

Порты по умолчанию: **127.0.0.1:8910** (UI), **127.0.0.1:8010** (API) — не вся сеть.

## Проверка

```powershell
docker compose ps
curl.exe -s http://127.0.0.1:8010/health
# ожидается status ok / degraded, features.dxf_preview.available, environment: demo
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:8910/
```

## Маршрут 5–7 минут

1. Открыть http://127.0.0.1:8910 → Войти → «Продолжить как гость».
2. Демонстрация → открыть складской пример.
3. Объект: полнота данных; при правках — сохранить / guard при уходе.
4. Планировка: крупный canvas; опционально DXF preview → применить.
5. Подбор: статусы и missing_checks.
6. Экономика: CAPEX / эффект / амортизация (бух.) / покрытие пика.
7. Сценарии / what-if; симуляция DES (не twin).
8. Отчёт → PDF и Excel; reload проекта.
9. Демо read-only: правка запрещена; клон для редактирования.

## Ограничения планировки и DES (честно на защите)

- Единый контракт: метры, X вправо, Y вниз; объект `(x, y, width, height)` + `rotation` (OBB).
- Планировщик: zoom/pan/«По размеру», привязка к сетке, курсор в метрах — мировые координаты не меняются от масштаба UI.
- **A*** шаг 0.75 м + LOS; clearance демо-робота ≈ 0.65 м (не физическая проходимость).
- Задания с индивидуальными маршрутами; выбор задания подсвечивает маршрут.
- На схеме ≤ 6 роботов; конфликт — базовое ожидание. Батарея — демо. Iso/3D — стилизация.

## Ожидаемые контрольные цифры (склад / 8 роботов)

См. `docs/DEFENSE_CHEATSHEET.md` — Product Readiness vs Defense Rehearsal **не смешивать**.

## Типовые проблемы

| Симптом | Действие |
|---|---|
| Нет ezdxf / DXF 500 | `backend/.wheels` смонтирован? `docker compose up -d --force-recreate backend` (entrypoint ставит offline) |
| UI старый | `npm run build:demo` (dist монтируется override) |
| PyPI / Docker Hub недоступны | не отключать TLS; использовать wheels; чистая `build` может быть BLOCKED |
| Production SECRET_KEY | задать длинный ключ + `ENVIRONMENT=production` |

## Восстановление (без потери БД)

```powershell
docker compose up -d --force-recreate backend
docker compose up -d frontend
# НЕ: docker compose down -v
```

## Запреты

- `docker compose down -v`
- удаление volume `pgdata`
- отключение проверки TLS
- объявление чистой сборки образа успешной без фактического PASS
