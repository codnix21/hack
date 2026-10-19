"""Final TЗ Compliance: три сценария, чувствительность к 3 параметрам, роли."""

from __future__ import annotations

from app.services.economics import DEFAULT_ASSUMPTIONS, calculate_scenario, sensitivity_analysis


def _base_kwargs(**extra):
    kw = {
        "scenario": "purchase",
        "peak_demand": 200.0,
        "productivity": 50.0,
        "unit_price": 4_500_000.0,
        "software_cost": 0.0,
        "maintenance_year": 0.0,
        "implementation_cost": 0.0,
        "robots_count": 8,
        "utilization": 0.85,
        "availability": 0.95,
        "reserve": 0.10,
        "years": 5,
        "assumptions": {**DEFAULT_ASSUMPTIONS, "discount_rate": 0.12},
        "overrides": {
            "current_labor_cost_year": 18_000_000.0,
            "labor_reduction_share": 0.4,
        },
    }
    kw.update(extra)
    return kw


def test_three_scenarios_have_distinct_economics():
    labor = 18_000_000.0
    base = calculate_scenario(**{**_base_kwargs(), "scenario": "baseline"})
    purchase = calculate_scenario(**{**_base_kwargs(), "scenario": "purchase"})
    raas = calculate_scenario(**{**_base_kwargs(), "scenario": "raas"})

    assert base["scenario"] == "baseline"
    assert purchase["scenario"] == "purchase"
    assert raas["scenario"] == "raas"

    assert base["capex"]["capex"] == 0
    assert purchase["capex"]["capex"] > 0
    assert raas["capex"]["capex"] >= 0
    # RaaS: стартовый CAPEX существенно ниже покупки при том же N
    assert raas["capex"]["capex"] < purchase["capex"]["capex"]
    assert base["opex"]["opex_annual"] == labor
    assert purchase["opex"]["opex_annual"] != base["opex"]["opex_annual"]
    assert raas["opex"]["opex_annual"] != purchase["opex"]["opex_annual"]
    assert base["annual_effect"]["annual_effect"] == 0
    assert purchase["annual_effect"]["annual_effect"] != 0
    assert raas["roi"].get("roi_percent") is None  # не сопоставим с покупкой


def test_sensitivity_tz_three_parameters_recalculate():
    """3.5.6: оборудование, объём операций, стоимость труда — меняют результат."""
    base = _base_kwargs()
    price_rows = sensitivity_analysis(base, "unit_price", [3_000_000, 4_500_000, 6_000_000])["rows"]
    peak_rows = sensitivity_analysis(base, "peak_demand", [100, 200, 400])["rows"]
    labor_rows = sensitivity_analysis(
        base, "current_labor_cost_year", [10_000_000, 18_000_000, 30_000_000]
    )["rows"]

    assert price_rows[0]["capex"] < price_rows[-1]["capex"]
    # при фиксированном robots_count пик не меняет CAPEX, но меняет покрытие — эффект тот же;
    # без фикса N пик меняет число роботов. Здесь N фиксирован — проверяем что API отдаёт разные value
    assert {r["value"] for r in peak_rows} == {100, 200, 400}
    # труд меняет годовой эффект
    assert labor_rows[0]["annual_effect"] < labor_rows[-1]["annual_effect"]

    # без фикса N пик меняет robots_count
    free = _base_kwargs()
    free["robots_count"] = None
    peak_free = sensitivity_analysis(free, "peak_demand", [100, 800])["rows"]
    assert peak_free[0]["robots_count"] < peak_free[-1]["robots_count"]
