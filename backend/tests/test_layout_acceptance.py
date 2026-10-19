"""Приёмка планировки / A* / round-trip геометрии (Layout–Simulation Consistency)."""

from app.services.layout import layout_to_visualization, sanitize_layout
from app.services.layout_nav import blocked_polys, demo_clearance_m, plan_route, segment_clear


def _fixture_layout(**overrides):
    base = {
        "width_m": 60,
        "length_m": 40,
        "objects": [
            {
                "id": "wall_contour",
                "kind": "wall",
                "name": "Контур",
                "x": 0,
                "y": 0,
                "width": 60,
                "height": 40,
                "rotation": 0,
            },
            {
                "id": "rack1",
                "kind": "rack",
                "name": "Стеллаж 1",
                "x": 10,
                "y": 8,
                "width": 8,
                "height": 14,
                "rotation": 0,
            },
            {
                "id": "rack2",
                "kind": "rack",
                "name": "Стеллаж 2",
                "x": 22,
                "y": 8,
                "width": 8,
                "height": 14,
                "rotation": 0,
            },
            {
                "id": "rack3",
                "kind": "rack",
                "name": "Стеллаж 3",
                "x": 34,
                "y": 8,
                "width": 8,
                "height": 14,
                "rotation": 15,  # хранится; AABB без поворота
            },
            {
                "id": "obs1",
                "kind": "obstacle",
                "name": "Препятствие",
                "x": 48,
                "y": 20,
                "width": 4,
                "height": 6,
                "rotation": 0,
            },
            {
                "id": "charge1",
                "kind": "charge",
                "name": "Зарядка",
                "x": 2,
                "y": 30,
                "width": 3,
                "height": 3,
                "rotation": 0,
            },
            {
                "id": "load1",
                "kind": "load",
                "name": "Приёмка",
                "x": 2,
                "y": 2,
                "width": 4,
                "height": 3,
                "rotation": 0,
            },
            {
                "id": "unload1",
                "kind": "unload",
                "name": "Отгрузка",
                "x": 50,
                "y": 2,
                "width": 4,
                "height": 3,
                "rotation": 0,
            },
            {
                "id": "start1",
                "kind": "start",
                "name": "Старт",
                "x": 5,
                "y": 32,
                "width": 2,
                "height": 2,
                "rotation": 0,
            },
        ],
    }
    base.update(overrides)
    return sanitize_layout(base)


def test_acceptance_zone_types_and_rotation_preserved():
    layout = _fixture_layout()
    rack3 = next(o for o in layout["objects"] if o["id"] == "rack3")
    assert rack3["rotation"] == 15.0
    viz = layout_to_visualization(layout, robots_count=6)
    kinds = {z["type"] for z in viz["zones"]}
    assert {"storage", "obstacle", "load", "unload", "charge", "start"} <= kinds
    zone_ids = {z["id"] for z in viz["zones"]}
    for oid in ("rack1", "rack2", "rack3", "obs1", "load1", "unload1", "charge1", "start1"):
        assert oid in zone_ids
    assert viz["meta"]["rotation_supported"] is True
    assert viz["meta"]["pathfinding"] == "astar_los_obb"
    r3 = next(z for z in viz["zones"] if z["id"] == "rack3")
    assert r3["x"] == 34 and r3["width"] == 8 and r3["height"] == 14
    assert float(r3.get("rotation") or 0) == 15.0
    assert viz.get("tasks")


def test_astar_free_path():
    """A: свободный коридор без препятствий."""
    layout = _fixture_layout()
    r = plan_route(layout, (5, 5), (55, 5))
    assert not r["blocked"] and len(r["points"]) >= 2
    assert r["points"][0]["x"] == 5 and r["points"][-1]["x"] == 55


def test_astar_avoids_rack():
    """B: обход стеллажа, если путь существует."""
    layout = _fixture_layout()
    r = plan_route(layout, (4, 3.5), (52, 3.5))
    assert not r["blocked"]
    polys = blocked_polys(layout, demo_clearance_m())
    for i in range(1, len(r["points"])):
        assert segment_clear(
            (r["points"][i - 1]["x"], r["points"][i - 1]["y"]),
            (r["points"][i]["x"], r["points"][i]["y"]),
            polys,
        )


def test_astar_fully_blocked_no_fake_route():
    """C: полностью заблокированный путь — пустой список, не прямая сквозь стеллаж."""
    layout = sanitize_layout(
        {
            "width_m": 30,
            "length_m": 20,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "x": 0, "y": 0, "width": 30, "height": 20},
                {"id": "wall_rack", "kind": "rack", "x": 12, "y": 0.5, "width": 6, "height": 19},
                {"id": "load1", "kind": "load", "x": 2, "y": 8, "width": 2, "height": 2},
                {"id": "unload1", "kind": "unload", "x": 24, "y": 8, "width": 2, "height": 2},
            ],
        }
    )
    viz = layout_to_visualization(layout, robots_count=2)
    blocked = [r for r in viz["routes"] if r.get("blocked")]
    assert blocked, "ожидается недоступный маршрут"
    for r in blocked:
        assert r["points"] == []


