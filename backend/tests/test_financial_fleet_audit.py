"""Final Financial & Fleet Capacity Audit: CAPEX decomposition, fleet vs peak, finances."""

from __future__ import annotations

import math

from app.services.economics import (
    DEFAULT_ASSUMPTIONS,
    assess_fleet_vs_peak,
    calc_capex,
    calc_irr,
    calc_npv,
    calc_robots_count,
    calculate_scenario,
)
from app.services.labor_cost import resolve_current_labor_cost
from app.services.matching import match_robot_to_project


def test_capex_breakdown_sums_to_total_control_case():
    """8 × 4.5M + доли + зарядка = 53_367_600; сумма статей = CAPEX."""
    n, unit = 8, 4_500_000.0
    equipment = unit * n
    a = DEFAULT_ASSUMPTIONS
    info = calc_capex(equipment=equipment, software=0.0, robots_count=n, assumptions=a)
    stations = max(1, math.ceil(n / 3))
    station_cost = a["charging_station_cost"] * stations
    total = round(info["capex"] + station_cost, 2)
    bd = {**info["breakdown"], "charging_stations": station_cost}
    assert abs(sum(bd.values()) - total) < 0.02
    assert total == 53_367_600.0
    # Роботы 36M; остаток — не «скрытая наценка», а явные статьи-допущения
    assert bd["equipment"] == 36_000_000.0
    assert bd["infrastructure"] == 5_400_000.0  # 15%
    assert bd["integration"] == 4_320_000.0  # 12%
    assert bd["commissioning"] == 1_800_000.0  # 5%
    assert bd["training"] == 1_200_000.0
    assert bd["contingency"] == 3_897_600.0
    assert bd["charging_stations"] == 750_000.0
    for key in ("infrastructure", "integration", "commissioning", "training", "contingency"):
        assert info["component_sources"][key]["origin"] == "model_assumption"


def test_scenario_capex_breakdown_matches_total():
    r = calculate_scenario(
        scenario="purchase",
        peak_demand=200,
        productivity=50,
        unit_price=4_500_000,
        robots_count=8,
        years=5,
        overrides={"current_labor_cost_year": 12_000_000, "labor_reduction_share": 0.4},
    )
    assert r["capex"]["breakdown_matches_total"] is True
    assert abs(sum(r["capex"]["breakdown"].values()) - r["capex"]["capex"]) < 0.02
    assert "charging_stations" in r["capex"]["breakdown"]
    assert r["capex"]["component_sources"]["charging_stations"]["origin"] == "model_assumption"


def test_fleet_eight_robots_insufficient_for_dataset_peak():
    """При 6818 оп/ч и 120 оп/ч на робота 8 шт. не покрывают пик (~79 нужно)."""
    peak, prod = 6818.18, 120.0
    need = calc_robots_count(peak, prod, 0.85, 0.95, 0.10)
    assert need["robots_count"] == 79
    r = calculate_scenario(
        scenario="purchase",
        peak_demand=peak,
        productivity=prod,
        unit_price=4_500_000,
        robots_count=8,
        years=5,
        assumptions={**DEFAULT_ASSUMPTIONS, "peak_is_estimate": True},
        overrides={
            "current_labor_cost_year": 281_232_000,
            "labor_reduction_share": 0.4,
            "peak_is_estimate": True,
        },
    )
    fc = r["fleet_capacity"]
    assert fc["selected_robots"] == 8
    assert fc["recommended_robots"] == 79
    assert fc["meets_peak_demand"] is False
    assert fc["peak_coverage"] is not None and fc["peak_coverage"] < 0.15
    assert any("не является подтверждённой" in w for w in r["model_warnings"])
    assert any("оценка" in w.lower() or "оценён" in w.lower() or "оценка" in " ".join(r["model_warnings"]).lower()
               for w in r["model_warnings"]) or fc["peak_is_estimate"]


