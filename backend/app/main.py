from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app import models  # noqa: F401 — register models
from app.seed import seed_if_empty

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seeded = seed_if_empty(db)
        if seeded:
            print("База данных заполнена демо-данными")
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


@app.get("/", summary="Проверка работоспособности")
def root():
    return {
        "message": "Платформа подбора робототехники",
        "docs": "/docs",
        "api": "/api",
    }


@app.get("/health", summary="Healthcheck")
def health():
    return {"status": "ok"}
