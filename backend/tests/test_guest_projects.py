"""Гостевая сессия: свои проекты, изоляция, демо read-only."""


def _guest(client):
    r = client.post("/api/auth/guest-continue")
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == "guest"
    assert body["user"]["expires_at"]
    return body["access_token"], body["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_guest_creates_and_edits_own_project(client):
    token, user = _guest(client)
    h = _auth(token)
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    ot = next((t for t in types if t.get("code") == "warehouse"), types[0])
    created = client.post(
        "/api/projects",
        headers=h,
        json={"name": "Гостевой склад", "object_type_id": ot["id"], "object_params": {"area_width_m": 50, "area_length_m": 30}},
    )
    assert created.status_code == 200, created.text
    project = created.json()
    assert project["owner_id"] == user["id"]
    assert project["is_demo"] is False
    assert project["layout"] is not None
    assert project["expires_at"] is not None

    upd = client.put(
        f"/api/projects/{project['id']}/params",
        headers=h,
        json={"object_params": {"area_width_m": 55, "area_length_m": 30, "peak_demand": 120}},
    )
    assert upd.status_code == 200
    assert upd.json()["object_params"]["peak_demand"] == 120

    layout = client.get(f"/api/projects/{project['id']}/layout", headers=h)
    assert layout.status_code == 200
    body = layout.json()
    body["width_m"] = 70
    saved = client.put(f"/api/projects/{project['id']}/layout", headers=h, json={"layout": body})
    assert saved.status_code == 200
    assert saved.json()["layout"]["width_m"] == 70


def test_guest_cannot_edit_demo(client):
    token, _ = _guest(client)
    h = _auth(token)
    demos = client.get("/api/demo/projects", headers=h).json()
    assert demos
    demo_id = demos[0]["id"]
    r = client.put(
        f"/api/projects/{demo_id}/params",
        headers=h,
        json={"object_params": {"area_width_m": 1}},
    )
    assert r.status_code == 403


def test_guest_isolation(client):
    t1, u1 = _guest(client)
    t2, u2 = _guest(client)
    assert u1["id"] != u2["id"]
    types = client.get("/api/catalog/meta/object-types", headers=_auth(t1)).json()
    ot = types[0]["id"]
    p = client.post(
        "/api/projects",
        headers=_auth(t1),
        json={"name": "Секрет", "object_type_id": ot},
    ).json()
    foreign = client.get(f"/api/projects/{p['id']}", headers=_auth(t2))
    assert foreign.status_code == 403


def test_guest_clone_demo(client):
    token, user = _guest(client)
    h = _auth(token)
    demos = client.get("/api/demo/projects", headers=h).json()
    clone = client.post(f"/api/demo/projects/{demos[0]['id']}/clone", headers=h)
    assert clone.status_code == 200
    body = clone.json()
    assert body["owner_id"] == user["id"]
    assert body["is_demo"] is False


def test_guest_cannot_mutate_or_delete_foreign(client):
    t1, _ = _guest(client)
    t2, _ = _guest(client)
    types = client.get("/api/catalog/meta/object-types", headers=_auth(t1)).json()
    p = client.post(
        "/api/projects",
        headers=_auth(t1),
        json={"name": "Чужой", "object_type_id": types[0]["id"], "object_params": {"area_width_m": 10}},
    ).json()
    h2 = _auth(t2)
    assert client.get(f"/api/projects/{p['id']}", headers=h2).status_code == 403
    assert (
        client.put(
            f"/api/projects/{p['id']}/params",
            headers=h2,
            json={"object_params": {"area_width_m": 99}},
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/projects/{p['id']}/layout",
            headers=h2,
            json={"layout": {"width_m": 1, "length_m": 1, "objects": [], "source": "manual"}},
        ).status_code
        == 403
    )
    assert client.delete(f"/api/projects/{p['id']}", headers=h2).status_code == 403
    # клон чужого (не демо) недоступен через demo-clone
    assert client.post(f"/api/demo/projects/{p['id']}/clone", headers=h2).status_code in (403, 404)


def test_guest_cannot_delete_demo(client):
    token, _ = _guest(client)
    h = _auth(token)
    demos = client.get("/api/demo/projects", headers=h).json()
    assert demos
    assert client.delete(f"/api/projects/{demos[0]['id']}", headers=h).status_code == 403
    assert (
        client.put(
            f"/api/projects/{demos[0]['id']}/layout",
            headers=h,
            json={"layout": {"width_m": 1, "length_m": 1, "objects": [], "source": "manual"}},
        ).status_code
        == 403
    )
