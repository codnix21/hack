from app.services.economics import (
    FORMULAS_RU,
    calc_annual_effect,
    calc_capex,
    calc_opex_annual,
    calc_payback,
    calc_robots_count,
    calc_roi,
    calc_tco,
    calculate_scenario,
    explain_robots_count,
    get_formulas,
)
import pytest


def test_robots_count_formula():
    # peak=100, prod=50, util=0.85, avail=0.95 -> effective=40.375 -> ceil(100/40.375)=3 -> ceil(3*1.1)=4
    r = calc_robots_count(100, 50, 0.85, 0.95, 0.1)
    assert r["robots_count"] == 4
    assert r["coefficients"]["utilization"] == 0.85
    assert "formula" in r


def test_capex_breakdown_transparent():
    c = calc_capex(equipment=1_000_000, software=100_000, robots_count=2)
    assert c["capex"] > 1_000_000
    assert set(c["breakdown"].keys()) >= {
        "equipment",
        "infrastructure",
        "software",
        "integration",
        "commissioning",
        "training",
        "contingency",
    }
    s = sum(c["breakdown"].values())
    assert abs(s - c["capex"]) < 0.02


def test_opex_and_effect_payback_roi_tco():
    o = calc_opex_annual(robots_count=5, service=100_000, software_cost=200_000, price_per_robot=1_000_000)
    assert o["opex_annual"] > 0
    e = calc_annual_effect(2_000_000, 100_000, o["opex_annual"])
    p = calc_payback(5_000_000, e["annual_effect"])
    assert p["payback_years"] is None or p["payback_years"] > 0
    roi = calc_roi(e["annual_effect"] * 5, 5_000_000)
    assert roi["roi_percent"] is not None
    t = calc_tco(5_000_000, o["opex_annual"], 5)
    assert t["tco"] == round(5_000_000 + o["opex_annual"] * 5, 2)


def test_payback_undefined_when_effect_non_positive():
    p = calc_payback(1_000_000, 0)
    assert p["payback_years"] is None


def test_zero_effect_payback_and_scenario():
    p = calc_payback(2_000_000, 0)
    assert p["payback_years"] is None
    assert "эффект" in p["message"].lower() or "≤" in p["message"] or "<=" in p["message"]

    base = calculate_scenario(
        "purchase",
        peak_demand=10,
        productivity=50,
        unit_price=1_000_000,
        overrides={"current_labor_cost_year": 0, "labor_reduction_share": 0, "additional_revenue": 0},
    )
    assert base["annual_effect"]["annual_effect"] <= 0
    assert base["payback"]["payback_years"] is None


def test_negative_peak_raises():
    with pytest.raises(ValueError, match="отрицательн"):
        calc_robots_count(-1, 50)
    with pytest.raises(ValueError, match="отрицательн"):
        calculate_scenario("purchase", peak_demand=-10, productivity=50, unit_price=1_000_000)


def test_productivity_zero_raises():
    with pytest.raises(ValueError, match="Производительность"):
        calc_robots_count(100, 0)
    with pytest.raises(ValueError, match="Производительность"):
        calculate_scenario("purchase", peak_demand=100, productivity=0, unit_price=1_000_000)


def test_negative_price_raises():
    with pytest.raises(ValueError, match="отрицательн"):
        calculate_scenario("purchase", peak_demand=100, productivity=50, unit_price=-1)


def test_explain_robots_count_steps():
    expl = explain_robots_count(
        {"peak_demand": 100, "productivity": 50, "utilization": 0.85, "availability": 0.95, "reserve": 0.1}
    )
    assert expl["value"] == 4
    assert len(expl["steps"]) == 3
    assert expl["steps"][-1]["result"] == 4


def test_scenarios_baseline_purchase_raas():
    base = calculate_scenario("baseline", 200, 50, 2_000_000, overrides={"current_labor_cost_year": 10_000_000})
    assert base["robots_count"] == 0
    assert base["capex"]["capex"] == 0

    purch = calculate_scenario(
        "purchase",
        200,
        50,
        2_000_000,
        software_cost=100_000,
        maintenance_year=50_000,
        overrides={"current_labor_cost_year": 10_000_000, "labor_reduction_share": 0.5},
    )
    assert purch["robots_count"] > 0
    assert purch["capex"]["capex"] > 0

    raas = calculate_scenario(
        "raas",
        200,
        50,
        2_000_000,
        overrides={"current_labor_cost_year": 10_000_000, "raas_monthly_per_robot": 150_000},
    )
    assert raas["opex"]["opex_annual"] > 0
    assert raas["capex"]["capex"] < purch["capex"]["capex"]


def test_formulas_russian():
    f = get_formulas()
    assert "capex" in f
    assert "robots_count" in FORMULAS_RU
    assert "CAPEX" in f["capex"] or "оборудование" in f["capex"]
