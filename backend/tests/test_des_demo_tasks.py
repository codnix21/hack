"""Интеграция: задания демо-планировки (7 типичных task_in/out/charge)."""

from __future__ import annotations

from app.services.layout import default_warehouse_objects, layout_to_visualization, sanitize_layout


def test_demo_layout_seven_tasks_contract():
    layout = sanitize_layout(
        {
            "width_m": 60,
            "length_m": 40,
            "objects": default_warehouse_objects(60, 40, zones=3),
        }
    )
    viz = layout_to_visualization(layout, robots_count=186)
    tasks = viz["tasks"]
    # 3 стеллажа → 3 inbound + 3 outbound + charge = 7
    assert len(tasks) == 7
    assert {t["id"] for t in tasks} == {
        "task_in_1",
        "task_in_2",
        "task_in_3",
        "task_out_1",
        "task_out_2",
        "task_out_3",
        "task_charge_1",
    }
    # воспроизводимость
    viz2 = layout_to_visualization(layout, robots_count=186)
    assert [t["id"] for t in viz2["tasks"]] == [t["id"] for t in tasks]
    assert [t["status"] for t in viz2["tasks"]] == [t["status"] for t in tasks]

    for t in tasks:
        route = t.get("route") or {}
        if t["status"] == "blocked" or route.get("blocked"):
            assert route.get("points") == []
            assert float(route.get("length_m") or 0) == 0.0
            assert t.get("robot_id") in (None, "")
            assert route.get("blocked_reason")
        else:
            assert len(route.get("points") or []) >= 2
            assert float(route.get("length_m") or 0) > 0
            assert route.get("status") == "ok"

    # ожидаемый набор id для склада с load/unload/racks/charge
    ids = {t["id"] for t in tasks}
    assert any(i.startswith("task_in_") for i in ids)
    assert any(i.startswith("task_out_") for i in ids)
    # charge если есть станция
    charges = [o for o in layout["objects"] if o.get("kind") == "charge"]
    if charges:
        assert "task_charge_1" in ids

    # мета: конфиг роботов vs spawn
    assert viz["meta"]["robots_count"] == 186
    assert viz["meta"]["robots_spawned"] <= 48


def test_demo_tasks_deterministic_lengths():
    layout = sanitize_layout(
        {"width_m": 60, "length_m": 40, "objects": default_warehouse_objects(60, 40, 3)}
    )
    a = layout_to_visualization(layout, robots_count=8)
    b = layout_to_visualization(layout, robots_count=8)
    for ta, tb in zip(a["tasks"], b["tasks"]):
        assert ta["id"] == tb["id"]
        assert ta["status"] == tb["status"]
        assert (ta.get("route") or {}).get("length_m") == (tb.get("route") or {}).get("length_m")
        assert (ta.get("route") or {}).get("points") == (tb.get("route") or {}).get("points")
