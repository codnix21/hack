from app.services.economics import calc_irr, calc_npv, calc_payback_from_cashflows, calculate_scenario


def test_npv_and_payback_positive_project():
    r = calculate_scenario(
        "purchase",
        peak_demand=200,
        productivity=50,
        unit_price=1_500_000,
        maintenance_year=40_000,
        years=5,
        overrides={"current_labor_cost_year": 12_000_000, "labor_reduction_share": 0.55},
        assumptions={"discount_rate": 0.1, "charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert "npv" in r
    assert r["npv"]["npv"] is not None
    assert r["cashflows"]
    assert r["cashflows"][0]["cashflow"] < 0
    assert r["annual_effect"].get("gross_operating_effect") is not None
    assert r["annual_effect"].get("net_annual_effect") is not None
    assert "roi_percent" in r["roi"]


def test_payback_from_cashflows_undefined():
    p = calc_payback_from_cashflows([-1_000_000, -10_000, -10_000])
    assert p["payback_years"] is None


def test_irr_sign_change():
    irr = calc_irr([-100.0, 60.0, 60.0, 60.0])
    assert irr.get("irr") is not None
    no = calc_irr([-100.0, -10.0, -10.0])
    assert no.get("irr") is None


def test_npv_discount():
    n = calc_npv([-100.0, 60.0, 60.0], 0.1)
    assert n["npv"] != 0
