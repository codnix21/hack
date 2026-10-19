"""Выбор решения для экономики: POST /matching/{id}/select."""


def _guest(client):
    r = client.post("/api/auth/guest-continue")
    assert r.status_code == 200
    return r.json()["access_token"], r.json()["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_select_solution_sets_economics_robot_and_price(client):
    token, user = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    ot = next((t for t in types if t.get("code") == "warehouse"), types[0])
    project = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Select solution project",
            "object_type_id": ot["id"],
            "object_params": {
                "area_width_m": 50,
                "area_length_m": 40,
                "peak_demand": 200,
                "required_payload_kg": 500,
                "current_labor_cost_year": 12_000_000,
            },
        },
    ).json()
    assert project["owner_id"] == user["id"]

    catalog = client.get("/api/catalog?page_size=50&min_price=1", headers=h).json()
    items = catalog.get("items") or []
    priced = next((r for r in items if r.get("price_rub")), None)
    assert priced is not None, "нужен хотя бы один робот с ценой в каталоге"

    run = client.post(f"/api/matching/{project['id']}/run", headers=h)
    assert run.status_code == 200, run.text

    sel = client.post(
        f"/api/matching/{project['id']}/select",
        headers=h,
        json={"robot_id": priced["id"]},
    )
    assert sel.status_code == 200, sel.text
    body = sel.json()
    assert body["robot_id"] == priced["id"]
    assert body["selected"] is True

    proj = client.get(f"/api/projects/{project['id']}", headers=h).json()
    assert proj["object_params"].get("economics_robot_id") == priced["id"]

    results = client.get(f"/api/matching/{project['id']}/results", headers=h).json()
    chosen = [r for r in results["results"] if r.get("selected")]
    assert len(chosen) == 1
    assert chosen[0]["robot_id"] == priced["id"]

    econ = client.post(
        f"/api/economics/{project['id']}/calculate",
        headers=h,
        json={"scenario": "purchase"},
    )
    assert econ.status_code == 200, econ.text
    res = econ.json()["results"]
    assert res.get("robot_id") == priced["id"]
    flags = res.get("assumption_flags") or {}
    assert not flags.get("unit_price_assumed"), res.get("input_warnings")
    unit = (res.get("inputs") or {}).get("unit_price") or (res.get("assumptions") or {}).get(
        "unit_price"
    )
    if unit is not None:
        assert abs(float(unit) - float(priced["price_rub"])) < 1.0


def test_select_on_shared_demo_forbidden(client):
    token, _ = _guest(client)
    h = _auth(token)
    demos = client.get("/api/demo/projects", headers=h).json()
    assert demos
    robots = client.get("/api/catalog?page_size=5", headers=h).json()
    items = robots.get("items") or []
    assert items
    r = client.post(
        f"/api/matching/{demos[0]['id']}/select",
        headers=h,
        json={"robot_id": items[0]["id"]},
    )
    assert r.status_code == 403