def test_astar_goal_inside_rack_rejected():
    """D: цель внутри стеллажа — blocked через plan_route."""
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 30,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "x": 0, "y": 0, "width": 40, "height": 30},
                {"id": "rack1", "kind": "rack", "x": 10, "y": 8, "width": 10, "height": 10},
                {"id": "load1", "kind": "load", "x": 2, "y": 2, "width": 2, "height": 2},
                {"id": "unload1", "kind": "unload", "x": 30, "y": 2, "width": 2, "height": 2},
            ],
        }
    )
    r = plan_route(layout, (3, 3), (15, 13))
    assert r["blocked"] is True
    assert r["points"] == []


def test_astar_stays_in_bounds():
    """E: точки маршрута внутри склада."""
    layout = _fixture_layout()
    viz = layout_to_visualization(layout, robots_count=3)
    w, l = layout["width_m"], layout["length_m"]
    for route in viz["routes"]:
        if route.get("blocked"):
            continue
        for p in route["points"]:
            assert 0 <= p["x"] <= w + 0.01
            assert 0 <= p["y"] <= l + 0.01


def test_layout_change_invalidates_old_route_geometry(client):
    """F: после сдвига стеллажа visualization пересчитывается заново."""
    login = client.post("/api/auth/login", json={"email": "user@demo.local", "password": "User123!"})
    token = login.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Accept layout F", "object_type_id": types[0]["id"]},
    ).json()
    layout = _fixture_layout()
    client.put(f"/api/projects/{p['id']}/layout", headers=h, json={"layout": layout})
    viz1 = client.get(f"/api/visualization/{p['id']}/layout?robots_count=6", headers=h).json()
    # перекрыть коридор у приёмки/отгрузки сплошным стеллажом
    layout["objects"].append(
        {
            "id": "blocker",
            "kind": "rack",
            "name": "Блок",
            "x": 8,
            "y": 0.5,
            "width": 40,
            "height": 8,
            "rotation": 0,
        }
    )
    client.put(f"/api/projects/{p['id']}/layout", headers=h, json={"layout": layout})
    viz2 = client.get(f"/api/visualization/{p['id']}/layout?robots_count=6", headers=h).json()
    # геометрия стеллажа rack1 неизменна по ID
    r1a = next(z for z in viz1["zones"] if z["id"] == "rack1")
    r1b = next(z for z in viz2["zones"] if z["id"] == "rack1")
    assert (r1a["x"], r1a["y"], r1a["width"], r1a["height"]) == (
        r1b["x"],
        r1b["y"],
        r1b["width"],
        r1b["height"],
    )
    assert any(z["id"] == "blocker" for z in viz2["zones"])
    # маршруты не должны совпадать «тихо» со старыми, если путь пропал
    if any(r.get("blocked") for r in viz2["routes"]):
        for r in viz2["routes"]:
            if r.get("blocked"):
                assert r["points"] == []


def test_robots_count_meta_6_20_186():
    from app.services.layout import MAX_VIZ_ROBOTS

    layout = _fixture_layout()
    for n in (6, 20, 186):
        viz = layout_to_visualization(layout, robots_count=n)
        assert viz["meta"]["robots_count"] == n
        assert len(viz["robots"]) == min(n, MAX_VIZ_ROBOTS)
        assert viz["meta"]["robots_spawned"] == min(n, MAX_VIZ_ROBOTS)
        assert viz["meta"]["robots_capped_in_payload"] == (n > MAX_VIZ_ROBOTS)


def test_geometry_roundtrip_save_reload_viz(client):
    login = client.post("/api/auth/login", json={"email": "user@demo.local", "password": "User123!"})
    token = login.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Accept roundtrip geo", "object_type_id": types[0]["id"]},
    ).json()
    layout = _fixture_layout()
    saved = client.put(f"/api/projects/{p['id']}/layout", headers=h, json={"layout": layout})
    assert saved.status_code == 200, saved.text
    again = client.get(f"/api/projects/{p['id']}/layout", headers=h).json()
    for oid in ("rack1", "rack2", "rack3", "obs1", "charge1", "load1", "unload1", "start1"):
        a = next(o for o in layout["objects"] if o["id"] == oid)
        b = next(o for o in again["objects"] if o["id"] == oid)
        assert a["x"] == b["x"] and a["y"] == b["y"]
        assert a["width"] == b["width"] and a["height"] == b["height"]
        assert float(a.get("rotation") or 0) == float(b.get("rotation") or 0)
    viz = client.get(f"/api/visualization/{p['id']}/layout?robots_count=6", headers=h).json()
    for oid in ("rack1", "rack3", "obs1", "load1"):
        o = next(x for x in again["objects"] if x["id"] == oid)
        z = next(x for x in viz["zones"] if x["id"] == oid)
        assert z["x"] == o["x"] and z["y"] == o["y"]
        assert z["width"] == o["width"] and z["height"] == o["height"]
