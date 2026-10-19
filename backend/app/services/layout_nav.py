"""Навигация по планировке: OBB-препятствия, A* + LOS, габариты демо-робота.

Единицы — метры. X вправо, Y вниз. Не является физической проверкой проходимости AMR.

Оптимизации (сохраняя геометрическую проверку сегментов после поиска):
- AABB broadphase для point-in-poly;
- occupancy-grid один раз на (layout, clearance, step);
- кэш маршрутов с ключом геометрии + старт/цель/clearance/step.
"""

from __future__ import annotations

import hashlib
import heapq
import json
import math
import time
from typing import Any, Optional

# Сетка мельче прежних 1.5 м — читаемые маршруты без тяжёлого visibility graph.
ASTAR_STEP_M = 0.75
# Демо-габариты (не из экономики каталога).
DEMO_ROBOT_WIDTH_M = 0.8
DEMO_ROBOT_LENGTH_M = 1.2
DEMO_SAFETY_CLEARANCE_M = 0.25
SEGMENT_SAMPLE_M = 0.25

# Кэш маршрутов: fingerprint+endpoints → result
_ROUTE_CACHE: dict[str, dict[str, Any]] = {}
_ROUTE_CACHE_MAX = 256
# Кэш occupancy: fingerprint → (grid, max_x, max_y, polys, aabbs)
_OCC_CACHE: dict[str, tuple[list[list[bool]], int, int, list, list]] = {}
_OCC_CACHE_MAX = 32


def clear_route_cache() -> None:
    """Инвалидация кэшей маршрутов и occupancy (вызывать при смене планировки)."""
    _ROUTE_CACHE.clear()
    _OCC_CACHE.clear()


def demo_clearance_m(robot_width_m: Optional[float] = None, safety_m: Optional[float] = None) -> float:
    w = float(robot_width_m if robot_width_m is not None else DEMO_ROBOT_WIDTH_M)
    s = float(safety_m if safety_m is not None else DEMO_SAFETY_CLEARANCE_M)
    return max(0.05, w / 2.0 + s)


def _rect_corners(x: float, y: float, w: float, h: float, rot_deg: float) -> list[tuple[float, float]]:
    """Углы ориентированного прямоугольника; (x,y) — левый верх без поворота; поворот вокруг центра (Y-down, +CW как canvas)."""
    cx, cy = x + w / 2.0, y + h / 2.0
    rad = math.radians(float(rot_deg or 0))
    c, s = math.cos(rad), math.sin(rad)
    locals_ = ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))
    return [(cx + dx * c - dy * s, cy + dx * s + dy * c) for dx, dy in locals_]


def object_corners(o: dict) -> list[tuple[float, float]]:
    return _rect_corners(
        float(o["x"]),
        float(o["y"]),
        float(o["width"]),
        float(o["height"]),
        float(o.get("rotation") or 0),
    )


def inflate_poly(corners: list[tuple[float, float]], pad: float) -> list[tuple[float, float]]:
    if pad <= 0 or len(corners) < 3:
        return list(corners)
    cx = sum(p[0] for p in corners) / len(corners)
    cy = sum(p[1] for p in corners) / len(corners)
    out: list[tuple[float, float]] = []
    for x, y in corners:
        dx, dy = x - cx, y - cy
        dist = math.hypot(dx, dy) or 1.0
        out.append((x + dx / dist * pad, y + dy / dist * pad))
    return out


