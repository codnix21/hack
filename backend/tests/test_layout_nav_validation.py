"""Инженерная валидация layout_nav: сегменты после LOS, OBB, узкие проходы."""

from __future__ import annotations

import time

import pytest

from app.services.layout import sanitize_layout
from app.services.layout_nav import (
    DEMO_ROBOT_WIDTH_M,
    DEMO_SAFETY_CLEARANCE_M,
    approach_point,
    blocked_polys,
    demo_clearance_m,
    plan_route,
    point_blocked,
    point_in_oriented_rect,
    polyline_length_m,
    segment_clear,
)


def _assert_route_clear(layout, route, clearance=None):
    c = demo_clearance_m() if clearance is None else clearance
    polys = blocked_polys(layout, c)
    pts = route["points"]
    assert len(pts) >= 2
    for i in range(1, len(pts)):
        a = (pts[i - 1]["x"], pts[i - 1]["y"])
        b = (pts[i]["x"], pts[i]["y"])
        assert segment_clear(a, b, polys), f"segment {i} intersects: {a}->{b}"
        assert 0 <= a[0] <= layout["width_m"] + 1e-6
        assert 0 <= a[1] <= layout["length_m"] + 1e-6


def test_free_route():
    layout = sanitize_layout({"width_m": 40, "length_m": 30, "objects": []})
    r = plan_route(layout, (2, 2), (38, 28))
    assert not r["blocked"]
    _assert_route_clear(layout, r)
    assert r["length_m"] == polyline_length_m(r["points"])


def test_fully_blocked():
    layout = sanitize_layout(
        {
            "width_m": 20,
            "length_m": 20,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "x": 0, "y": 0, "width": 20, "height": 20},
                {"id": "bar", "kind": "rack", "x": 8, "y": 0.2, "width": 4, "height": 19.6},
            ],
        }
    )
    r = plan_route(layout, (3, 10), (17, 10))
    assert r["blocked"] and r["points"] == []
    assert r["blocked_reason"]


def test_start_inside_obstacle():
    layout = sanitize_layout(
        {
            "width_m": 30,
            "length_m": 30,
            "objects": [{"id": "r", "kind": "rack", "x": 10, "y": 10, "width": 8, "height": 8}],
        }
    )
    r = plan_route(layout, (14, 14), (25, 25))
    assert r["blocked"]
    assert "старт" in (r["blocked_reason"] or "").lower() or "препятств" in (
        r["blocked_reason"] or ""
    ).lower()


def test_goal_inside_obstacle():
    layout = sanitize_layout(
        {
            "width_m": 30,
            "length_m": 30,
            "objects": [{"id": "r", "kind": "rack", "x": 10, "y": 10, "width": 8, "height": 8}],
        }
    )
    r = plan_route(layout, (2, 2), (14, 14))
    assert r["blocked"]


def test_rotated_obb_blocks_center():
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 40,
            "objects": [
                {
                    "id": "r",
                    "kind": "rack",
                    "x": 15,
                    "y": 15,
                    "width": 12,
                    "height": 4,
                    "rotation": 35,
                }
            ],
        }
    )
    o = layout["objects"][1]
    cx, cy = o["x"] + o["width"] / 2, o["y"] + o["height"] / 2
    assert point_in_oriented_rect(cx, cy, o)
    r = plan_route(layout, (2, 2), (cx, cy))
    assert r["blocked"]


def test_narrow_passage_threshold():
    """Проход шире 2*clearance должен быть проходим; уже — нет."""
    c = demo_clearance_m()
    wide = 2 * c + 0.4
    layout_ok = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 20,
            "objects": [
                {"id": "a", "kind": "rack", "x": 10, "y": 0, "width": 8, "height": (20 - wide) / 2},
                {
                    "id": "b",
                    "kind": "rack",
                    "x": 10,
                    "y": (20 - wide) / 2 + wide,
                    "width": 8,
                    "height": (20 - wide) / 2,
                },
            ],
        }
    )
    r_ok = plan_route(layout_ok, (2, 10), (30, 10), clearance_m=c)
    assert not r_ok["blocked"], r_ok.get("blocked_reason")
    _assert_route_clear(layout_ok, r_ok, c)

    narrow = max(0.1, 2 * c - 0.3)
    layout_bad = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 20,
            "objects": [
                {"id": "a", "kind": "rack", "x": 10, "y": 0, "width": 8, "height": (20 - narrow) / 2},
                {
                    "id": "b",
                    "kind": "rack",
                    "x": 10,
                    "y": (20 - narrow) / 2 + narrow,
                    "width": 8,
                    "height": (20 - narrow) / 2,
                },
            ],
        }
    )
    r_bad = plan_route(layout_bad, (2, 10), (30, 10), clearance_m=c)
    assert r_bad["blocked"]


