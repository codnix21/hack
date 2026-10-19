# ezdxf в Docker backend

`ezdxf` нужен для превью DXF. В `requirements.txt` указан `ezdxf==1.3.5`.

## Воспроизводимая установка (предпочтительно)

1. **В образе (Dockerfile):** `COPY .wheels/` + `pip install --find-links=/tmp/wheels -r requirements.txt` + проверка `import ezdxf`.
2. **При старте контейнера (entrypoint + override):** если `ezdxf` отсутствует, ставится offline из смонтированного `backend/.wheels` → `/wheels` (`EZDXF_WHEELS_DIR`). Это переживает `docker compose up -d --force-recreate backend` без доступа к Docker Hub/PyPI.

Локальные wheels: `backend/.wheels/` (manylinux cp312, в `.gitignore`).

```powershell
# при необходимости обновить wheels с хоста (TLS включён):
# cd backend
# pip download "ezdxf==1.3.5" -d .wheels --python-version 312 --platform manylinux2014_x86_64 --only-binary=:all:
cd <repo>
docker compose up -d --force-recreate backend
docker compose exec -T backend python -c "import ezdxf; print(ezdxf.__version__)"
curl.exe -s http://127.0.0.1:8010/health
# ожидается: features.dxf_preview.available == true
```

Полная `docker compose build backend` требует доступ к Docker Hub за base-образом; при блокировке proxy/registry сборка может быть **NOT VERIFIED**, но runtime через wheels+entrypoint остаётся воспроизводимым.

## Аварийный способ без пересборки образа

Если образ старый и PyPI в контейнере недоступен:

```powershell
cd backend
docker cp .wheels bas-backend:/tmp/wheels
docker compose exec -T backend pip install --no-index --find-links=/tmp/wheels ezdxf==1.3.5
docker compose restart backend
```

Не отключайте проверку TLS. Не используйте `docker compose down -v`.
