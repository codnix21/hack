def test_login_admin(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "admin@demo.local", "password": "Admin123!"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["user"]["role"] == "admin"


def test_login_user(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "user@demo.local", "password": "User123!"},
    )
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "user"


def test_login_wrong_password(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "admin@demo.local", "password": "wrong"},
    )
    assert r.status_code == 401


def test_me(client):
    token = client.post(
        "/api/auth/login",
        json={"email": "user@demo.local", "password": "User123!"},
    ).json()["access_token"]
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "user@demo.local"


def test_register_and_guest(client):
    r = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "Secret1!", "full_name": "Новый"},
    )
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "user"

    g = client.post("/api/auth/guest-continue")
    assert g.status_code == 200
    assert g.json()["user"]["role"] == "guest"


def test_catalog_accessible(client):
    r = client.get("/api/catalog?page=1&page_size=5")
    assert r.status_code == 200
    assert r.json()["total"] >= 20