def test_dead_end():
    layout = sanitize_layout(
        {
            "width_m": 30,
            "length_m": 30,
            "objects": [
                {"id": "u", "kind": "rack", "x": 5, "y": 5, "width": 20, "height": 2},
                {"id": "l", "kind": "rack", "x": 5, "y": 5, "width": 2, "height": 15},
                {"id": "r", "kind": "rack", "x": 23, "y": 5, "width": 2, "height": 15},
                {"id": "d", "kind": "rack", "x": 5, "y": 18, "width": 20, "height": 2},
            ],
        }
    )
    # цель внутри «коробки»
    r = plan_route(layout, (1, 1), (14, 12))
    assert r["blocked"]


def test_unreachable_outside():
    layout = sanitize_layout({"width_m": 20, "length_m": 20, "objects": []})
    r = plan_route(layout, (5, 5), (50, 5))
    assert r["blocked"]
    assert "границ" in (r["blocked_reason"] or "").lower()


def test_multiple_obstacles_and_edge_path():
    layout = sanitize_layout(
        {
            "width_m": 50,
            "length_m": 40,
            "objects": [
                {"id": "r1", "kind": "rack", "x": 10, "y": 8, "width": 8, "height": 20},
                {"id": "r2", "kind": "rack", "x": 22, "y": 8, "width": 8, "height": 20},
                {"id": "r3", "kind": "obstacle", "x": 34, "y": 12, "width": 4, "height": 12},
            ],
        }
    )
    r = plan_route(layout, (3, 3), (47, 3))
    assert not r["blocked"]
    _assert_route_clear(layout, r)


def test_diagonal_between_obstacles():
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 40,
            "objects": [
                {"id": "a", "kind": "rack", "x": 8, "y": 8, "width": 10, "height": 10},
                {"id": "b", "kind": "rack", "x": 22, "y": 22, "width": 10, "height": 10},
            ],
        }
    )
    r = plan_route(layout, (2, 30), (38, 2))
    if not r["blocked"]:
        _assert_route_clear(layout, r)


def test_approach_point_outside_clearance():
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 40,
            "objects": [{"id": "rack1", "kind": "rack", "x": 15, "y": 15, "width": 10, "height": 10}],
        }
    )
    rack = layout["objects"][1]
    ax, ay = approach_point(rack, layout)
    polys = blocked_polys(layout, demo_clearance_m())
    assert not point_blocked(ax, ay, polys)
    r = plan_route(layout, (2, 2), (ax, ay))
    assert not r["blocked"]
    _assert_route_clear(layout, r)


def test_los_does_not_cut_corner():
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 40,
            "objects": [
                {"id": "a", "kind": "rack", "x": 10, "y": 10, "width": 10, "height": 10},
                {"id": "b", "kind": "rack", "x": 20, "y": 20, "width": 10, "height": 10},
            ],
        }
    )
    r = plan_route(layout, (5, 25), (35, 5))
    if not r["blocked"]:
        _assert_route_clear(layout, r)


def test_resize_and_rotation_change_path():
    base = {
        "width_m": 40,
        "length_m": 40,
        "objects": [
            {"id": "r", "kind": "rack", "x": 15, "y": 5, "width": 4, "height": 20, "rotation": 0},
        ],
    }
    layout = sanitize_layout(base)
    r1 = plan_route(layout, (5, 15), (35, 15))
    base["objects"][0]["rotation"] = 90
    base["objects"][0]["width"] = 20
    base["objects"][0]["height"] = 4
    layout2 = sanitize_layout(base)
    r2 = plan_route(layout2, (5, 15), (35, 15))
    # геометрия изменилась — хотя бы один из статусов/длин отличается или оба ok с разной длиной
    if not r1["blocked"] and not r2["blocked"]:
        assert r1["length_m"] != r2["length_m"] or r1["points"] != r2["points"]


def test_demo_clearance_documented():
    c = demo_clearance_m()
    assert c == pytest.approx(DEMO_ROBOT_WIDTH_M / 2 + DEMO_SAFETY_CLEARANCE_M)
    assert c == pytest.approx(0.65)


def test_adaptive_step_grows_on_large_warehouse():
    from app.services.layout_nav import adaptive_astar_step_m, ASTAR_STEP_M

    assert adaptive_astar_step_m(40, 30) == ASTAR_STEP_M
    assert adaptive_astar_step_m(120, 100) > ASTAR_STEP_M


def test_plan_route_perf_smoke():
    """Измерение wall time (не выдуманное). Крупная сетка A* дорогая — фиксируем факт."""
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 30,
            "objects": [
                {"id": f"r{i}", "kind": "rack", "x": 8 + i * 7, "y": 6, "width": 4, "height": 12}
                for i in range(4)
            ],
        }
    )
    n = 3
    t0 = time.perf_counter()
    for _ in range(n):
        plan_route(layout, (2, 2), (38, 28))
    elapsed = time.perf_counter() - t0
    per = elapsed / n
    print(f"\nPERF plan_route×{n} @40×30: {elapsed:.4f}s ({per*1000:.1f} ms/call)")
    # регрессионный потолок; на медленных машинах допускаем до 25 с
    assert elapsed < 25.0, f"pathfinding too slow: {elapsed:.3f}s for {n} calls"