def _aabb(poly: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def point_in_poly(px: float, py: float, poly: list[tuple[float, float]]) -> bool:
    if len(poly) < 3:
        return False
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def blocked_polys(layout: dict, clearance: float) -> list[list[tuple[float, float]]]:
    polys: list[list[tuple[float, float]]] = []
    for o in layout.get("objects") or []:
        if o.get("kind") not in ("rack", "obstacle", "wall") or o.get("id") == "wall_contour":
            continue
        polys.append(inflate_poly(object_corners(o), clearance))
    return polys


def point_blocked(
    px: float,
    py: float,
    polys: list[list[tuple[float, float]]],
    aabbs: Optional[list[tuple[float, float, float, float]]] = None,
) -> bool:
    if aabbs is None:
        for poly in polys:
            if point_in_poly(px, py, poly):
                return True
        return False
    for poly, box in zip(polys, aabbs):
        x0, y0, x1, y1 = box
        if px < x0 or px > x1 or py < y0 or py > y1:
            continue
        if point_in_poly(px, py, poly):
            return True
    return False


def segment_clear(
    a: tuple[float, float],
    b: tuple[float, float],
    polys: list[list[tuple[float, float]]],
    sample: float = SEGMENT_SAMPLE_M,
    aabbs: Optional[list[tuple[float, float, float, float]]] = None,
) -> bool:
    dist = math.hypot(b[0] - a[0], b[1] - a[1])
    if dist < 1e-9:
        return not point_blocked(a[0], a[1], polys, aabbs)
    n = max(1, int(math.ceil(dist / sample)))
    for i in range(n + 1):
        t = i / n
        x = a[0] + (b[0] - a[0]) * t
        y = a[1] + (b[1] - a[1]) * t
        if point_blocked(x, y, polys, aabbs):
            return False
    return True


def polyline_length_m(points: list[dict[str, float]]) -> float:
    total = 0.0
    for i in range(1, len(points)):
        total += math.hypot(points[i]["x"] - points[i - 1]["x"], points[i]["y"] - points[i - 1]["y"])
    return round(total, 3)


def _smooth_los(
    points: list[dict[str, float]],
    polys: list[list[tuple[float, float]]],
    aabbs: Optional[list[tuple[float, float, float, float]]] = None,
) -> list[dict[str, float]]:
    if len(points) <= 2:
        return points
    out = [points[0]]
    i = 0
    while i < len(points) - 1:
        j = len(points) - 1
        while j > i + 1:
            a = (out[-1]["x"], out[-1]["y"])
            b = (points[j]["x"], points[j]["y"])
            if segment_clear(a, b, polys, aabbs=aabbs):
                break
            j -= 1
        out.append(points[j])
        i = j
    return out


def adaptive_astar_step_m(width_m: float, length_m: float, requested: float = ASTAR_STEP_M) -> float:
    """Крупные склады: шаг ≥0.75 м. Ограничение: грубая сетка может пропускать узкие щели — финальная проверка сегментов обязательна."""
    span = max(float(width_m), float(length_m))
    if requested != ASTAR_STEP_M:
        return float(requested)
    if span <= 50:
        return ASTAR_STEP_M
    return round(min(2.0, max(ASTAR_STEP_M, span / 80.0)), 3)


def _layout_fingerprint(layout: dict, clearance: float, step_m: float) -> str:
    payload = {
        "w": layout.get("width_m"),
        "l": layout.get("length_m"),
        "c": round(clearance, 5),
        "s": round(step_m, 5),
        "o": [
            {
                "id": o.get("id"),
                "k": o.get("kind"),
                "x": o.get("x"),
                "y": o.get("y"),
                "w": o.get("width"),
                "h": o.get("height"),
                "r": o.get("rotation") or 0,
            }
            for o in (layout.get("objects") or [])
            if o.get("kind") in ("rack", "obstacle", "wall")
        ],
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def build_occupancy(
    layout_w: float,
    layout_l: float,
    step_m: float,
    polys: list[list[tuple[float, float]]],
    aabbs: list[tuple[float, float, float, float]],
) -> tuple[list[list[bool]], int, int]:
    """occupied[ix][iy] == True если центр ячейки внутри препятствия (с clearance)."""
    max_x = int(layout_w / step_m) + 1
    max_y = int(layout_l / step_m) + 1
    grid: list[list[bool]] = [[False] * (max_y + 1) for _ in range(max_x + 1)]
    for ix in range(max_x + 1):
        px = ix * step_m
        if px < 0 or px > layout_w:
            for iy in range(max_y + 1):
                grid[ix][iy] = True
            continue
        for iy in range(max_y + 1):
            py = iy * step_m
            if py < 0 or py > layout_l or point_blocked(px, py, polys, aabbs):
                grid[ix][iy] = True
    return grid, max_x, max_y


def plan_route(
    layout: dict[str, Any],
    start: tuple[float, float],
    goal: tuple[float, float],
    *,
    clearance_m: Optional[float] = None,
    step_m: float = ASTAR_STEP_M,
    route_id: str = "route",
    name: str = "Маршрут",
    use_cache: bool = True,
) -> dict[str, Any]:
    """A* по occupancy-grid + LOS. При неудаче — blocked, points=[]."""
    layout_w = float(layout["width_m"])
    layout_l = float(layout["length_m"])
    step_m = adaptive_astar_step_m(layout_w, layout_l, step_m)
    clearance = demo_clearance_m() if clearance_m is None else float(clearance_m)

    sx, sy = float(start[0]), float(start[1])
    gx, gy = float(goal[0]), float(goal[1])
    fp = _layout_fingerprint(layout, clearance, step_m)
    cache_key = f"{fp}:{round(sx, 3)}:{round(sy, 3)}:{round(gx, 3)}:{round(gy, 3)}"
    if use_cache and cache_key in _ROUTE_CACHE:
        cached = _ROUTE_CACHE[cache_key]
        out = dict(cached)
        out["id"] = route_id
        out["name"] = name if not out.get("blocked") else f"{name} (недоступен)"
        out["points"] = [dict(p) for p in cached.get("points") or []]
        meta = dict(cached.get("meta") or {})
        meta["cache_hit"] = True
        out["meta"] = meta
        return out

    t_geo0 = time.perf_counter()
    occ_hit = fp in _OCC_CACHE
    if occ_hit:
        grid, max_x, max_y, polys, aabbs = _OCC_CACHE[fp]
    else:
        polys = blocked_polys(layout, clearance)
        aabbs = [_aabb(p) for p in polys]
        grid, max_x, max_y = build_occupancy(layout_w, layout_l, step_m, polys, aabbs)
        if len(_OCC_CACHE) >= _OCC_CACHE_MAX:
            try:
                _OCC_CACHE.pop(next(iter(_OCC_CACHE)))
            except StopIteration:
                pass
        _OCC_CACHE[fp] = (grid, max_x, max_y, polys, aabbs)
    t_geo = time.perf_counter() - t_geo0

    meta: dict[str, Any] = {
        "algorithm": "astar_los_occupancy",
        "step_m": step_m,
        "clearance_m": clearance,
        "robot_width_m": DEMO_ROBOT_WIDTH_M,
        "robot_length_m": DEMO_ROBOT_LENGTH_M,
        "safety_clearance_m": DEMO_SAFETY_CLEARANCE_M,
        "physical_clearance_claim": False,
        "rotation_geometry": "obb",
        "obstacles_count": len(polys),
        "grid_size": [max_x + 1, max_y + 1],
        "geo_build_ms": round(t_geo * 1000, 2),
        "occ_cache_hit": occ_hit,
        "cache_hit": False,
    }

    def fail(reason: str, visited: int = 0) -> dict[str, Any]:
        meta["visited_nodes"] = visited
        meta["astar_ms"] = 0.0
        result = {
            "id": route_id,
            "name": f"{name} (недоступен)",
            "points": [],
            "blocked": True,
            "status": "blocked",
            "blocked_reason": reason,
            "length_m": 0.0,
            "meta": meta,
        }
        if use_cache:
            _store_cache(cache_key, result)
        return result

    if not (0 <= sx <= layout_w and 0 <= sy <= layout_l):
        return fail("Старт вне границ склада")
    if not (0 <= gx <= layout_w and 0 <= gy <= layout_l):
        return fail("Цель вне границ склада")
    if point_blocked(sx, sy, polys, aabbs):
        return fail("Старт внутри препятствия (с учётом габарита демо-робота)")
    if point_blocked(gx, gy, polys, aabbs):
        return fail("Цель внутри препятствия (с учётом габарита демо-робота)")

    def cell(p: tuple[float, float]) -> tuple[int, int]:
        return int(round(p[0] / step_m)), int(round(p[1] / step_m))

    def pos(c: tuple[int, int]) -> tuple[float, float]:
        return c[0] * step_m, c[1] * step_m

    def cell_free(c: tuple[int, int]) -> bool:
        ix, iy = c
        if ix < 0 or iy < 0 or ix > max_x or iy > max_y:
            return False
        return not grid[ix][iy]

    def snap_free(c: tuple[int, int], label: str):
        """Ближайшая свободная ячейка (спираль) — старт/цель могут быть свободны геометрически, но центр ячейки занят."""
        if cell_free(c):
            return c
        for rad in range(1, 12):
            for dx in range(-rad, rad + 1):
                for dy in range(-rad, rad + 1):
                    if max(abs(dx), abs(dy)) != rad:
                        continue
                    cand = (c[0] + dx, c[1] + dy)
                    if cell_free(cand):
                        meta["snap_" + label] = {"from": list(c), "to": list(cand)}
                        return cand
        return None

    s0, g0 = cell((sx, sy)), cell((gx, gy))
    s = snap_free(s0, "start")
    g = snap_free(g0, "goal")
    if s is None:
        return fail("Старт: нет свободной ячейки сетки рядом (clearance/дискретизация)")
    if g is None:
        return fail("Цель: нет свободной ячейки сетки рядом (clearance/дискретизация)")

    t_a0 = time.perf_counter()
    open_h: list[tuple[float, int, tuple[int, int]]] = [(0.0, 0, s)]
    tie = 0
    came: dict[tuple[int, int], tuple[int, int]] = {}
    gscore = {s: 0.0}
    closed: set[tuple[int, int]] = set()
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))
    found = False
    cur = s
    limit = min(40000, (max_x + 1) * (max_y + 1) * 2)

    while open_h and len(closed) < limit:
        _, _, cur = heapq.heappop(open_h)
        if cur in closed:
            continue
        closed.add(cur)
        if cur == g:
            found = True
            break
        cx, cy = cur
        for dx, dy in dirs:
            nxt = (cx + dx, cy + dy)
            if nxt in closed:
                continue
            if nxt[0] < 0 or nxt[1] < 0 or nxt[0] > max_x or nxt[1] > max_y:
                continue
            if not cell_free(nxt) and nxt != g:
                continue
            if dx != 0 and dy != 0:
                side_a = (cx + dx, cy)
                side_b = (cx, cy + dy)
                if (not cell_free(side_a) and side_a != g) or (not cell_free(side_b) and side_b != g):
                    continue
            cost = gscore[cur] + math.hypot(dx, dy)
            if cost < gscore.get(nxt, 1e18):
                gscore[nxt] = cost
                came[nxt] = cur
                tie += 1
                heapq.heappush(
                    open_h,
                    (cost + math.hypot(nxt[0] - g[0], nxt[1] - g[1]), tie, nxt),
                )

    t_astar = time.perf_counter() - t_a0
    meta["visited_nodes"] = len(closed)
    meta["astar_ms"] = round(t_astar * 1000, 2)

    if not found and g not in came:
        return fail("Путь не найден (препятствия блокируют проезд)", visited=len(closed))

    path_cells = [g]
    node = g if g in came else cur
    while node != s and node in came:
        node = came[node]
        path_cells.append(node)
    path_cells.append(s)
    path_cells.reverse()

    pts = [{"x": round(pos(c)[0], 3), "y": round(pos(c)[1], 3)} for c in path_cells]
    if pts:
        pts[0] = {"x": round(sx, 3), "y": round(sy, 3)}
        pts[-1] = {"x": round(gx, 3), "y": round(gy, 3)}

    for pi, p in enumerate(pts[1:-1], start=1):
        if point_blocked(p["x"], p["y"], polys, aabbs):
            obs = _diagnose_obstacle(p["x"], p["y"], layout, clearance)
            return fail(
                f"Внутренняя точка маршрута попала в препятствие: "
                f"index={pi} xy=({p['x']:.3f},{p['y']:.3f}){obs}",
                visited=len(closed),
            )

    pts = _smooth_los(pts, polys, aabbs)
    for i in range(1, len(pts)):
        a = (pts[i - 1]["x"], pts[i - 1]["y"])
        b = (pts[i]["x"], pts[i]["y"])
        if not segment_clear(a, b, polys, aabbs=aabbs):
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            obs = _diagnose_obstacle(mid[0], mid[1], layout, clearance)
            return fail(
                f"Сглаживание дало пересечение препятствия: "
                f"segment={i - 1}->{i} a=({a[0]:.3f},{a[1]:.3f}) b=({b[0]:.3f},{b[1]:.3f}){obs}",
                visited=len(closed),
            )

    length = polyline_length_m(pts)
    result = {
        "id": route_id,
        "name": name,
        "points": pts,
        "blocked": False,
        "status": "ok",
        "blocked_reason": None,
        "length_m": length,
        "meta": meta,
    }
    if use_cache:
        _store_cache(cache_key, result)
    return result


