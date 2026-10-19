"""Актуальность экономики: изменение параметров → stale, пересчёт → fresh."""


def _guest(client):
    r = client.post("/api/auth/guest-continue")
    assert r.status_code == 200
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


UI_LIKE_BODY = {
    "scenario": "purchase",
    "utilization": 0.85,
    "reserve": 0.10,
    "years": 5,
    "overrides": {"labor_reduction_share": 0.4},
}


def test_freshness_none_then_fresh_then_stale_after_params_change(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    ot = next((t for t in types if t.get("code") == "warehouse"), types[0])
    project = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Freshness project",
            "object_type_id": ot["id"],
            "object_params": {
                "area_width_m": 50,
                "area_length_m": 40,
                "peak_demand": 200,
                "current_labor_cost_year": 12_000_000,
                "unit_price": 3_500_000,
            },
        },
    ).json()
    pid = project["id"]

    fresh0 = client.get(f"/api/economics/{pid}/freshness", headers=h)
    assert fresh0.status_code == 200, fresh0.text
    assert fresh0.json()["status"] == "none"

    calc = client.post(
        f"/api/economics/{pid}/calculate",
        headers=h,
        json=UI_LIKE_BODY,
    )
    assert calc.status_code == 200, calc.text

    fresh1 = client.get(f"/api/economics/{pid}/freshness", headers=h)
    assert fresh1.status_code == 200
    assert fresh1.json()["status"] == "fresh", fresh1.json()

    saved = client.put(
        f"/api/projects/{pid}/params",
        headers=h,
        json={
            "object_params": {
                "area_width_m": 50,
                "area_length_m": 40,
                "peak_demand": 400,
                "current_labor_cost_year": 12_000_000,
                "unit_price": 3_500_000,
            }
        },
    )
    assert saved.status_code == 200, saved.text

    fresh2 = client.get(f"/api/economics/{pid}/freshness", headers=h)
    assert fresh2.status_code == 200
    body = fresh2.json()
    assert body["status"] == "stale"
    assert "peak_demand" in (body.get("mismatches") or [])

    recalc = client.post(
        f"/api/economics/{pid}/calculate",
        headers=h,
        json=UI_LIKE_BODY,
    )
    assert recalc.status_code == 200, recalc.text
    fresh3 = client.get(f"/api/economics/{pid}/freshness", headers=h)
    assert fresh3.json()["status"] == "fresh", fresh3.json()


def test_freshness_stale_after_labor_change_not_after_whatif_only_fields(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    ot = types[0]
    project = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Freshness labor",
            "object_type_id": ot["id"],
            "object_params": {
                "peak_demand": 150,
                "current_labor_cost_year": 10_000_000,
                "unit_price": 2_500_000,
            },
        },
    ).json()
    pid = project["id"]
    assert client.post(f"/api/economics/{pid}/calculate", headers=h, json=UI_LIKE_BODY).status_code == 200
    assert client.get(f"/api/economics/{pid}/freshness", headers=h).json()["status"] == "fresh"

    # what-if-only recalc with different years must not leave permanent false-stale
    # against default freshness resolve — years are not project-persisted inputs.
    body2 = {**UI_LIKE_BODY, "years": 8}
    assert client.post(f"/api/economics/{pid}/calculate", headers=h, json=body2).status_code == 200
    assert client.get(f"/api/economics/{pid}/freshness", headers=h).json()["status"] == "fresh"

    client.put(
        f"/api/projects/{pid}/params",
        headers=h,
        json={
            "object_params": {
                "peak_demand": 150,
                "current_labor_cost_year": 20_000_000,
                "unit_price": 2_500_000,
            }
        },
    )
    fr = client.get(f"/api/economics/{pid}/freshness", headers=h).json()
    assert fr["status"] == "stale"
    assert "overrides.current_labor_cost_year" in (fr.get("mismatches") or [])
