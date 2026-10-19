"""Регрессия производительности и корректности после occupancy-grid / cache."""

from __future__ import annotations

import statistics
import time

from app.services.layout import sanitize_layout
from app.services.layout_nav import (
    ASTAR_STEP_M,
    blocked_polys,
    clear_route_cache,
    demo_clearance_m,
    plan_route,
    segment_clear,
)


def _assert_segments(layout, route):
    if route.get("blocked"):
        assert route["points"] == []
        return
    polys = blocked_polys(layout, demo_clearance_m())
    pts = route["points"]
    for i in range(1, len(pts)):
        assert segment_clear(
            (pts[i - 1]["x"], pts[i - 1]["y"]),
            (pts[i]["x"], pts[i]["y"]),
            polys,
        )


def test_narrow_passage_same_at_steps():
    """Узкий проход не должен стать «проходимым» из‑за крупного шага без проверки сегментов."""
    c = demo_clearance_m()
    # заведомо уже, чем 2*clearance
    gap = max(0.15, 2 * c - 0.4)
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 20,
            "objects": [
                {"id": "a", "kind": "rack", "x": 12, "y": 0, "width": 6, "height": (20 - gap) / 2},
                {
                    "id": "b",
                    "kind": "rack",
                    "x": 12,
                    "y": (20 - gap) / 2 + gap,
                    "width": 6,
                    "height": (20 - gap) / 2,
                },
            ],
        }
    )
    for step in (0.75, 1.5, 2.0):
        clear_route_cache()
        r = plan_route(layout, (2, 10), (35, 10), step_m=step, use_cache=False)
        assert r["blocked"], f"step={step} should block narrow gap={gap}"


def test_rotated_obstacle_los_ok():
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 40,
            "objects": [
                {"id": "r", "kind": "rack", "x": 12, "y": 16, "width": 14, "height": 3, "rotation": 40},
            ],
        }
    )
    clear_route_cache()
    r = plan_route(layout, (2, 2), (38, 38), use_cache=False)
    if not r["blocked"]:
        _assert_segments(layout, r)


def test_cache_hit_and_invalidate_on_geometry_change():
    layout = sanitize_layout(
        {
            "width_m": 30,
            "length_m": 20,
            "objects": [{"id": "r", "kind": "rack", "x": 10, "y": 5, "width": 4, "height": 10}],
        }
    )
    clear_route_cache()
    a = plan_route(layout, (2, 2), (28, 18), use_cache=True)
    b = plan_route(layout, (2, 2), (28, 18), use_cache=True)
    assert b["meta"].get("cache_hit") is True
    assert a["status"] == b["status"]
    assert a["length_m"] == b["length_m"]
    # изменение геометрии → новый fingerprint; явная инвалидация очищает stale
    racks = [o for o in layout["objects"] if o.get("kind") == "rack"]
    racks[0]["x"] = float(racks[0]["x"]) + 4
    layout = sanitize_layout(layout)
    clear_route_cache()
    c = plan_route(layout, (2, 2), (28, 18), use_cache=True)
    assert c["meta"].get("cache_hit") is not True
    d = plan_route(layout, (2, 2), (28, 18), use_cache=True)
    assert d["meta"].get("cache_hit") is True


def test_repeat_route_reproducible():
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
    clear_route_cache()
    results = [plan_route(layout, (2, 2), (38, 28), use_cache=False) for _ in range(3)]
    assert all(r["status"] == results[0]["status"] for r in results)
    assert all(r["length_m"] == results[0]["length_m"] for r in results)
    assert all(r["points"] == results[0]["points"] for r in results)


def test_dense_large_plan_segments_clear():
    layout = sanitize_layout(
        {
            "width_m": 80,
            "length_m": 60,
            "objects": [
                {
                    "id": f"r{i}",
                    "kind": "rack",
                    "x": 4 + (i % 6) * 12,
                    "y": 4 + (i // 6) * 14,
                    "width": 6,
                    "height": 8,
                    "rotation": 10 if i % 2 else 0,
                }
                for i in range(18)
            ],
        }
    )
    clear_route_cache()
    r = plan_route(layout, (1, 1), (78, 58), use_cache=False)
    _assert_segments(layout, r)
    assert r["meta"].get("step_m", ASTAR_STEP_M) >= ASTAR_STEP_M


def test_blocked_not_fake_line():
    layout = sanitize_layout(
        {
            "width_m": 20,
            "length_m": 20,
            "objects": [{"id": "bar", "kind": "rack", "x": 8, "y": 0.2, "width": 4, "height": 19.6}],
        }
    )
    r = plan_route(layout, (2, 10), (18, 10), use_cache=False)
    assert r["blocked"] and r["points"] == []


def test_perf_40x30_soft_bound():
    """Мягкий потолок для CI: occupancy должен быть существенно быстрее прежних ~800ms+."""
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
    times = []
    for _ in range(5):
        clear_route_cache()
        t0 = time.perf_counter()
        plan_route(layout, (2, 2), (38, 28), use_cache=False)
        times.append(time.perf_counter() - t0)
    med = statistics.median(times)
    print(f"\nPERF 40x30 median={med*1000:.1f}ms (soft cap 2500ms)")
    assert med < 2.5, f"median {med:.3f}s too slow for 40x30 after optimization"