def _store_cache(key: str, result: dict[str, Any]) -> None:
    if len(_ROUTE_CACHE) >= _ROUTE_CACHE_MAX:
        # простой FIFO-ish: удалить произвольный первый ключ
        try:
            _ROUTE_CACHE.pop(next(iter(_ROUTE_CACHE)))
        except StopIteration:
            pass
    _ROUTE_CACHE[key] = {
        "points": [dict(p) for p in result.get("points") or []],
        "blocked": result.get("blocked"),
        "status": result.get("status"),
        "blocked_reason": result.get("blocked_reason"),
        "length_m": result.get("length_m"),
        "meta": dict(result.get("meta") or {}),
    }


def _diagnose_obstacle(px: float, py: float, layout: dict, clearance: float) -> str:
    """Краткая диагностика: какой объект перекрывает точку (с clearance)."""
    hits: list[str] = []
    for o in layout.get("objects") or []:
        if o.get("kind") not in ("rack", "obstacle", "wall") or o.get("id") == "wall_contour":
            continue
        poly = inflate_poly(object_corners(o), clearance)
        if point_in_poly(px, py, poly):
            hits.append(str(o.get("id") or o.get("name") or "?"))
            if len(hits) >= 3:
                break
    if not hits:
        return " obstacle=?"
    return " obstacle=" + ",".join(hits)


