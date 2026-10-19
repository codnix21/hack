import io

import ezdxf
import pytest
from fastapi import HTTPException

from app.services.dxf_import import entities_to_layout, parse_dxf
from app.services.layout import layout_to_visualization, sanitize_layout


def _minimal_dxf_bytes() -> bytes:
    doc = ezdxf.new("R2010")
    doc.header["$INSUNITS"] = 4  # mm
    msp = doc.modelspace()
    msp.add_line((0, 0), (10000, 0), dxfattribs={"layer": "WALLS"})
    msp.add_lwpolyline(
        [(1000, 1000), (4000, 1000), (4000, 5000), (1000, 5000)],
        close=True,
        dxfattribs={"layer": "RACKS"},
    )
    msp.add_circle((2000, 2000), 500, dxfattribs={"layer": "MISC"})
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


MINIMAL_DXF = _minimal_dxf_bytes()


def test_parse_dxf_and_convert():
    preview = parse_dxf(MINIMAL_DXF, "sample.dxf")
    assert preview["entities"]
    assert preview["suggested_unit_to_m"] == 0.001
    layout = entities_to_layout(preview, unit_to_m=0.001)
    assert layout["width_m"] > 0
    assert layout["length_m"] >= 0
    assert any(o.get("from_dxf") for o in layout["objects"])


def test_parse_dxf_crlf_windows_bytes():
    """Windows DXF с CRLF не должен давать пустую геометрию (баг StringIO на Linux)."""
    text = MINIMAL_DXF.decode("utf-8", errors="ignore").replace("\r\n", "\n").replace("\r", "\n")
    crlf = text.replace("\n", "\r\n").encode("utf-8")
    assert b"\r\n" in crlf
    preview = parse_dxf(crlf, "windows_sample.dxf")
    assert preview["entities"], "CRLF DXF must yield entities"


def test_empty_dxf_rejected():
    with pytest.raises(HTTPException) as ei:
        parse_dxf(b"", "empty.dxf")
    assert ei.value.status_code == 400


def test_dwg_rejected():
    with pytest.raises(HTTPException) as ei:
        parse_dxf(b"fake", "plan.dwg")
    assert "DWG" in ei.value.detail


def test_layout_routes_avoid_racks():
    layout = sanitize_layout(
        {
            "width_m": 40,
            "length_m": 30,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "name": "Контур", "x": 0, "y": 0, "width": 40, "height": 30},
                {"id": "rack1", "kind": "rack", "name": "С1", "x": 10, "y": 8, "width": 8, "height": 12},
                {"id": "load1", "kind": "load", "name": "In", "x": 2, "y": 2, "width": 3, "height": 2},
                {"id": "unload1", "kind": "unload", "name": "Out", "x": 30, "y": 2, "width": 3, "height": 2},
            ],
        }
    )
    viz = layout_to_visualization(layout, robots_count=2)
    assert viz["routes"]
    assert viz["robots"]
    assert viz["meta"]["source"] == "saved_layout"
    # зоны приёмки/отгрузки сохраняют прямоугольники редактора
    kinds = {z["type"] for z in viz["zones"]}
    assert "storage" in kinds
    assert "load" in kinds and "unload" in kinds
    rack = next(z for z in viz["zones"] if z["id"] == "rack1")
    assert rack["x"] == 10 and rack["width"] == 8
    from app.services.layout_nav import blocked_polys, demo_clearance_m, segment_clear

    polys = blocked_polys(layout, demo_clearance_m())
    for route in viz["routes"]:
        if route.get("blocked") or len(route.get("points") or []) < 2:
            continue
        for i in range(1, len(route["points"])):
            a = (route["points"][i - 1]["x"], route["points"][i - 1]["y"])
            b = (route["points"][i]["x"], route["points"][i]["y"])
            assert segment_clear(a, b, polys), (a, b)


