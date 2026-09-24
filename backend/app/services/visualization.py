"""Генерация 2D-раскладки и конфигурации симуляции (демо-схема, не CAD)."""

from __future__ import annotations

from typing import Any, Optional


def _detect_object_kind(params: dict) -> str:
    """Определяет тип объекта: warehouse | airport | medical."""
    explicit = (
        params.get("object_type")
        or params.get("facility_type")
        or params.get("object_kind")
        or params.get("facility_kind")
        or ""
    )
    blob_parts = [
        str(explicit),
        str(params.get("name") or ""),
        str(params.get("object_name") or ""),
        str(params.get("description") or ""),
        " ".join(str(k) for k in params.keys()),
    ]
    blob = " ".join(blob_parts).lower()

    medical_keys = (
        "medical",
        "hospital",
        "clinic",
        "ward",
        "палат",
        "медицин",
        "больниц",
        "клиник",
        "стационар",
    )
    airport_keys = (
        "airport",
        "apron",
        "baggage",
        "cargo_apron",
        "аэропорт",
        "багаж",
        "перрон",
        "терминал",
    )

    if any(k in blob for k in medical_keys):
        return "medical"
    if any(k in blob for k in airport_keys):
        return "airport"
    return "warehouse"


def _assign_robots(
    robots_count: int,
    routes: list[dict],
    width_m: float,
    length_m: float,
) -> list[dict]:
    robots: list[dict] = []
    n_routes = max(len(routes), 1)
    for i in range(max(0, robots_count)):
        route = routes[i % n_routes] if routes else None
        start = (route or {}).get("points") or [{"x": width_m * 0.1, "y": length_m * 0.9}]
        p0 = start[0]
        robots.append(
            {
                "id": f"robot_{i + 1}",
                "name": f"Робот {i + 1}",
                "x": round(float(p0.get("x", width_m * 0.1)), 2),
                "y": round(float(p0.get("y", length_m * 0.9)), 2),
                "heading_deg": 0,
                "route_id": (route or {}).get("id") or "",
            }
        )
    return robots


