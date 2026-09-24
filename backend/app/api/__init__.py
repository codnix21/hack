from fastapi import APIRouter

from app.api import admin, analytics, auth, catalog, demo, economics, export, matching, projects, scenarios, visualization

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(catalog.router)
api_router.include_router(matching.router)
api_router.include_router(economics.router)
api_router.include_router(scenarios.router)
api_router.include_router(visualization.router)
api_router.include_router(analytics.router)
api_router.include_router(admin.router)
api_router.include_router(export.router)
api_router.include_router(demo.router)