def point_in_oriented_rect(px: float, py: float, o: dict) -> bool:
    """Hit-test для редактора: точка внутри OBB объекта (без clearance)."""
    return point_in_poly(px, py, object_corners(o))


def approach_point(
    o: dict,
    layout: dict[str, Any],
    clearance_m: Optional[float] = None,
    prefer: str = "south",
) -> tuple[float, float]:
    """Точка у грани объекта снаружи clearance — не центр стеллажа (он внутри препятствия)."""
    clearance = demo_clearance_m() if clearance_m is None else float(clearance_m)
    polys = blocked_polys(layout, clearance)
    aabbs = [_aabb(p) for p in polys]
    w = float(layout["width_m"])
    l = float(layout["length_m"])
    x, y, ww, hh = float(o["x"]), float(o["y"]), float(o["width"]), float(o["height"])
    gap = clearance + 0.3
    candidates = {
        "south": (x + ww / 2, y + hh + gap),
        "north": (x + ww / 2, y - gap),
        "east": (x + ww + gap, y + hh / 2),
        "west": (x - gap, y + hh / 2),
    }
    order = [prefer, "south", "north", "east", "west"]
    seen: set[str] = set()
    for key in order:
        if key in seen:
            continue
        seen.add(key)
        px, py = candidates[key]
        if 0 <= px <= w and 0 <= py <= l and not point_blocked(px, py, polys, aabbs):
            return round(px, 3), round(py, 3)
    return round(min(max(x + ww / 2, 0.5), w - 0.5), 3), round(min(max(y + hh + gap, 0.5), l - 0.5), 3)