def _warehouse_layout(
    width_m: float,
    length_m: float,
    zones_count: int,
    charging_stations: int,
    load_points: int,
    unload_points: int,
) -> tuple[list, list, list, list]:
    """Стеллажи, проходы, загрузка/выгрузка, зарядка — читаемая демо-схема."""
    zones: list[dict] = []
    # Не больше 3 стеллажных блоков — иначе подписи и роботы наезжают друг на друга
    rack_cols = max(2, min(int(zones_count or 3), 3))
    margin_x = width_m * 0.08
    margin_y = length_m * 0.10
    aisle_gap = width_m * 0.06
    usable_w = width_m - 2 * margin_x - aisle_gap * (rack_cols - 1)
    rack_w = usable_w / rack_cols
    rack_y = length_m * 0.28
    rack_h = length_m * 0.42
    colors = ["#c5d0dc", "#b8c5d4", "#aebccb"]

    for i in range(rack_cols):
        x = margin_x + i * (rack_w + aisle_gap)
        zones.append(
            {
                "id": f"rack_{i + 1}",
                "name": f"С{i + 1}",
                "type": "storage",
                "color": colors[i % len(colors)],
                "x": round(x, 2),
                "y": round(rack_y, 2),
                "width": round(rack_w * 0.9, 2),
                "height": round(rack_h, 2),
                "title": f"Стеллаж {i + 1}",
            }
        )

    zones.append(
        {
            "id": "aisle_main",
            "name": "Проход",
            "type": "aisle",
            "color": "#e2e8f0",
            "x": round(margin_x * 0.5, 2),
            "y": round(length_m * 0.74, 2),
            "width": round(width_m - margin_x, 2),
            "height": round(length_m * 0.10, 2),
            "title": "Главный проход",
        }
    )
    zones.append(
        {
            "id": "load_zone",
            "name": "Загрузка",
            "type": "load",
            "color": "#ffedd5",
            "x": round(margin_x * 0.5, 2),
            "y": round(margin_y * 0.4, 2),
            "width": round(width_m * 0.40, 2),
            "height": round(length_m * 0.14, 2),
        }
    )
    zones.append(
        {
            "id": "unload_zone",
            "name": "Выгрузка",
            "type": "unload",
            "color": "#dbeafe",
            "x": round(width_m * 0.52, 2),
            "y": round(margin_y * 0.4, 2),
            "width": round(width_m * 0.40, 2),
            "height": round(length_m * 0.14, 2),
        }
    )
    zones.append(
        {
            "id": "charge_bay",
            "name": "ЗС",
            "type": "service",
            "color": "#dcfce7",
            "x": round(margin_x * 0.5, 2),
            "y": round(length_m * 0.88, 2),
            "width": round(width_m * 0.28, 2),
            "height": round(length_m * 0.08, 2),
            "title": "Зарядная станция",
        }
    )

    # Контур: загрузка → правый край → проход → левый край → загрузка
    top_y = length_m * 0.16
    bottom_y = length_m * 0.79
    left_x = margin_x * 0.7
    right_x = width_m - margin_x * 0.7
    routes: list[dict] = [
        {
            "id": "route_main",
            "name": "Главный маршрут",
            "points": [
                {"x": round(width_m * 0.22, 2), "y": round(top_y, 2)},
                {"x": round(width_m * 0.72, 2), "y": round(top_y, 2)},
                {"x": round(right_x, 2), "y": round(top_y, 2)},
                {"x": round(right_x, 2), "y": round(bottom_y, 2)},
                {"x": round(left_x, 2), "y": round(bottom_y, 2)},
                {"x": round(left_x, 2), "y": round(top_y, 2)},
                {"x": round(width_m * 0.22, 2), "y": round(top_y, 2)},
            ],
        }
    ]
    for i in range(1, rack_cols):
        x = margin_x + i * (rack_w + aisle_gap) - aisle_gap * 0.55
        routes.append(
            {
                "id": f"aisle_{i}",
                "name": f"Проезд {i}",
                "points": [
                    {"x": round(x, 2), "y": round(top_y + length_m * 0.04, 2)},
                    {"x": round(x, 2), "y": round(bottom_y - length_m * 0.02, 2)},
                    {"x": round(x, 2), "y": round(top_y + length_m * 0.04, 2)},
                ],
            }
        )

    # Одна зарядная станция в зоне зарядки (остальные не рисуем — иначе хаос)
    charging: list[dict] = [
        {
            "id": "charge_1",
            "name": "ЗС-1",
            "x": round(width_m * 0.16, 2),
            "y": round(length_m * 0.92, 2),
            "type": "charging",
        }
    ]
    if charging_stations > 1:
        charging.append(
            {
                "id": "charge_2",
                "name": "ЗС-2",
                "x": round(width_m * 0.26, 2),
                "y": round(length_m * 0.92, 2),
                "type": "charging",
            }
        )

    # Точки без текстовых дублей зон — только маркеры (по одной)
    load_unload: list[dict] = [
        {
            "id": "load_dock",
            "name": "Док загрузки",
            "x": round(width_m * 0.22, 2),
            "y": round(length_m * 0.14, 2),
            "type": "load",
        },
        {
            "id": "unload_dock",
            "name": "Док выгрузки",
            "x": round(width_m * 0.72, 2),
            "y": round(length_m * 0.14, 2),
            "type": "unload",
        },
    ]
    _ = (load_points, unload_points)  # counts used only for presence above

    return zones, routes, charging, load_unload


