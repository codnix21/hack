"""Регрессии финальной приёмки: окупаемость, IRR, отсутствие двойного CAPEX."""

from app.services.economics import calc_irr, calc_payback, calculate_scenario


def test_negative_effect_has_no_positive_payback():
    r = calculate_scenario(
        "purchase",
        peak_demand=10,
        productivity=50,
        unit_price=5_000_000,
        robots_count=8,
        maintenance_year=200_000,
        years=5,
        overrides={"current_labor_cost_year": 100_000, "labor_reduction_share": 0.1},
        assumptions={"discount_rate": 0.12, "charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert r["annual_effect"]["net_annual_effect"] <= 0
    assert r["payback"]["payback_years"] is None
    assert r["irr"]["irr"] is None


def test_capex_only_in_year_zero_cashflow():
    r = calculate_scenario(
        "purchase",
        peak_demand=200,
        productivity=50,
        unit_price=1_000_000,
        robots_count=2,
        years=3,
        overrides={"current_labor_cost_year": 8_000_000, "labor_reduction_share": 0.5},
        assumptions={"discount_rate": 0.1, "charging_station_cost": 0, "battery_cost_share": 0},
    )
    capex = r["capex"]["capex"]
    assert r["cashflows"][0]["cashflow"] == -capex
    # CAPEX не вычитается повторно из годового эффекта
    for row in r["cashflows"][1:]:
        assert abs(row["cashflow"] - r["annual_effect"]["net_annual_effect"]) < 0.02


def test_gross_minus_opex_equals_net():
    r = calculate_scenario(
        "purchase",
        peak_demand=150,
        productivity=40,
        unit_price=2_000_000,
        robots_count=3,
        years=5,
        overrides={"current_labor_cost_year": 10_000_000, "labor_reduction_share": 0.4},
        assumptions={"charging_station_cost": 0, "battery_cost_share": 0},
    )
    gross = r["annual_effect"]["gross_operating_effect"]
    net = r["annual_effect"]["net_annual_effect"]
    opex = r["opex"]["opex_annual"]
    assert abs(gross - opex - net) < 0.05


def test_simple_payback_rejects_non_positive_effect():
    assert calc_payback(1_000_000, 0)["payback_years"] is None
    assert calc_payback(1_000_000, -100)["payback_years"] is None


def test_irr_requires_sign_change():
    assert calc_irr([-50.0, -10.0, -10.0]).get("irr") is None
    assert calc_irr([-100.0, 40.0, 40.0, 40.0]).get("irr") is not None
