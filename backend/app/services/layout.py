"""Геометрия склада в метрах. Пиксели UI сюда не попадают.

Контракт координат (единый для редактора и симуляции):
- единица: метр;
- ось X — вправо, ось Y — вниз по плану (как в 2D-холсте);
- объект: прямоугольник (x, y, width, height) в метрах, x/y — левый верхний угол без поворота;
- rotation (градусы, CW при Y-down) учитывается в OBB для отрисовки, hit-test и A*.
"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from app.services.layout_nav import (
    DEMO_ROBOT_LENGTH_M,
    DEMO_ROBOT_WIDTH_M,
    DEMO_SAFETY_CLEARANCE_M,
    approach_point,
    demo_clearance_m,
    plan_route,
    point_in_oriented_rect,
)

LAYOUT_VERSION = 1
KINDS = ("rack", "wall", "obstacle", "zone", "charge", "load", "unload", "start")

# Сколько роботов отдаём в payload визуализации (позиции). Полное число — в meta.
MAX_VIZ_ROBOTS = 48

# реэкспорт для тестов/редактора
__all__ = [
    "LAYOUT_VERSION",
    "KINDS",
    "MAX_VIZ_ROBOTS",
    "empty_layout",
    "default_warehouse_objects",
    "sanitize_layout",
    "layout_to_visualization",
    "plan_route",
    "point_in_oriented_rect",
    "demo_clearance_m",
]


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def empty_layout(width_m: float = 60.0, length_m: float = 40.0) -> dict[str, Any]:
    w = max(5.0, float(width_m))
    l = max(5.0, float(length_m))
    return {
        "version": LAYOUT_VERSION,
        "unit": "m",
        "width_m": round(w, 3),
        "length_m": round(l, 3),
        "objects": [
            {
                "id": "wall_contour",
                "kind": "wall",
                "name": "Контур склада",
                "x": 0,
                "y": 0,
                "width": round(w, 3),
                "height": round(l, 3),
                "rotation": 0,
            }
        ],
        "routes": [],
        "source": "manual",
    }


def polyline_length_m(points: list[dict]) -> float:
    total = 0.0
    for i in range(1, len(points)):
        dx = float(points[i]["x"]) - float(points[i - 1]["x"])
        dy = float(points[i]["y"]) - float(points[i - 1]["y"])
        total += (dx * dx + dy * dy) ** 0.5
    return round(total, 3)


def default_warehouse_objects(width_m: float, length_m: float, zones: int = 3) -> list[dict]:
    """Стартовый набор стеллажей и точек — явно как пример."""
    w, l = float(width_m), float(length_m)
    cols = max(2, min(int(zones or 3), 4))
    objects: list[dict] = [
        {
            "id": "wall_contour",
            "kind": "wall",
            "name": "Контур склада",
            "x": 0,
            "y": 0,
            "width": round(w, 3),
            "height": round(l, 3),
            "rotation": 0,
            "example": True,
        }
    ]
    margin_x, margin_y = w * 0.08, l * 0.12
    gap = w * 0.06
    usable = w - 2 * margin_x - gap * (cols - 1)
    rack_w = usable / cols
    rack_h = l * 0.45
    rack_y = l * 0.22
    for i in range(cols):
        objects.append(
            {
                "id": _id("rack"),
                "kind": "rack",
                "name": f"Стеллаж {i + 1}",
                "x": round(margin_x + i * (rack_w + gap), 3),
                "y": round(rack_y, 3),
                "width": round(rack_w * 0.88, 3),
                "height": round(rack_h, 3),
                "rotation": 0,
                "example": True,
            }
        )
    objects.append(
        {
            "id": _id("load"),
            "kind": "load",
            "name": "Приёмка",
            "x": round(w * 0.08, 3),
            "y": round(l * 0.08, 3),
            "width": 4,
            "height": 3,
            "example": True,
        }
    )
    objects.append(
        {
            "id": _id("unload"),
            "kind": "unload",
            "name": "Отгрузка",
            "x": round(w * 0.78, 3),
            "y": round(l * 0.08, 3),
            "width": 4,
            "height": 3,
            "example": True,
        }
    )
    objects.append(
        {
            "id": _id("charge"),
            "kind": "charge",
            "name": "Зарядка 1",
            "x": round(w * 0.08, 3),
            "y": round(l * 0.82, 3),
            "width": 3,
            "height": 2,
            "example": True,
        }
    )
    objects.append(
        {
            "id": _id("start"),
            "kind": "start",
            "name": "Старт роботов",
            "x": round(w * 0.45, 3),
            "y": round(l * 0.82, 3),
            "width": 3,
            "height": 2,
            "example": True,
        }
    )
    return objects


def _sync_wall_contour(objects: list[dict], width_m: float, length_m: float) -> list[dict]:
    """Контур склада всегда совпадает с width_m × length_m."""
    out = []
    found = False
    for o in objects:
        if o.get("id") == "wall_contour" or (
            o.get("kind") == "wall" and o.get("name") in ("Контур склада", "Контур")
        ):
            found = True
            out.append(
                {
                    **o,
                    "id": "wall_contour",
                    "kind": "wall",
                    "name": o.get("name") or "Контур склада",
                    "x": 0.0,
                    "y": 0.0,
                    "width": round(width_m, 3),
                    "height": round(length_m, 3),
                }
            )
        else:
            out.append(o)
    if not found:
        out.insert(
            0,
            {
                "id": "wall_contour",
                "kind": "wall",
                "name": "Контур склада",
                "x": 0.0,
                "y": 0.0,
                "width": round(width_m, 3),
                "height": round(length_m, 3),
                "rotation": 0,
            },
        )
    return out


def sanitize_layout(raw: Optional[dict], fallback_w: float = 60.0, fallback_l: float = 40.0) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    width_m = float(data.get("width_m") or fallback_w)
    length_m = float(data.get("length_m") or fallback_l)
    objects = []
    for item in data.get("objects") or []:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "obstacle")
        if kind not in KINDS:
            kind = "obstacle"
        try:
            x = float(item.get("x") or 0)
            y = float(item.get("y") or 0)
            ww = max(0.2, float(item.get("width") or 1))
            hh = max(0.2, float(item.get("height") or 1))
        except (TypeError, ValueError):
            continue
        objects.append(
            {
                "id": str(item.get("id") or _id(kind)),
                "kind": kind,
                "name": str(item.get("name") or kind),
                "x": round(x, 3),
                "y": round(y, 3),
                "width": round(ww, 3),
                "height": round(hh, 3),
                "rotation": float(item.get("rotation") or 0),
                "example": bool(item.get("example")),
                "from_dxf": bool(item.get("from_dxf")),
            }
        )
    if not objects:
        objects = default_warehouse_objects(width_m, length_m)
    width_m = max(5.0, width_m)
    length_m = max(5.0, length_m)
    objects = _sync_wall_contour(objects, width_m, length_m)

    routes: list[dict[str, Any]] = []
    for item in data.get("routes") or []:
        if not isinstance(item, dict):
            continue
        pts_raw = item.get("points") or []
        points: list[dict[str, float]] = []
        for p in pts_raw:
            if not isinstance(p, dict):
                continue
            try:
                px = float(p.get("x"))
                py = float(p.get("y"))
            except (TypeError, ValueError):
                continue
            points.append({"x": round(px, 3), "y": round(py, 3)})
        if len(points) < 2:
            continue
        routes.append(
            {
                "id": str(item.get("id") or _id("route")),
                "name": str(item.get("name") or "Маршрут"),
                "points": points,
                "source_id": item.get("source_id"),
                "destination_id": item.get("destination_id"),
                "manual": True,
            }
        )

    return {
        "version": LAYOUT_VERSION,
        "unit": "m",
        "width_m": round(width_m, 3),
        "length_m": round(length_m, 3),
        "objects": objects,
        "routes": routes,
        "source": data.get("source") or "manual",
        "dxf_meta": data.get("dxf_meta") if isinstance(data.get("dxf_meta"), dict) else None,
    }


# temporary fragment merged into layout.py

_ZONE_COLORS = {
    "rack": "#c5d0dc",
    "storage": "#c5d0dc",
    "zone": "#dbeafe",
    "obstacle": "#fecaca",
    "wall": "#94a3b8",
    "load": "#fdba74",
    "unload": "#93c5fd",
    "charge": "#86efac",
    "charging": "#86efac",
    "start": "#c4b5fd",
}


def _obj_center(o: dict) -> tuple[float, float]:
    return round(float(o["x"]) + float(o["width"]) / 2, 3), round(float(o["y"]) + float(o["height"]) / 2, 3)


def layout_to_visualization(layout: dict[str, Any], robots_count: int = 3) -> dict[str, Any]:
    """Метры + OBB как в редакторе; задания со своими маршрутами (A*+LOS)."""
    layout = sanitize_layout(layout)
    w, l = layout["width_m"], layout["length_m"]
    clearance = demo_clearance_m()
    zones: list[dict] = []
    charging: list[dict] = []
    load_unload: list[dict] = []
    starts: list[dict] = []
    racks: list[dict] = []
    route_warnings: list[str] = []

    for o in layout["objects"]:
        kind = o["kind"]
        if o.get("id") == "wall_contour":
            continue
        ztype = {
            "rack": "storage",
            "charge": "charge",
            "load": "load",
            "unload": "unload",
            "start": "start",
            "obstacle": "obstacle",
            "zone": "zone",
            "wall": "wall",
        }.get(kind, kind)
        zones.append(
            {
                "id": o["id"],
                "name": o["name"],
                "type": ztype,
                "color": _ZONE_COLORS.get(ztype, "#e2e8f0"),
                "x": o["x"],
                "y": o["y"],
                "width": o["width"],
                "height": o["height"],
                "rotation": o.get("rotation") or 0,
                "title": o["name"],
                "kind": kind,
            }
        )
        cx, cy = _obj_center(o)
        if kind == "charge":
            charging.append({"id": o["id"], "name": o["name"], "x": cx, "y": cy, "type": "charging"})
        elif kind in ("load", "unload"):
            load_unload.append({"id": o["id"], "name": o["name"], "x": cx, "y": cy, "type": kind})
        elif kind == "start":
            starts.append(o)
        elif kind == "rack":
            racks.append(o)

    loads = [p for p in load_unload if p.get("type") == "load"]
    unloads = [p for p in load_unload if p.get("type") == "unload"]

    def _endpoint(obj: dict, as_rack: bool) -> dict:
        if as_rack or obj.get("kind") == "rack" or ("width" in obj and "height" in obj and obj.get("id", "").startswith("rack")):
            # стеллаж из objects
            full = next((r for r in racks if r["id"] == obj.get("id")), None)
            if full is not None:
                ax, ay = approach_point(full, layout, clearance)
                return {"id": full["id"], "name": full["name"], "x": ax, "y": ay}
        return obj

    tasks: list[dict] = []
    routes: list[dict] = []
    manual_routes = [r for r in (layout.get("routes") or []) if len(r.get("points") or []) >= 2]
    use_manual = bool(manual_routes)

    if use_manual:
        # Ручные полилинии из редактора — приоритет над A*
        for i, mr in enumerate(manual_routes):
            pts = list(mr["points"])
            rid = str(mr.get("id") or f"route_manual_{i + 1}")
            rname = str(mr.get("name") or f"Маршрут {i + 1}")
            route = {
                "id": rid,
                "name": rname,
                "points": pts,
                "length_m": polyline_length_m(pts),
                "blocked": False,
                "status": "ok",
                "manual": True,
                "source": "manual",
            }
            routes.append(route)
            tasks.append(
                {
                    "id": f"task_manual_{i + 1}",
                    "type": "manual",
                    "source_id": mr.get("source_id"),
                    "destination_id": mr.get("destination_id"),
                    "source_name": "Старт маршрута",
                    "destination_name": "Финиш маршрута",
                    "status": "queued",
                    "robot_id": None,
                    "route": route,
                    "blocked_reason": None,
                }
            )
    else:
        task_specs: list[tuple[str, str, dict, dict]] = []
        if loads and racks:
            for i, rack in enumerate(racks[:6]):
                task_specs.append(
                    (
                        "inbound",
                        f"task_in_{i + 1}",
                        loads[i % len(loads)],
                        _endpoint(rack, True),
                    )
                )
        if racks and unloads:
            for i, rack in enumerate(racks[:6]):
                task_specs.append(
                    (
                        "outbound",
                        f"task_out_{i + 1}",
                        _endpoint(rack, True),
                        unloads[i % len(unloads)],
                    )
                )
        if not task_specs and loads and unloads:
            for i in range(min(4, max(len(loads), len(unloads)))):
                task_specs.append(
                    ("transfer", f"task_tr_{i + 1}", loads[i % len(loads)], unloads[i % len(unloads)])
                )
        if charging and task_specs:
            src = unloads[0] if unloads else task_specs[0][2]
            task_specs.append(("to_charge", "task_charge_1", src, charging[0]))

        for ttype, tid, src, dst in task_specs:
            start_pt = (float(src["x"]), float(src["y"]))
            goal_pt = (float(dst["x"]), float(dst["y"]))
            route = plan_route(
                layout,
                start_pt,
                goal_pt,
                clearance_m=clearance,
                route_id=f"route_{tid}",
                name=f"{src.get('name', 'A')} → {dst.get('name', 'B')}",
            )
            if route.get("blocked"):
                route_warnings.append(f"{tid}: {route.get('blocked_reason')}")
                # инвариант: недоступный маршрут не несёт исполняемой геометрии/длины
                route = {
                    **route,
                    "points": [],
                    "length_m": 0.0,
                    "blocked": True,
                    "status": "blocked",
                }
            routes.append(route)
            tasks.append(
                {
                    "id": tid,
                    "type": ttype,
                    "source_id": src.get("id"),
                    "destination_id": dst.get("id"),
                    "source_name": src.get("name"),
                    "destination_name": dst.get("name"),
                    "status": "blocked" if route.get("blocked") else "queued",
                    "robot_id": None,
                    "route": route,
                    "blocked_reason": route.get("blocked_reason"),
                }
            )

    n_cfg = max(0, int(robots_count))
    n_spawn = min(n_cfg, MAX_VIZ_ROBOTS)
    robots = []
    assignable = [t for t in tasks if not (t.get("route") or {}).get("blocked")]
    for i in range(n_spawn):
        if starts:
            s = starts[i % len(starts)]
            x, y = _obj_center(s)
        else:
            x, y = w * 0.1, l * 0.9
        # одно задание — одному роботу (без повторного назначения)
        task = assignable[i] if i < len(assignable) else None
        robots.append(
            {
                "id": f"robot_{i + 1}",
                "name": f"Робот {i + 1}",
                "x": round(float(x), 2),
                "y": round(float(y), 2),
                "heading_deg": 0,
                "route_id": (task.get("route") or {}).get("id") if task else "",
                "task_id": task["id"] if task else None,
            }
        )
        if task:
            task["robot_id"] = f"robot_{i + 1}"
            task["status"] = "assigned"

    return {
        "canvas": {"width_m": w, "length_m": l, "unit": "m"},
        "zones": zones,
        "routes": routes,
        "tasks": tasks,
        "charging_stations": charging,
        "load_unload_points": load_unload,
        "robots": robots,
        "meta": {
            "object_kind": "warehouse",
            "zones_count": len(zones),
            "charging_stations": len(charging),
            "robots_count": n_cfg,
            "robots_spawned": n_spawn,
            "robots_capped_in_payload": n_cfg > MAX_VIZ_ROBOTS,
            "source": "saved_layout",
            "source_params": {"area_width_m": w, "area_length_m": l},
            "layout_source": layout.get("source"),
            "route_warnings": route_warnings,
            "coord_system": "meters_xy_topleft_ydown",
            "rotation_supported": True,
            "rotation_geometry": "obb",
            "pathfinding": "manual_polylines" if use_manual else "astar_los_obb",
            "pathfinding_step_m": None if use_manual else 0.75,
            "pathfinding_step_adaptive": not use_manual,
            "manual_routes_count": len(manual_routes) if use_manual else 0,
            "demo_robot": {
                "width_m": DEMO_ROBOT_WIDTH_M,
                "length_m": DEMO_ROBOT_LENGTH_M,
                "safety_clearance_m": DEMO_SAFETY_CLEARANCE_M,
                "clearance_m": clearance,
            },
            "pathfinding_note": (
                "Маршруты заданы вручную в планировке (полилинии в метрах). "
                "A* не используется, пока в плане есть хотя бы один ручной маршрут."
                if use_manual
                else (
                    "A* (шаг 0.75 м) + LOS-сглаживание по OBB препятствий; clearance = половина ширины "
                    f"демо-робота ({DEMO_ROBOT_WIDTH_M} м) + запас {DEMO_SAFETY_CLEARANCE_M} м. "
                    "Не является проверкой физической проходимости AMR. Задания имеют индивидуальные маршруты."
                )
            ),
            "conflict_avoidance": "frontend_basic_wait",
            "des_note": "Демонстрационная DES-модель, не цифровой двойник.",
        },
    }