def _airport_layout(
    width_m: float,
    length_m: float,
    charging_stations: int,
    load_points: int,
    unload_points: int,
) -> tuple[list, list, list, list]:
    """Терминал, багаж/груз, сервисные точки, маршруты."""
    zones = [
        {
            "id": "terminal",
            "name": "Терминал",
            "type": "terminal",
            "color": "#e0e7ff",
            "x": round(width_m * 0.05, 2),
            "y": round(length_m * 0.05, 2),
            "width": round(width_m * 0.55, 2),
            "height": round(length_m * 0.28, 2),
        },
        {
            "id": "baggage",
            "name": "Багажная зона",
            "type": "baggage",
            "color": "#fef3c7",
            "x": round(width_m * 0.05, 2),
            "y": round(length_m * 0.38, 2),
            "width": round(width_m * 0.40, 2),
            "height": round(length_m * 0.35, 2),
        },
        {
            "id": "cargo",
            "name": "Грузовая зона",
            "type": "cargo",
            "color": "#d1fae5",
            "x": round(width_m * 0.50, 2),
            "y": round(length_m * 0.38, 2),
            "width": round(width_m * 0.45, 2),
            "height": round(length_m * 0.35, 2),
        },
        {
            "id": "apron",
            "name": "Перрон / сервис",
            "type": "service",
            "color": "#f1f5f9",
            "x": round(width_m * 0.65, 2),
            "y": round(length_m * 0.05, 2),
            "width": round(width_m * 0.30, 2),
            "height": round(length_m * 0.28, 2),
        },
    ]

    routes = [
        {
            "id": "route_main",
            "name": "Контур перрона",
            "points": [
                {"x": round(width_m * 0.10, 2), "y": round(length_m * 0.18, 2)},
                {"x": round(width_m * 0.55, 2), "y": round(length_m * 0.18, 2)},
                {"x": round(width_m * 0.80, 2), "y": round(length_m * 0.18, 2)},
                {"x": round(width_m * 0.80, 2), "y": round(length_m * 0.55, 2)},
                {"x": round(width_m * 0.25, 2), "y": round(length_m * 0.55, 2)},
                {"x": round(width_m * 0.10, 2), "y": round(length_m * 0.55, 2)},
                {"x": round(width_m * 0.10, 2), "y": round(length_m * 0.18, 2)},
            ],
        },
        {
            "id": "route_baggage",
            "name": "Маршрут багажа",
            "points": [
                {"x": round(width_m * 0.12, 2), "y": round(length_m * 0.42, 2)},
                {"x": round(width_m * 0.38, 2), "y": round(length_m * 0.42, 2)},
                {"x": round(width_m * 0.38, 2), "y": round(length_m * 0.68, 2)},
                {"x": round(width_m * 0.12, 2), "y": round(length_m * 0.68, 2)},
                {"x": round(width_m * 0.12, 2), "y": round(length_m * 0.42, 2)},
            ],
        },
        {
            "id": "route_cargo",
            "name": "Маршрут груза",
            "points": [
                {"x": round(width_m * 0.55, 2), "y": round(length_m * 0.45, 2)},
                {"x": round(width_m * 0.88, 2), "y": round(length_m * 0.45, 2)},
                {"x": round(width_m * 0.88, 2), "y": round(length_m * 0.68, 2)},
                {"x": round(width_m * 0.55, 2), "y": round(length_m * 0.68, 2)},
                {"x": round(width_m * 0.55, 2), "y": round(length_m * 0.45, 2)},
            ],
        },
    ]

    charging = []
    for i in range(charging_stations):
        charging.append(
            {
                "id": f"charge_{i + 1}",
                "name": f"Зарядная станция {i + 1}",
                "x": round(width_m * (0.15 + 0.7 * i / max(charging_stations, 1)), 2),
                "y": round(length_m * 0.88, 2),
                "type": "charging",
            }
        )

    load_unload = []
    for i in range(max(1, load_points)):
        load_unload.append(
            {
                "id": f"load_{i + 1}",
                "name": f"Приём багажа {i + 1}",
                "x": round(width_m * (0.15 + 0.15 * i), 2),
                "y": round(length_m * 0.22, 2),
                "type": "load",
            }
        )
    for i in range(max(1, unload_points)):
        load_unload.append(
            {
                "id": f"unload_{i + 1}",
                "name": f"Выдача / борт {i + 1}",
                "x": round(width_m * (0.70 + 0.08 * i), 2),
                "y": round(length_m * 0.22, 2),
                "type": "unload",
            }
        )

    return zones, routes, charging, load_unload


