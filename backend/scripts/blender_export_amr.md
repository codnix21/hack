# Опциональный экспорт AMR из Blender

Blender **не** является зависимостью runtime NETCORE.

1. Откройте модель робота в реальных метрах (ширина ~0.8–1.2 м).
2. Origin — центр основания на полу; «нос» к −Z.
3. Export → glTF 2.0 Binary (`.glb`), +Y Up.
4. Сохраните как `frontend/public/models/amr.glb`.
5. Пересоберите frontend.

Автоматический `blender --background --python …` можно добавить локально; в CI/production не запускать.
