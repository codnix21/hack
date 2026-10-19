from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app import models  # noqa: F401 — register models
from app.seed import seed_if_empty
from app.services.safe_errors import log_safe_exception, public_error_detail

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Повторная проверка (на случай обхода get_settings в тестах)
    settings.validate_for_runtime()
    if settings.is_production:
        print("Режим: production (демо-секреты запрещены)")
    else:
        print("Режим: demo (допустимы демонстрационные учётные данные seed)")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seeded = seed_if_empty(db)
        if seeded:
            print("База данных заполнена демо-данными")
        # Идемпотентная очистка истёкших гостевых сессий при старте
        try:
            from app.services.cleanup_guests import cleanup_expired_guests

            stats = cleanup_expired_guests(db)
            if stats.get("removed_guest_users") or stats.get("removed_projects"):
                print(
                    f"Очистка гостей: пользователей={stats['removed_guest_users']}, "
                    f"проектов={stats['removed_projects']}"
                )
        except Exception as exc:  # noqa: BLE001 — старт не должен падать
            print(f"Очистка гостей пропущена: {exc}")
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "API платформы подбора робототехнических решений: каталог, подбор, "
        "экономика (прозрачные формулы), сценарии, визуализация, экспорт."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Неожиданные ошибки → нейтральный 500 без traceback в теле ответа."""
    from fastapi import HTTPException
    from starlette.exceptions import HTTPException as StarletteHTTPException

    # На случай, если handler вызван для HTTPException — не подменяем семантику
    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    log_safe_exception("unhandled", exc, path=str(request.url.path), method=request.method)
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера. Попробуйте позже."},
    )


@app.get("/", summary="Проверка работоспособности")
def root():
    return {
        "message": "Платформа подбора робототехники",
        "docs": "/docs",
        "api": "/api",
    }


@app.get("/health", summary="Healthcheck")
def health():
    """Статус сервиса и опциональных зависимостей (ezdxf для DXF preview)."""
    ezdxf_info: dict = {"available": False, "version": None, "error": None}
    try:
        import ezdxf

        ezdxf_info = {"available": True, "version": ezdxf.__version__, "error": None}
    except Exception as exc:  # noqa: BLE001 — диагностика, не падаем
        # Без путей/traceback в публичном health
        ezdxf_info = {
            "available": False,
            "version": None,
            "error": public_error_detail(exc, fallback="модуль недоступен"),
        }
    status = "ok" if ezdxf_info["available"] else "degraded"
    return {
        "status": status,
        "environment": settings.ENVIRONMENT,
        "features": {"dxf_preview": ezdxf_info},
        # Секреты и их значения намеренно не включаются
    }