def _medical_layout(
    width_m: float,
    length_m: float,
    charging_stations: int,
    load_points: int,
    unload_points: int,
) -> tuple[list, list, list, list]:
    """Коридоры, палаты, сервисная зона, точки доставки, маршруты."""
    zones = [
        {
            "id": "corridor",
            "name": "Главный коридор",
            "type": "corridor",
            "color": "#f1f5f9",
            "x": round(width_m * 0.35, 2),
            "y": round(length_m * 0.08, 2),
            "width": round(width_m * 0.30, 2),
            "height": round(length_m * 0.75, 2),
        },
        {
            "id": "ward_a",
            "name": "Палаты блок А",
            "type": "ward",
            "color": "#dbeafe",
            "x": round(width_m * 0.05, 2),
            "y": round(length_m * 0.10, 2),
            "width": round(width_m * 0.28, 2),
            "height": round(length_m * 0.35, 2),
        },
        {
            "id": "ward_b",
            "name": "Палаты блок Б",
            "type": "ward",
            "color": "#e0e7ff",
            "x": round(width_m * 0.05, 2),
            "y": round(length_m * 0.50, 2),
            "width": round(width_m * 0.28, 2),
            "height": round(length_m * 0.30, 2),
        },
        {
            "id": "ward_c",
            "name": "Палаты блок В",
            "type": "ward",
            "color": "#cffafe",
            "x": round(width_m * 0.67, 2),
            "y": round(length_m * 0.10, 2),
            "width": round(width_m * 0.28, 2),
            "height": round(length_m * 0.35, 2),
        },
        {
            "id": "service",
            "name": "Сервисная зона",
            "type": "service",
            "color": "#fef3c7",
            "x": round(width_m * 0.67, 2),
            "y": round(length_m * 0.50, 2),
            "width": round(width_m * 0.28, 2),
            "height": round(length_m * 0.30, 2),
        },
    ]

    routes = [
        {
            "id": "route_main",
            "name": "Коридорный маршрут",
            "points": [
                {"x": round(width_m * 0.50, 2), "y": round(length_m * 0.12, 2)},
                {"x": round(width_m * 0.50, 2), "y": round(length_m * 0.78, 2)},
                {"x": round(width_m * 0.20, 2), "y": round(length_m * 0.78, 2)},
                {"x": round(width_m * 0.20, 2), "y": round(length_m * 0.28, 2)},
                {"x": round(width_m * 0.50, 2), "y": round(length_m * 0.28, 2)},
                {"x": round(width_m * 0.80, 2), "y": round(length_m * 0.28, 2)},
                {"x": round(width_m * 0.80, 2), "y": round(length_m * 0.65, 2)},
                {"x": round(width_m * 0.50, 2), "y": round(length_m * 0.65, 2)},
                {"x": round(width_m * 0.50, 2), "y": round(length_m * 0.12, 2)},
            ],
        },
        {
            "id": "route_ward_a",
            "name": "Доставка блок А",
            "points": [
                {"x": round(width_m * 0.42, 2), "y": round(length_m * 0.20, 2)},
                {"x": round(width_m * 0.18, 2), "y": round(length_m * 0.20, 2)},
                {"x": round(width_m * 0.18, 2), "y": round(length_m * 0.38, 2)},
                {"x": round(width_m * 0.42, 2), "y": round(length_m * 0.38, 2)},
                {"x": round(width_m * 0.42, 2), "y": round(length_m * 0.20, 2)},
            ],
        },
        {
            "id": "route_service",
            "name": "Сервисный маршрут",
            "points": [
                {"x": round(width_m * 0.58, 2), "y": round(length_m * 0.55, 2)},
                {"x": round(width_m * 0.82, 2), "y": round(length_m * 0.55, 2)},
                {"x": round(width_m * 0.82, 2), "y": round(length_m * 0.72, 2)},
                {"x": round(width_m * 0.58, 2), "y": round(length_m * 0.72, 2)},
                {"x": round(width_m * 0.58, 2), "y": round(length_m * 0.55, 2)},
            ],
        },
    ]

    charging = []
    for i in range(charging_stations):
        charging.append(
            {
                "id": f"charge_{i + 1}",
                "name": f"Зарядная станция {i + 1}",
                "x": round(width_m * (0.40 + 0.20 * i / max(charging_stations, 1)), 2),
                "y": round(length_m * 0.90, 2),
                "type": "charging",
            }
        )

    load_unload = []
    # Load = склад/сервис, unload = точки доставки в палаты
    for i in range(max(1, load_points)):
        load_unload.append(
            {
                "id": f"load_{i + 1}",
                "name": f"Склад расходников {i + 1}",
                "x": round(width_m * (0.72 + 0.08 * i), 2),
                "y": round(length_m * 0.58, 2),
                "type": "load",
            }
        )
    for i in range(max(1, unload_points)):
        # Alternate left/right wards
        left = i % 2 == 0
        load_unload.append(
            {
                "id": f"unload_{i + 1}",
                "name": f"Доставка {i + 1}",
                "x": round(width_m * (0.18 if left else 0.78), 2),
                "y": round(length_m * (0.22 + 0.12 * (i // 2)), 2),
                "type": "unload",
            }
        )

    return zones, routes, charging, load_unload


def generate_layout(
    object_params: dict,
    robots_count: int = 1,
) -> dict[str, Any]:
    params = object_params or {}
    width_m = float(params.get("area_width_m") or params.get("width_m") or 60)
    length_m = float(params.get("area_length_m") or params.get("length_m") or 100)
    zones_count = int(params.get("zones_count") or params.get("storage_zones") or 4)
    charging_stations = int(params.get("charging_stations") or max(1, (robots_count + 2) // 3))
    load_points = int(params.get("load_points") or params.get("inbound_docks") or 2)
    unload_points = int(params.get("unload_points") or params.get("outbound_docks") or 2)

    object_kind = _detect_object_kind(params)

    if object_kind == "airport":
        zones, routes, charging, load_unload = _airport_layout(
            width_m, length_m, charging_stations, load_points, unload_points
        )
    elif object_kind == "medical":
        zones, routes, charging, load_unload = _medical_layout(
            width_m, length_m, charging_stations, load_points, unload_points
        )
    else:
        object_kind = "warehouse"
        zones, routes, charging, load_unload = _warehouse_layout(
            width_m,
            length_m,
            zones_count,
            charging_stations,
            load_points,
            unload_points,
        )

    robots = _assign_robots(robots_count, routes, width_m, length_m)

    return {
        "canvas": {"width_m": width_m, "length_m": length_m, "unit": "m"},
        "zones": zones,
        "routes": routes,
        "charging_stations": charging,
        "load_unload_points": load_unload,
        "robots": robots,
        "meta": {
            "object_kind": object_kind,
            "zones_count": len(zones),
            "charging_stations": charging_stations,
            "robots_count": robots_count,
            "source_params": {
                "area_width_m": width_m,
                "area_length_m": length_m,
            },
        },
    }


def generate_simulation_config(
    object_params: dict,
    robots_count: int,
    productivity: Optional[float] = None,
    economics: Optional[dict] = None,
) -> dict[str, Any]:
    layout = generate_layout(object_params, robots_count)
    params = object_params or {}
    peak = float(params.get("peak_demand") or params.get("peak_ops_per_hour") or 100)
    prod = float(productivity or params.get("productivity") or 40)
    return {
        "layout": layout,
        "simulation": {
            "tick_seconds": 1,
            "duration_minutes": int(params.get("sim_duration_min") or 60),
            "robots_count": robots_count,
            "peak_demand_ops_per_hour": peak,
            "robot_productivity_ops_per_hour": prod,
            "spawn_rate_per_minute": round(peak / 60, 3),
            "charge_threshold_pct": 20,
            "speed_mps": float(params.get("sim_speed_mps") or 1.2),
            "conflict_resolution": "yield_to_right",
        },
        "economics_snapshot": {
            "capex": (economics or {}).get("capex", {}).get("capex") if economics else None,
            "opex_annual": (economics or {}).get("opex", {}).get("opex_annual") if economics else None,
            "robots_count": robots_count,
        },
    }
