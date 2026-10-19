"""Диагностика /health и наличие ezdxf в тестовом окружении."""


def test_health_reports_dxf_feature(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in ("ok", "degraded")
    dxf = body["features"]["dxf_preview"]
    assert "available" in dxf
    assert "version" in dxf
    # В CI/локальных тестах ezdxf обычно установлен (requirements.txt)
    if dxf["available"]:
        assert dxf["version"]
        assert body["status"] == "ok"