def test_robots_count_without_productivity_warns():
    fc = assess_fleet_vs_peak(
        selected_robots=8,
        recommended_robots=0,
        peak_demand=1000,
        productivity=0,
        utilization=0.85,
        availability=0.95,
        robots_count_overridden=True,
    )
    assert any("не задана" in w for w in fc["warnings"])


def test_labor_fot_no_double_payroll():
    expected = 180 * 100_000 * 12 * 1.302
    r = resolve_current_labor_cost(
        {"staff_count": 180, "staff_salary_month": 100_000, "payroll_tax_coef": 1.302}
    )
    assert abs(r["current_labor_cost_year"] - expected) < 1
    # Не умножать годовую сумму ещё раз
    r2 = resolve_current_labor_cost({"current_labor_cost_year": expected, "payroll_tax_coef": 1.302})
    assert abs(r2["current_labor_cost_year"] - expected) < 1


def test_control_effect_opex_tco_npv():
    labor = 281_232_000.0
    r = calculate_scenario(
        scenario="purchase",
        peak_demand=6818.18,
        productivity=120,
        unit_price=4_500_000,
        software_cost=0,
        maintenance_year=0,
        robots_count=8,
        years=5,
        assumptions={**DEFAULT_ASSUMPTIONS, "discount_rate": 0.12},
        overrides={"current_labor_cost_year": labor, "labor_reduction_share": 0.4},
    )
    assert abs(r["annual_effect"]["components"]["current_cost_reduction"] - 112_492_800) < 1
    assert abs(r["opex"]["opex_annual"] - 3_132_000) < 1
    assert abs(r["annual_effect"]["annual_effect"] - 109_360_800) < 1
    assert abs(r["capex"]["capex"] - 53_367_600) < 1
    assert abs(r["tco"]["tco"] - 69_027_600) < 1
    assert abs(r["tco"]["total_outlay_with_remaining_labor"] - 912_723_600) < 1
    assert abs(r["npv"]["npv"] - 338_108_171.21) < 1
    assert r["tco"]["tco_scope"] == "robotics_only"
    assert r["cashflows"][0]["cashflow"] == -53_367_600


def test_irr_undefined_when_no_sign_change():
    # Все CF неотрицательны после CF0? Нужен поток без смены знака
    out = calc_irr([100.0, 100.0, 100.0])
    assert out["irr"] is None
    assert "не меняет знак" in (out.get("message") or "")


def test_npv_discount_rate_applied():
    cfs = [-1000.0, 600.0, 600.0]
    n = calc_npv(cfs, 0.12)
    expected = -1000 + 600 / 1.12 + 600 / (1.12**2)
    assert abs(n["npv"] - round(expected, 2)) < 0.02
    assert n["discount_rate"] == 0.12


def test_missing_robot_traits_do_not_fake_perfect_score():
    from types import SimpleNamespace

    robot = SimpleNamespace(
        id=1,
        payload_kg=500,
        width_mm=800,
        productivity_ops_per_hour=None,
        price_rub=None,
        speed_mps=None,
        autonomy_hours=None,
        navigation="SLAM",
        supported_processes=["transport"],
        industry_raw="логистика",
        scenario_raw="склад",
        operating_conditions={
            "object_types": ["warehouse"],
            "temperature_min_c": 0,
            "temperature_max_c": 40,
            "humidity_max_pct": 90,
            "indoor": True,
            "floor_types": ["бетон"],
        },
        archived=False,
    )
    match = match_robot_to_project(
        robot,
        {"required_payload_kg": 100, "aisle_width_mm": 2000, "peak_demand": 200, "indoor": True},
        "warehouse",
    )
    assert match.get("missing_checks")
    assert "productivity_ops_per_hour" in match["missing_checks"] or any(
        "производительность" in str(x).lower() for x in match.get("missing_checks", [])
    )
    score = float(match.get("match_score") or 0)
    assert score < 100
    # При неполных ТТХ не должно быть «идеального» балла
    assert score <= 100 - 10 * min(len(match["missing_checks"]), 6)
