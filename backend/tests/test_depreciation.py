"""TZ-08: линейная амортизация CAPEX и инварианты денежной модели."""

from __future__ import annotations

import pytest

from app.services.depreciation import (
    DepreciationError,
    accounting_annual_effect,
    calc_straight_line_depreciation,
)
from app.services.economics import calculate_scenario


def test_straight_line_basic():
    d = calc_straight_line_depreciation(1_000_000, 5, salvage_value=0, horizon_years=5)
    assert d["applicable"] is True
    assert d["annual_depreciation"] == 200_000.0
    assert d["is_cash_outflow"] is False
    assert len(d["schedule"]) == 5
    assert sum(r["amount"] for r in d["schedule"]) == 1_000_000.0


def test_zero_or_negative_life():
    d0 = calc_straight_line_depreciation(1_000_000, 0)
    assert d0["applicable"] is False
    assert d0["annual_depreciation"] is None
    d_neg = calc_straight_line_depreciation(1_000_000, -3)
    assert d_neg["applicable"] is False


def test_zero_base():
    d = calc_straight_line_depreciation(0, 5)
    assert d["applicable"] is True
    assert d["annual_depreciation"] == 0.0
    assert all(r["amount"] == 0 for r in d["schedule"])


def test_salvage_value():
    d = calc_straight_line_depreciation(1_000_000, 4, salvage_value=200_000, horizon_years=4)
    assert d["annual_depreciation"] == 200_000.0
    assert abs(sum(r["amount"] for r in d["schedule"]) - 800_000.0) < 0.02


def test_salvage_exceeds_base():
    with pytest.raises(DepreciationError):
        calc_straight_line_depreciation(100, 5, salvage_value=150)


def test_horizon_longer_than_life():
    d = calc_straight_line_depreciation(300_000, 3, horizon_years=5)
    assert [r["amount"] for r in d["schedule"]] == [100_000.0, 100_000.0, 100_000.0, 0.0, 0.0]


def test_rounding_to_kopecks():
    d = calc_straight_line_depreciation(100, 3, horizon_years=3)
    assert d["annual_depreciation"] == round(100 / 3, 2)
    assert abs(sum(r["amount"] for r in d["schedule"]) - 100.0) < 0.02


def test_disabled():
    d = calc_straight_line_depreciation(1_000_000, 5, enabled=False)
    assert d["applicable"] is False
    assert d["annual_depreciation"] is None


def test_accounting_effect_helper():
    a = accounting_annual_effect(16_068_000, 10_673_520)
    assert a["with_depreciation"] == 5_394_480.0


def _control_purchase(**extra_overrides):
    overrides = {
        "current_labor_cost_year": 48_000_000,
        "labor_reduction_share": 0.4,
        **extra_overrides,
    }
    return calculate_scenario(
        "purchase",
        peak_demand=6818.18,
        productivity=120,
        unit_price=4_500_000,
        robots_count=8,
        years=5,
        overrides=overrides,
    )


def test_control_scenario_cash_metrics_unchanged():
    r = _control_purchase()
    assert abs(r["capex"]["capex"] - 53_367_600) < 1
    assert abs(r["annual_effect"]["annual_effect"] - 16_068_000) < 1
    # Контрольный payback 3.44 — по накопленным CF (с заменой АКБ в год 4)
    assert abs(float(r["payback"]["payback_years"]) - 3.44) < 0.02
    assert abs(float(r["payback"]["simple_payback_years"]) - round(53_367_600 / 16_068_000, 2)) < 0.02
    # амортизация есть, но не в CF
    assert r["depreciation"]["applicable"] is True
    assert r["depreciation"]["annual_depreciation"] == round(53_367_600 / 5, 2)
    assert abs(r["annual_effect"]["with_depreciation"] - (16_068_000 - 53_367_600 / 5)) < 1
    for row in r["cashflows"]:
        if row["year"] >= 1:
            # CF = net effect (без вычета амортизации); год АКБ может отличаться
            if row["year"] != int(r["assumptions"].get("battery_cycle_years") or -1):
                assert abs(row["cashflow"] - 16_068_000) < 1


