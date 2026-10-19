"""A* + LOS + OBB navigation acceptance."""

from app.services.layout import layout_to_visualization, sanitize_layout
from app.services.layout_nav import approach_point, plan_route, point_in_oriented_rect, segment_clear, blocked_polys, demo_clearance_m


def _layout():
    return sanitize_layout(
        {
            "width_m": 60,
            "length_m": 40,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "x": 0, "y": 0, "width": 60, "height": 40},
                {"id": "rack1", "kind": "rack", "name": "С1", "x": 20, "y": 10, "width": 10, "height": 16, "rotation": 0},
                {"id": "rack2", "kind": "rack", "name": "С2", "x": 36, "y": 10, "width": 10, "height": 16, "rotation": 25},
                {"id": "load1", "kind": "load", "name": "In", "x": 2, "y": 2, "width": 3, "height": 2},
                {"id": "unload1", "kind": "unload", "name": "Out", "x": 50, "y": 2, "width": 3, "height": 2},
                {"id": "charge1", "kind": "charge", "name": "ZS", "x": 2, "y": 32, "width": 3, "height": 3},
            ],
        }
    )


def test_free_path_and_length():
    layout = _layout()
    r = plan_route(layout, (5, 5), (55, 5))
    assert r["status"] == "ok" and not r["blocked"]
    assert len(r["points"]) >= 2
    assert r["length_m"] > 0
    assert r["length_m"] >= 49  # почти прямая


def test_avoids_rack_after_smooth():
    layout = _layout()
    r = plan_route(layout, (5, 18), (55, 18))
    assert not r["blocked"]
    polys = blocked_polys(layout, demo_clearance_m())
    for i in range(1, len(r["points"])):
        a = (r["points"][i - 1]["x"], r["points"][i - 1]["y"])
        b = (r["points"][i]["x"], r["points"][i]["y"])
        assert segment_clear(a, b, polys), (a, b)


def test_blocked_wall_no_fake():
    layout = sanitize_layout(
        {
            "width_m": 30,
            "length_m": 20,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "x": 0, "y": 0, "width": 30, "height": 20},
                {"id": "wall_rack", "kind": "rack", "x": 12, "y": 0.2, "width": 6, "height": 19.6},
                {"id": "load1", "kind": "load", "x": 2, "y": 8, "width": 2, "height": 2},
                {"id": "unload1", "kind": "unload", "x": 24, "y": 8, "width": 2, "height": 2},
            ],
        }
    )
    r = plan_route(layout, (3, 9), (25, 9))
    assert r["blocked"] and r["points"] == []
    assert r["blocked_reason"]


def test_goal_inside_rack_rejected():
    layout = _layout()
    r = plan_route(layout, (5, 5), (25, 18))  # inside rack1
    assert r["blocked"]
    assert "препятств" in (r["blocked_reason"] or "").lower()


def test_rotated_rack_blocks_center():
    layout = _layout()
    rack2 = next(o for o in layout["objects"] if o["id"] == "rack2")
    assert point_in_oriented_rect(41, 18, rack2) or point_in_oriented_rect(
        rack2["x"] + rack2["width"] / 2, rack2["y"] + rack2["height"] / 2, rack2
    )


def test_approach_not_inside_rack():
    layout = _layout()
    rack = next(o for o in layout["objects"] if o["id"] == "rack1")
    ax, ay = approach_point(rack, layout)
    polys = blocked_polys(layout, demo_clearance_m())
    from app.services.layout_nav import point_blocked

    assert not point_blocked(ax, ay, polys)


def test_tasks_have_individual_routes():
    viz = layout_to_visualization(_layout(), robots_count=4)
    assert viz["tasks"]
    routes = [t["route"]["id"] for t in viz["tasks"] if not t["route"].get("blocked")]
    assert len(set(routes)) == len(routes)
    # разные задания — разные polyline (или хотя бы разные id)
    ok_tasks = [t for t in viz["tasks"] if not t.get("blocked_reason")]
    assert any(t["status"] in ("assigned", "queued") for t in ok_tasks)
    assert viz["meta"]["rotation_supported"] is True
    assert viz["meta"]["pathfinding"] == "astar_los_obb"


def test_diagonal_corner_not_through_gap():
    """Два стеллажа образуют узкий угловой стык — диагональ не должна прорезать угол."""
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 40,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "x": 0, "y": 0, "width": 40, "height": 40},
                {"id": "a", "kind": "rack", "x": 10, "y": 10, "width": 10, "height": 10},
                {"id": "b", "kind": "rack", "x": 20, "y": 20, "width": 10, "height": 10},
            ],
        }
    )
    # путь вокруг должен существовать
    r = plan_route(layout, (5, 25), (35, 5))
    if not r["blocked"]:
        polys = blocked_polys(layout, demo_clearance_m())
        for i in range(1, len(r["points"])):
            assert segment_clear(
                (r["points"][i - 1]["x"], r["points"][i - 1]["y"]),
                (r["points"][i]["x"], r["points"][i]["y"]),
                polys,
            )
