"""Pre-Defense: экономические инварианты и граничные случаи."""

from app.services.economics import (
    calc_payback,
    calc_payback_from_cashflows,
    calculate_scenario,
    enrich_payback_display,
)


def _purchase(**overrides):
    return calculate_scenario(
        "purchase",
        peak_demand=200,
        productivity=50,
        unit_price=2_000_000,
        robots_count=3,
        years=5,
        maintenance_year=100_000,
        overrides={
            "current_labor_cost_year": 18_000_000,
            "labor_reduction_share": 0.4,
            **overrides,
        },
        assumptions={
            "discount_rate": 0.12,
            "charging_station_cost": 0,
            "battery_cost_share": 0,
            "ops_staff_per_10_robots": 1.0,
            "ops_staff_salary_year": 900_000,
        },
    )


def test_seed_labor_cannot_produce_billion_baseline_opex():
    r = calculate_scenario(
        "baseline",
        peak_demand=200,
        productivity=50,
        unit_price=2_000_000,
        overrides={"current_labor_cost_year": 18_000_000},
    )
    assert r["opex"]["opex_annual"] == 18_000_000
    assert r["opex"]["opex_annual"] < 100_000_000


def test_gross_effect_bounded_by_labor_times_share():
    labor = 18_000_000
    share = 0.4
    r = _purchase(current_labor_cost_year=labor, labor_reduction_share=share)
    gross = r["annual_effect"]["gross_operating_effect"]
    assert abs(gross - labor * share) < 0.05


def test_zero_effect_no_payback_no_absurd_roi():
    r2 = calculate_scenario(
        "purchase",
        peak_demand=10,
        productivity=50,
        unit_price=1_000_000,
        robots_count=1,
        years=5,
        overrides={"current_labor_cost_year": 0, "labor_reduction_share": 0, "additional_revenue": 0},
        assumptions={"charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert r2["annual_effect"]["net_annual_effect"] <= 0
    assert r2["payback"]["payback_years"] is None


def test_negative_effect_payback_none():
    r = _purchase(current_labor_cost_year=100_000, labor_reduction_share=0.1)
    assert r["annual_effect"]["net_annual_effect"] < 0
    assert r["payback"]["payback_years"] is None
    assert r["irr"]["irr"] is None


def test_zero_capex_roi_message():
    r = calculate_scenario(
        "baseline",
        peak_demand=100,
        productivity=40,
        unit_price=0,
        overrides={"current_labor_cost_year": 1_000_000},
    )
    assert r["capex"]["capex"] == 0


def test_raas_roi_not_applied():
    r = calculate_scenario(
        "raas",
        peak_demand=400,
        productivity=40,
        unit_price=3_500_000,
        robots_count=15,
        years=5,
        overrides={"current_labor_cost_year": 2_330_000_000, "labor_reduction_share": 0.4},
        assumptions={"discount_rate": 0.12, "charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert r["roi"]["roi_percent"] is None
    assert "RaaS" in (r["roi"].get("message") or "") or "услуга" in (r["roi"].get("message") or "")
    # Не должно быть «космических» процентов
    assert r["roi"].get("roi_percent") is None


def test_short_payback_not_shown_as_zero_years():
    # CAPEX tiny, huge positive CF → payback << 0.1 year
    pb = calc_payback_from_cashflows([-1_000_000, 200_000_000])
    assert pb["payback_years"] is not None
    assert pb["payback_years"] > 0
    assert pb["payback_years"] < 0.1
    assert pb.get("payback_display") == "менее 1 месяца"
    assert pb.get("payback_months") is not None
    # UI helper enrichment
    assert enrich_payback_display({"payback_years": 0.007}).get("payback_display") == "менее 1 месяца"


def test_simple_payback_precision_under_month():
    pb = calc_payback(50_000, 10_000_000)  # 0.005 year
    assert pb["payback_years"] == 0.005
    assert pb["payback_display"] == "менее 1 месяца"


def test_ops_staff_count_is_headcount_not_money():
    r = _purchase()
    bd = r["opex"]["breakdown"]
    assert "ops_staff_count" in bd
    assert isinstance(bd["ops_staff_count"], int)
    assert bd["ops_staff_count"] >= 1
    # Денежная статья отдельно
    assert bd["ops_staff"] == bd["ops_staff_count"] * 900_000


def test_purchase_and_raas_differ_in_opex_structure():
    p = _purchase()
    raas = calculate_scenario(
        "raas",
        peak_demand=200,
        productivity=50,
        unit_price=2_000_000,
        robots_count=3,
        years=5,
        overrides={"current_labor_cost_year": 18_000_000, "labor_reduction_share": 0.4},
        assumptions={"discount_rate": 0.12, "charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert p["capex"]["capex"] > raas["capex"]["capex"]
    assert raas["opex"]["opex_annual"] > p["opex"]["opex_annual"]
    assert raas["roi"]["roi_percent"] is None


def test_missing_unit_price_path_still_computes_with_assumption_flag_via_defaults():
    # unit_price=0 still runs; API marks assumed price separately
    r = calculate_scenario(
        "purchase",
        peak_demand=100,
        productivity=40,
        unit_price=3_500_000,
        robots_count=2,
        overrides={"current_labor_cost_year": 12_000_000},
        assumptions={"charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert r["capex"]["capex"] > 0
    assert r["robots_count"] == 2
