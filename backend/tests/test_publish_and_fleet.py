"""Публикация, копия, сравнение парка, очистка гостей."""

from datetime import timedelta

from app.models.project import Project
from app.models.user import User, utcnow
from app.services.cleanup_guests import cleanup_expired_guests
from app.services.fleet_compare import compare_fleet_counts


def _user_token(client):
    r = client.post("/api/auth/login", json={"email": "user@demo.local", "password": "User123!"})
    return r.json()["access_token"]


def _guest(client):
    r = client.post("/api/auth/guest-continue")
    return r.json()["access_token"], r.json()["user"]


def test_fleet_compare_service():
    out = compare_fleet_counts(
        [4, 6, 8],
        peak_demand=200,
        productivity=50,
        unit_price=2_000_000,
        overrides={"current_labor_cost_year": 10_000_000, "labor_reduction_share": 0.5},
        assumptions={"charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert len(out["rows"]) == 3
    assert out["rows"][0]["robots_count"] == 4
    assert out["rows"][2]["economics"]["capex"]["capex"] > out["rows"][0]["economics"]["capex"]["capex"]
    assert out["rows"][0]["operations"]["estimated"] is True


def test_publish_public_view_and_clone(client, db_session):
    token = _user_token(client)
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Публичный склад",
            "object_type_id": types[0]["id"],
            "object_params": {
                "peak_demand": 150,
                "current_labor_cost_year": 12_000_000,
                "unit_price": 3_500_000,
            },
        },
    ).json()
    client.post(f"/api/economics/{p['id']}/calculate", headers=h, json={"scenario": "purchase"})
    pub = client.post(f"/api/projects/{p['id']}/publish", headers=h)
    assert pub.status_code == 200
    public_token = pub.json()["public_token"]
    assert public_token and len(public_token) >= 24

    view = client.get(f"/api/public/p/{public_token}")
    assert view.status_code == 200
    body = view.json()
    assert body["read_only"] is True
    assert "owner_id" not in body["project"]
    assert "public_token" not in body["project"]
    assert body["project"]["name"] == "Публичный склад"

    # visitor cannot mutate original via public API — no write routes
    bad = client.put(f"/api/projects/{p['id']}/params", json={"object_params": {"x": 1}})
    assert bad.status_code in (401, 403)

    gtoken, guser = _guest(client)
    clone = client.post(
        f"/api/public/p/{public_token}/clone",
        headers={"Authorization": f"Bearer {gtoken}"},
    )
    assert clone.status_code == 200
    assert clone.json()["owner_id"] == guser["id"]
    assert clone.json()["id"] != p["id"]
    assert clone.json()["public_token"] is None

    # unpublish
    client.delete(f"/api/projects/{p['id']}/publish", headers=h)
    gone = client.get(f"/api/public/p/{public_token}")
    assert gone.status_code == 404

    invalid = client.get("/api/public/p/not-a-real-token-zzzz")
    assert invalid.status_code == 404


def test_fleet_compare_api_no_overwrite_purchase(client):
    token = _user_token(client)
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    p = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Парк",
            "object_type_id": types[0]["id"],
            "object_params": {
                "peak_demand": 200,
                "current_labor_cost_year": 12_000_000,
                "unit_price": 3_500_000,
            },
        },
    ).json()
    calc = client.post(
        f"/api/economics/{p['id']}/calculate",
        headers=h,
        json={"scenario": "purchase", "robots_count": 5},
    ).json()
    base_n = calc["results"]["robots_count"]
    fc = client.post(
        f"/api/economics/{p['id']}/fleet-compare",
        headers=h,
        json={"counts": [4, 6, 8], "persist": True},
    )
    assert fc.status_code == 200, fc.text
    assert fc.json()["persisted"] is True
    assert len(fc.json()["rows"]) == 3
    # purchase calculation not replaced by last fleet row
    again = client.post(
        f"/api/economics/{p['id']}/calculate",
        headers=h,
        json={"scenario": "purchase", "robots_count": 5},
    ).json()
    assert again["results"]["robots_count"] == base_n


def test_cleanup_expired_guests(db_session):
    guest = User(
        email="guest-expired@session.local",
        password_hash="x",
        full_name="Expired",
        role="guest",
        expires_at=utcnow() - timedelta(days=1),
    )
    db_session.add(guest)
    db_session.flush()
    proj = Project(
        owner_id=guest.id,
        name="Старый гостевой",
        status="draft",
        is_demo=False,
        expires_at=utcnow() - timedelta(days=1),
    )
    db_session.add(proj)
    db_session.commit()
    stats = cleanup_expired_guests(db_session)
    assert stats["removed_guest_users"] >= 1
    assert stats["removed_projects"] >= 1
    assert db_session.query(User).filter(User.email == "guest-expired@session.local").first() is None
