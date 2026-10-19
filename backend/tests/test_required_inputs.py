"""Обязательные входы: валидация экономики, readiness, импорт с пропусками."""

from app.services.required_inputs import (
    assess_capabilities,
    validate_for_economics,
    validate_for_layout,
)


def _guest(client):
    r = client.post("/api/auth/guest-continue")
    assert r.status_code == 200
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _min_params(**extra):
    base = {
        "peak_demand": 200,
        "current_labor_cost_year": 12_000_000,
        "unit_price": 3_500_000,
    }
    base.update(extra)
    return base


def test_validate_empty_required_fields():
    v = validate_for_economics({})
    assert v["ready"] is False
    fields = {e["field"] for e in v["errors"]}
    assert "peak_demand" in fields
    assert "current_labor_cost_year" in fields
    assert "unit_price" in fields


def test_validate_minimal_set_ready():
    v = validate_for_economics(_min_params())
    assert v["ready"] is True
    assert v["filled_required"] == 3
    assert v["total_required"] == 3


def test_validate_optional_fields_absent_still_ready():
    v = validate_for_economics(_min_params())
    assert v["ready"] is True
    # area / payload / aisle не блокируют экономику
    layout = validate_for_layout(_min_params())
    assert layout["ready"] is False


def test_validate_labor_from_headcount_derived():
    v = validate_for_economics(
        {
            "peak_demand": 180,
            "staff_count": 40,
            "staff_salary_month": 100_000,
            "unit_price": 4_000_000,
        }
    )
    assert v["ready"] is True
    assert any(w["code"] == "derived" for w in v["warnings"])


def test_validate_assumed_unit_price_warning():
    v = validate_for_economics(
        {
            "peak_demand": 100,
            "current_labor_cost_year": 5_000_000,
            "assumed_unit_price": 3_500_000,
        }
    )
    assert v["ready"] is True
    assert any(w["code"] == "assumption" for w in v["warnings"])


def test_validate_out_of_range_peak():
    v = validate_for_economics(
        {
            "peak_demand": -10,
            "current_labor_cost_year": 1_000_000,
            "unit_price": 1_000_000,
        }
    )
    assert v["ready"] is False
    assert any(e["code"] == "out_of_range" for e in v["errors"])


def test_validate_robot_price_satisfies_conditional():
    v = validate_for_economics(
        {"peak_demand": 100, "current_labor_cost_year": 2_000_000},
        robot_price=4_500_000,
        has_selected_robot=True,
    )
    assert v["ready"] is True


def test_model_assumption_labor_not_accepted():
    """Молчаливое допущение 12M не считается валидным вводом объекта."""
    v = validate_for_economics({"peak_demand": 100, "unit_price": 1_000_000})
    assert v["ready"] is False
    assert any(e["field"] == "current_labor_cost_year" for e in v["errors"])


def test_area_inconsistency_warning():
    v = validate_for_economics(
        _min_params(area_m2=1000, area_width_m=100, area_length_m=100)
    )
    assert v["ready"] is True
    assert any(w["code"] == "inconsistent" for w in v["warnings"])


def test_assess_capabilities_gates():
    caps = assess_capabilities(
        {"peak_demand": 50},
        has_layout_objects=False,
        has_economics_result=False,
    )
    assert caps["summary"]["economics_ready"] is False
    assert caps["summary"]["matching_ready"] is True
    assert caps["summary"]["layout_ready"] is False
    assert caps["summary"]["des_ready"] is False
    assert caps["summary"]["report_ready"] is False


def test_api_calculate_rejects_incomplete(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Incomplete", "object_type_id": types[0]["id"], "object_params": {}},
    ).json()
    r = client.post(
        f"/api/economics/{p['id']}/calculate",
        headers=h,
        json={"scenario": "purchase"},
    )
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert detail["code"] == "inputs_incomplete"
    assert isinstance(detail["errors"], list)
    assert len(detail["errors"]) >= 1
    for err in detail["errors"]:
        assert "field" in err and "code" in err and "message" in err


def test_api_calculate_minimal_set(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Minimal econ",
            "object_type_id": types[0]["id"],
            "object_params": _min_params(),
        },
    ).json()
    r = client.post(
        f"/api/economics/{p['id']}/calculate",
        headers=h,
        json={"scenario": "purchase"},
    )
    assert r.status_code == 200, r.text
    results = r.json()["results"]
    assert results["capex"]["capex"] > 0
    assert results["robots_count"] > 0


