"""API импорта параметров: confirm/reload, отмена, ошибки, изоляция."""

from __future__ import annotations

import io

import pandas as pd


def _guest(client):
    r = client.post("/api/auth/guest-continue")
    assert r.status_code == 200
    body = r.json()
    return body["access_token"], body["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _xlsx(df: pd.DataFrame, sheet: str = "Склад") -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=sheet)
    return buf.getvalue()


def _kv_xlsx(**params) -> bytes:
    rows = [{"Параметр": k, "Значение": v, "Ед. изм.": "", "Примечание": ""} for k, v in params.items()]
    return _xlsx(pd.DataFrame(rows))


def _create_warehouse(client, headers, name="Импорт API"):
    types = client.get("/api/catalog/meta/object-types", headers=headers).json()
    ot = next((t for t in types if t.get("code") == "warehouse"), types[0])
    r = client.post(
        "/api/projects",
        headers=headers,
        json={"name": name, "object_type_id": ot["id"], "object_params": {"area_width_m": 40}},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_import_confirm_persists_after_get(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h)
    pid = project["id"]
    content = _kv_xlsx(peak_demand=420, area_width_m=55, current_labor_cost_year=12_000_000)
    files = {"file": ("params.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    conf = client.post(f"/api/projects/{pid}/params/import/confirm", headers=h, files=files, data={"mapping_json": "{}"})
    assert conf.status_code == 200, conf.text
    body = conf.json()
    assert body["object_params"]["peak_demand"] == 420
    got = client.get(f"/api/projects/{pid}/params", headers=h)
    assert got.status_code == 200
    assert got.json()["object_params"]["peak_demand"] == 420
    assert got.json()["object_params"]["area_width_m"] == 55


def test_preview_does_not_persist(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h, name="Preview only")
    pid = project["id"]
    before = client.get(f"/api/projects/{pid}/params", headers=h).json()["object_params"]
    content = _kv_xlsx(peak_demand=999)
    files = {"file": ("p.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    prev = client.post(f"/api/projects/{pid}/params/import/preview", headers=h, files=files)
    assert prev.status_code == 200
    after = client.get(f"/api/projects/{pid}/params", headers=h).json()["object_params"]
    assert after.get("peak_demand") == before.get("peak_demand")
    assert after.get("peak_demand") != 999


def test_import_corrupt_file_api(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h)
    files = {"file": ("broken.xlsx", b"not-zip-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = client.post(f"/api/projects/{project['id']}/params/import/validate", headers=h, files=files, data={"mapping_json": "{}"})
    # validate возвращает valid=false или 4xx — не 500
    assert r.status_code in (200, 400)
    if r.status_code == 200:
        assert r.json().get("valid") is False


def test_import_empty_and_unsupported(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h)
    pid = project["id"]
    empty = _xlsx(pd.DataFrame())
    files = {"file": ("empty.xlsx", empty, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    v = client.post(f"/api/projects/{pid}/params/import/validate", headers=h, files=files, data={"mapping_json": "{}"})
    assert v.status_code == 200
    assert v.json().get("valid") is False

    bad = client.post(
        f"/api/projects/{pid}/params/import/preview",
        headers=h,
        files={"file": ("plan.dwg", b"x" * 200, "application/octet-stream")},
    )
    assert bad.status_code == 400


def test_import_too_large(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h)
    huge = b"x" * (11 * 1024 * 1024)
    r = client.post(
        f"/api/projects/{project['id']}/params/import/preview",
        headers=h,
        files={"file": ("big.xlsx", huge, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert r.status_code == 400


def test_import_overwrite_conflict_reported(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h)
    pid = project["id"]
    client.put(
        f"/api/projects/{pid}/params",
        headers=h,
        json={"object_params": {"peak_demand": 100, "area_width_m": 40}},
    )
    content = _kv_xlsx(peak_demand=500, area_width_m=40)
    files = {"file": ("ov.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    v = client.post(f"/api/projects/{pid}/params/import/validate", headers=h, files=files, data={"mapping_json": "{}"})
    assert v.status_code == 200
    body = v.json()
    assert body.get("valid") is True
    overwritten = body.get("will_overwrite") or body.get("overwritten_keys") or []
    assert "peak_demand" in overwritten


def test_confirm_rejected_when_invalid(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h)
    empty = _xlsx(pd.DataFrame())
    files = {"file": ("e.xlsx", empty, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = client.post(
        f"/api/projects/{project['id']}/params/import/confirm",
        headers=h,
        files=files,
        data={"mapping_json": "{}"},
    )
    assert r.status_code == 400
    # параметры не затёрты
    got = client.get(f"/api/projects/{project['id']}/params", headers=h).json()["object_params"]
    assert got.get("area_width_m") == 40


def test_confirm_idempotent_merge(client):
    token, _ = _guest(client)
    h = _auth(token)
    project = _create_warehouse(client, h)
    pid = project["id"]
    content = _kv_xlsx(peak_demand=111, area_length_m=33)
    files = {"file": ("once.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r1 = client.post(f"/api/projects/{pid}/params/import/confirm", headers=h, files=files, data={"mapping_json": "{}"})
    assert r1.status_code == 200
    files2 = {"file": ("once.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r2 = client.post(f"/api/projects/{pid}/params/import/confirm", headers=h, files=files2, data={"mapping_json": "{}"})
    assert r2.status_code == 200
    params = client.get(f"/api/projects/{pid}/params", headers=h).json()["object_params"]
    assert params["peak_demand"] == 111
    assert params["area_length_m"] == 33


def test_guest_cannot_import_into_foreign_or_demo(client):
    t1, _ = _guest(client)
    t2, _ = _guest(client)
    p1 = _create_warehouse(client, _auth(t1), name="Owner A")
    content = _kv_xlsx(peak_demand=1)
    files = {"file": ("x.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    foreign = client.post(
        f"/api/projects/{p1['id']}/params/import/confirm",
        headers=_auth(t2),
        files=files,
        data={"mapping_json": "{}"},
    )
    assert foreign.status_code == 403

    demos = client.get("/api/demo/projects", headers=_auth(t2)).json()
    assert demos
    demo_files = {"file": ("x.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    demo_imp = client.post(
        f"/api/projects/{demos[0]['id']}/params/import/confirm",
        headers=_auth(t2),
        files=demo_files,
        data={"mapping_json": "{}"},
    )
    assert demo_imp.status_code == 403