def test_layout_editor_objects_match_visualization_geometry():
    """Редактор и симуляция — одни и те же метры для стеллажа."""
    layout = sanitize_layout(
        {
            "width_m": 113.1,
            "length_m": 176.8,
            "objects": [
                {"id": "wall_contour", "kind": "wall", "name": "Контур", "x": 0, "y": 0, "width": 50, "height": 50},
                {"id": "rack_a", "kind": "rack", "name": "Стеллаж A", "x": 20.5, "y": 40.25, "width": 12.0, "height": 30.0},
                {"id": "load1", "kind": "load", "name": "Приёмка", "x": 5, "y": 5, "width": 4, "height": 3},
                {"id": "unload1", "kind": "unload", "name": "Отгрузка", "x": 90, "y": 5, "width": 4, "height": 3},
            ],
        }
    )
    # sanitize синхронизирует контур с размерами склада
    wall = next(o for o in layout["objects"] if o["id"] == "wall_contour")
    assert wall["width"] == 113.1 and wall["height"] == 176.8
    viz = layout_to_visualization(layout, robots_count=3)
    rack = next(z for z in viz["zones"] if z["id"] == "rack_a")
    assert rack["x"] == 20.5 and rack["y"] == 40.25
    assert rack["width"] == 12.0 and rack["height"] == 30.0
    assert viz["canvas"]["width_m"] == 113.1
    assert viz["canvas"]["length_m"] == 176.8


def test_dxf_api_preview_confirm(client):
    login = client.post("/api/auth/login", json={"email": "user@demo.local", "password": "User123!"})
    token = login.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "DXF test", "object_type_id": types[0]["id"]},
    ).json()
    prev = client.post(
        f"/api/projects/{p['id']}/layout/dxf/preview",
        headers=h,
        files={"file": ("sample.dxf", MINIMAL_DXF, "application/dxf")},
    )
    assert prev.status_code == 200, prev.text
    preview = prev.json()
    conf = client.post(
        f"/api/projects/{p['id']}/layout/dxf/confirm",
        headers=h,
        json={"preview": preview, "unit_to_m": 0.001},
    )
    assert conf.status_code == 200, conf.text
    assert conf.json()["layout"]["source"] == "dxf"
    # повторное открытие
    got = client.get(f"/api/projects/{p['id']}/layout", headers=h)
    assert got.status_code == 200
    assert got.json()["source"] == "dxf"
    assert got.json()["width_m"] > 0


def test_layout_save_roundtrip_and_area(client):
    login = client.post("/api/auth/login", json={"email": "user@demo.local", "password": "User123!"})
    token = login.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Layout roundtrip RU", "object_type_id": types[0]["id"]},
    ).json()
    layout = {
        "width_m": 50,
        "length_m": 40,
        "objects": [
            {
                "id": "wall_contour",
                "kind": "wall",
                "name": "Контур",
                "x": 0,
                "y": 0,
                "width": 50,
                "height": 40,
            },
            {
                "id": "rack_a",
                "kind": "rack",
                "name": "Стеллаж А",
                "x": 5,
                "y": 6,
                "width": 8,
                "height": 12,
            },
        ],
    }
    saved = client.put(
        f"/api/projects/{p['id']}/layout",
        headers=h,
        json={"layout": layout},
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["layout"]["width_m"] == 50
    assert body["layout"]["length_m"] == 40
    assert body["summary"]["area_m2"] == 2000.0
    # перемещение стеллажа
    layout["objects"][1]["x"] = 12
    layout["objects"][1]["y"] = 10
    client.put(f"/api/projects/{p['id']}/layout", headers=h, json={"layout": layout})
    again = client.get(f"/api/projects/{p['id']}/layout", headers=h).json()
    rack = next(o for o in again["objects"] if o["id"] == "rack_a")
    assert rack["x"] == 12
    assert rack["y"] == 10
    viz4 = client.get(f"/api/visualization/{p['id']}/layout?robots_count=4", headers=h)
    viz8 = client.get(f"/api/visualization/{p['id']}/layout?robots_count=8", headers=h)
    assert viz4.status_code == 200 and viz8.status_code == 200
    assert viz4.json()["meta"]["robots_count"] == 4
    assert viz8.json()["meta"]["robots_count"] == 8
    assert len(viz8.json()["robots"]) >= len(viz4.json()["robots"])


def test_params_area_syncs_layout_dimensions(client):
    login = client.post("/api/auth/login", json={"email": "user@demo.local", "password": "User123!"})
    token = login.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Params→layout sync", "object_type_id": types[0]["id"]},
    ).json()
    before = client.get(f"/api/projects/{p['id']}/layout", headers=h).json()
    assert before["width_m"] == 60
    upd = client.put(
        f"/api/projects/{p['id']}/params",
        headers=h,
        json={
            "object_params": {
                "area_width_m": 50,
                "area_length_m": 40,
                "peak_demand": 160,
            }
        },
    )
    assert upd.status_code == 200, upd.text
    layout = client.get(f"/api/projects/{p['id']}/layout", headers=h).json()
    assert layout["width_m"] == 50
    assert layout["length_m"] == 40
    assert upd.json()["summary"]["area_m2"] == 2000.0