def test_api_calculate_without_optional_area(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "No area",
            "object_type_id": types[0]["id"],
            "object_params": _min_params(),  # без area_*
        },
    ).json()
    r = client.post(
        f"/api/economics/{p['id']}/calculate",
        headers=h,
        json={"scenario": "purchase"},
    )
    assert r.status_code == 200, r.text


def test_api_inputs_readiness(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Readiness",
            "object_type_id": types[0]["id"],
            "object_params": {"peak_demand": 100},
        },
    ).json()
    ready = client.get(f"/api/projects/{p['id']}/inputs-readiness", headers=h)
    assert ready.status_code == 200, ready.text
    body = ready.json()
    assert body["summary"]["economics_ready"] is False
    assert body["economics"]["filled_required"] == 1
    assert body["economics"]["total_required"] == 3

    client.put(
        f"/api/projects/{p['id']}/params",
        headers=h,
        json={"object_params": _min_params(peak_demand=100)},
    )
    ready2 = client.get(f"/api/projects/{p['id']}/inputs-readiness", headers=h).json()
    assert ready2["summary"]["economics_ready"] is True


def test_api_save_reopen_preserves_params(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Persist", "object_type_id": types[0]["id"], "object_params": {}},
    ).json()
    params = _min_params(aisle_width_mm=2800)
    assert (
        client.put(
            f"/api/projects/{p['id']}/params",
            headers=h,
            json={"object_params": params},
        ).status_code
        == 200
    )
    got = client.get(f"/api/projects/{p['id']}/params", headers=h).json()["object_params"]
    assert got["peak_demand"] == 200
    assert got["aisle_width_mm"] == 2800
    calc1 = client.post(
        f"/api/economics/{p['id']}/calculate",
        headers=h,
        json={"scenario": "purchase"},
    ).json()["results"]
    calc2 = client.post(
        f"/api/economics/{p['id']}/calculate",
        headers=h,
        json={"scenario": "purchase"},
    ).json()["results"]
    assert calc1["capex"]["capex"] == calc2["capex"]["capex"]
    assert calc1["robots_count"] == calc2["robots_count"]
    assert (calc1.get("npv") or {}).get("npv") == (calc2.get("npv") or {}).get("npv")


def test_freshness_stale_after_input_change(client):
    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Stale check",
            "object_type_id": types[0]["id"],
            "object_params": _min_params(),
        },
    ).json()
    assert (
        client.post(
            f"/api/economics/{p['id']}/calculate",
            headers=h,
            json={"scenario": "purchase"},
        ).status_code
        == 200
    )
    assert client.get(f"/api/economics/{p['id']}/freshness", headers=h).json()["status"] == "fresh"
    client.put(
        f"/api/projects/{p['id']}/params",
        headers=h,
        json={"object_params": _min_params(peak_demand=400)},
    )
    assert client.get(f"/api/economics/{p['id']}/freshness", headers=h).json()["status"] == "stale"


def test_excel_import_gaps_do_not_auto_validate(client):
    """Импорт с пропусками не делает проект «готовым» к экономике автоматически."""
    import io

    import pandas as pd

    token = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Import gaps", "object_type_id": types[0]["id"], "object_params": {}},
    ).json()

    # Только peak — без labor/price
    df = pd.DataFrame(
        [
            {"Параметр": "peak_demand", "Значение": 250, "Ед. изм.": "", "Примечание": ""},
        ]
    )
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="Склад")
    content = buf.getvalue()

    preview = client.post(
        f"/api/projects/{p['id']}/params/import/preview",
        headers=h,
        files={
            "file": (
                "gaps.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    op = body.get("object_params") or {}
    assert op.get("peak_demand") == 250 or "peak_demand" in str(body)
    v = validate_for_economics(op if op else {"peak_demand": 250})
    assert v["ready"] is False
    fields = {e["field"] for e in v["errors"]}
    assert "current_labor_cost_year" in fields or "unit_price" in fields

    conf = client.post(
        f"/api/projects/{p['id']}/params/import/confirm",
        headers=h,
        files={
            "file": (
                "gaps.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        data={"mapping_json": "{}"},
    )
    assert conf.status_code == 200, conf.text
    ready = client.get(f"/api/projects/{p['id']}/inputs-readiness", headers=h).json()
    assert ready["summary"]["economics_ready"] is False
