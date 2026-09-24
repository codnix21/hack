from types import SimpleNamespace

from app.services.matching import match_robot_to_project, run_matching


def _robot(**kwargs):
    defaults = dict(
        id=1,
        payload_kg=500,
        width_mm=800,
        productivity_ops_per_hour=40,
        price_rub=1_000_000,
        speed_mps=1.5,
        autonomy_hours=10,
        navigation="SLAM/LiDAR",
        supported_processes=["transport", "picking"],
        industry_raw="логистика",
        scenario_raw="складская транспортировка",
        operating_conditions={
            "object_types": ["warehouse"],
            "temperature_min_c": 0,
            "temperature_max_c": 40,
            "humidity_max_pct": 90,
            "indoor": True,
            "floor_types": ["бетон", "плитка"],
        },
        archived=False,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_hard_exclude_payload():
    r = match_robot_to_project(_robot(payload_kg=100), {"required_payload_kg": 300}, "warehouse")
    assert r["status"] == "excluded"
    assert any("грузоподъёмность" in x.lower() or "Грузоподъёмность" in x or "грузоподъем" in x.lower() for x in r["exclusion_reasons"])


def test_hard_exclude_aisle_width():
    r = match_robot_to_project(_robot(width_mm=1600), {"aisle_width_mm": 1200}, "warehouse")
    assert r["status"] == "excluded"
    assert r["exclusion_reasons"]


def test_object_type_mismatch():
    r = match_robot_to_project(_robot(), {"required_payload_kg": 100}, "airport")
    assert r["status"] == "excluded"
    assert any("типа объекта" in x for x in r["exclusion_reasons"])


def test_operating_conditions_temperature():
    r = match_robot_to_project(
        _robot(),
        {"required_payload_kg": 100, "temperature_min_c": -20},
        "warehouse",
    )
    assert r["status"] == "excluded"


def test_outdoor_indoor_robot_needs_review_not_exclude():
    r = match_robot_to_project(
        _robot(),
        {
            "required_payload_kg": 100,
            "aisle_width_mm": 2000,
            "indoor": False,
            "required_processes": ["transport"],
            "temperature_min_c": 5,
            "temperature_max_c": 30,
        },
        "warehouse",
    )
    assert r["status"] == "needs_review"
    assert any("улиц" in x.lower() or "помещен" in x.lower() for x in r["match_reasons"])


def test_outdoor_capable_robot_suitable():
    r = match_robot_to_project(
        _robot(
            operating_conditions={
                "object_types": ["airport"],
                "temperature_min_c": -25,
                "temperature_max_c": 40,
                "humidity_max_pct": 90,
                "indoor": False,
                "floor_types": ["асфальт", "бетон"],
            }
        ),
        {
            "required_payload_kg": 100,
            "aisle_width_mm": 2500,
            "indoor": False,
            "required_processes": ["transport"],
            "temperature_min_c": -20,
            "temperature_max_c": 35,
            "charging_stations": 2,
            "work_mode": "1с",
            "shifts_count": 1,
        },
        "airport",
    )
    assert r["status"] == "suitable"


def test_charging_zero_needs_review():
    r = match_robot_to_project(
        _robot(),
        {
            "required_payload_kg": 100,
            "aisle_width_mm": 2000,
            "charging_stations": 0,
            "required_processes": ["transport"],
        },
        "warehouse",
    )
    assert r["status"] == "needs_review"
    assert any("заряд" in x.lower() for x in r["match_reasons"])


def test_navigation_mismatch_needs_review():
    r = match_robot_to_project(
        _robot(navigation="магнитная лента"),
        {
            "required_payload_kg": 100,
            "aisle_width_mm": 2000,
            "required_navigation": "SLAM",
            "required_processes": ["transport"],
        },
        "warehouse",
    )
    assert r["status"] == "needs_review"
    assert any("навигац" in x.lower() for x in r["match_reasons"])


def test_needs_review_missing_data():
    r = match_robot_to_project(
        _robot(payload_kg=None, price_rub=None, productivity_ops_per_hour=None, speed_mps=None),
        {"required_payload_kg": 100, "aisle_width_mm": 2000},
        "warehouse",
    )
    assert r["status"] == "needs_review"
    assert r["status"] != "excluded"
    assert any(
        "Грузоподъёмность не проверена" in x or "нет данных в исходных материалах" in x
        for x in r["match_reasons"]
    )
    assert "payload_kg" in r["missing_checks"]
    assert any("Отсутствуют данные" in x or "цена" in x for x in r["match_reasons"])


def test_missing_payload_needs_review_not_excluded():
    r = match_robot_to_project(
        _robot(payload_kg=None),
        {"required_payload_kg": 200, "aisle_width_mm": 2000, "required_processes": ["transport"]},
        "warehouse",
    )
    assert r["status"] == "needs_review"
    assert not r["exclusion_reasons"]
    assert any("Грузоподъёмность не проверена" in x for x in r["match_reasons"])
    assert any("Грузоподъёмность не проверена" in x for x in r["warnings"])
    assert "payload_kg" in r["missing_checks"]


def test_missing_width_needs_review_not_excluded():
    r = match_robot_to_project(
        _robot(width_mm=None),
        {"required_payload_kg": 100, "aisle_width_mm": 1200, "required_processes": ["transport"]},
        "warehouse",
    )
    assert r["status"] == "needs_review"
    assert not r["exclusion_reasons"]
    assert "width_mm" in r["missing_checks"]


def test_industry_scenario_soft_boost():
    r = match_robot_to_project(
        _robot(),
        {
            "required_payload_kg": 100,
            "aisle_width_mm": 2000,
            "required_processes": ["transport"],
            "industry_raw": "логистика",
            "scenario_raw": "склад",
            "charging_stations": 2,
            "work_mode": "1с",
        },
        "warehouse",
    )
    assert r["status"] in ("suitable", "needs_review")
    assert any("Отрасль" in x or "Сценарий" in x for x in r["match_reasons"])


def test_suitable_match():
    r = match_robot_to_project(
        _robot(),
        {
            "required_payload_kg": 200,
            "aisle_width_mm": 1500,
            "temperature_min_c": 5,
            "temperature_max_c": 30,
            "required_processes": ["transport"],
            "peak_demand": 100,
            "charging_stations": 2,
            "floor_type": "бетон",
            "work_mode": "1с",
        },
        "warehouse",
    )
    assert r["status"] == "suitable"
    assert r["match_score"] > 50
    assert r["match_reasons"]


def test_run_matching_sorts():
    robots = [
        _robot(id=1, payload_kg=50),
        _robot(id=2, payload_kg=500),
        _robot(id=3, payload_kg=None, price_rub=None),
    ]
    results = run_matching(robots, {"required_payload_kg": 200, "aisle_width_mm": 2000}, "warehouse")
    assert results[0]["status"] in ("suitable", "needs_review")
    assert len(results) == 3
    missing = next(x for x in results if x["robot_id"] == 3)
    assert missing["status"] == "needs_review"
    assert missing["status"] != "excluded"