def test_depreciation_not_in_opex_or_cf():
    r = _control_purchase()
    opex_bd = r["opex"]["breakdown"]
    assert "depreciation" not in opex_bd
    assert "amortization" not in opex_bd
    dep = r["depreciation"]["annual_depreciation"]
    net = r["annual_effect"]["annual_effect"]
    # ни один денежный CF не равен accounting-эффекту (нет двойного учёта)
    cfs = [row["cashflow"] for row in r["cashflows"] if row["year"] >= 1]
    assert not any(abs(cf - (net - dep)) < 1 for cf in cfs)
    # год без замены АКБ совпадает с денежным эффектом
    batt = int(r["assumptions"].get("battery_cycle_years") or 0)
    for row in r["cashflows"]:
        if row["year"] >= 1 and row["year"] != batt:
            assert abs(row["cashflow"] - net) < 1
        if row["year"] >= 1:
            assert row.get("depreciation_accounting") == dep


def test_raas_depreciates_only_owned_capex():
    common = dict(
        peak_demand=6818.18,
        productivity=120,
        unit_price=4_500_000,
        robots_count=8,
        years=5,
        overrides={"current_labor_cost_year": 48_000_000, "labor_reduction_share": 0.4},
    )
    purchase = calculate_scenario("purchase", **common)
    raas = calculate_scenario("raas", **common)
    assert raas["capex"]["capex"] < purchase["capex"]["capex"]
    assert raas["depreciation"]["applicable"] is True
    assert raas["depreciation"]["depreciable_base"] == raas["capex"]["capex"]
    assert "RaaS" in (raas["depreciation"].get("asset_label") or "")
    # база RaaS ≠ цена всего парка
    assert raas["depreciation"]["depreciable_base"] < 4_500_000 * 8


def test_baseline_no_depreciation():
    r = calculate_scenario(
        "baseline",
        peak_demand=100,
        productivity=50,
        unit_price=1_000_000,
        overrides={"current_labor_cost_year": 10_000_000},
    )
    assert r["depreciation"]["applicable"] is False
    assert r["annual_effect"]["with_depreciation"] is None


def test_disabled_keeps_control_and_null_accounting():
    r = _control_purchase(depreciation_enabled=False)
    assert abs(r["capex"]["capex"] - 53_367_600) < 1
    assert abs(r["annual_effect"]["annual_effect"] - 16_068_000) < 1
    assert r["depreciation"]["applicable"] is False
    assert r["annual_effect"]["with_depreciation"] is None


def test_api_calculate_includes_depreciation(client):
    token = client.post("/api/auth/guest-continue").json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    types = client.get("/api/catalog/meta/object-types", headers=h).json()
    ot = next((t for t in types if t.get("code") == "warehouse"), types[0])
    project = client.post(
        "/api/projects",
        headers=h,
        json={
            "name": "Dep API",
            "object_type_id": ot["id"],
            "object_params": {
                "peak_demand": 6818.18,
                "current_labor_cost_year": 48_000_000,
                "labor_reduction_share": 0.4,
                "unit_price": 4_500_000,
            },
        },
    ).json()
    calc = client.post(
        f"/api/economics/{project['id']}/calculate",
        headers=h,
        json={
            "scenario": "purchase",
            "robots_count": 8,
            "productivity": 120,
            "years": 5,
        },
    )
    assert calc.status_code == 200, calc.text
    body = calc.json()
    results = body.get("results") or body
    assert results["depreciation"]["applicable"] is True
    assert results["depreciation"]["annual_depreciation"] is not None
    assert results["annual_effect"]["with_depreciation"] is not None
    # денежный KPI не подменён accounting-версией
    assert results["annual_effect"]["annual_effect"] != results["annual_effect"]["with_depreciation"]
