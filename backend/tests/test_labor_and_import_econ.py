"""Final Economic Validation: труд, импорт Excel, TCO, сопоставимость сценариев."""

from __future__ import annotations

import io

import pandas as pd

from app.services.economics import calculate_scenario
from app.services.import_catalog import import_project_params
from app.services.import_source_datasets import PARAM_ALIASES, base_params_dict, slugify_param
from app.services.labor_cost import resolve_current_labor_cost
from app.services.param_templates import resolve_param_key


def test_slugify_real_dataset_staff_aliases():
    assert slugify_param("Общая численность персонала склада") == "staff_count"
    assert slugify_param("  общая   численность персонала склада  ") == "staff_count"
    assert slugify_param("Средняя з/п отборщика (gross)") == "staff_salary_month"
    assert slugify_param("Коэффициент начислений на ФОТ (страховые взносы)") == "payroll_tax_coef"
    assert slugify_param("Количество рабочих смен в сутки") == "shifts_count"
    assert slugify_param("Объём отбора (строк/сутки, всего)") == "ops_count"
    # регистр / ё (в т.ч. приёмка/отгрузка из Датасеты_хакатон.xlsx)
    assert slugify_param("ОБЪЕМ ОТБОРА (СТРОК/СУТКИ, ВСЕГО)") == "ops_count"
    assert slugify_param("Объём приёмки (поддоны/сутки)") == "inbound_pallets_per_day"
    assert slugify_param("Объем отгрузки (поддоны/сутки)") == "outbound_pallets_per_day"


def test_param_template_russian_labels():
    assert resolve_param_key("Стоимость персонала") == "current_labor_cost_year"
    assert resolve_param_key("Общая численность персонала склада") == "staff_count"
    assert resolve_param_key("Пиковый спрос") == "peak_demand"


def test_labor_from_headcount_and_monthly_salary():
    r = resolve_current_labor_cost(
        {
            "staff_count": 180,
            "staff_salary_month": 100_000,
            "payroll_tax_coef": 1.302,
        },
        assumption_default=12_000_000,
    )
    expected = 180 * 100_000 * 12 * 1.302
    assert abs(r["current_labor_cost_year"] - expected) < 1
    assert r["labor_cost_origin"].startswith("derived:")


def test_labor_conflict_keeps_explicit_and_warns():
    r = resolve_current_labor_cost(
        {
            "current_labor_cost_year": 18_000_000,
            "staff_cost_year": 50_000_000,
            "staff_count": 180,
            "staff_salary_month": 100_000,
            "payroll_tax_coef": 1.302,
        }
    )
    assert r["current_labor_cost_year"] == 18_000_000
    assert any("Конфликт" in w for w in r["warnings"])


def test_empty_and_blank_import_values_skipped():
    df = pd.DataFrame(
        {
            "Параметр": ["Численность персонала", "Пиковый спрос", "Стоимость персонала"],
            "Значение": [180, "", None],
        }
    )
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    parsed = import_project_params(buf.getvalue(), "params.xlsx")
    params = parsed["object_params"]
    assert params.get("staff_count") == 180
    assert "peak_demand" not in params or params.get("peak_demand") not in ("", None)


def test_import_derives_labor_and_peak_with_warning():
    df = pd.DataFrame(
        {
            "Параметр": [
                "Общая численность персонала склада",
                "Средняя з/п отборщика (gross)",
                "Коэффициент начислений на ФОТ (страховые взносы)",
                "Количество рабочих смен в сутки",
                "Продолжительность смены",
                "Объём отбора (строк/сутки, всего)",
                "Пиковый коэффициент нагрузки",
            ],
            "Значение": [180, 100_000, 1.302, 2, 11, 100_000, 1.5],
        }
    )
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    parsed = import_project_params(buf.getvalue(), "wh.xlsx")
    p = parsed["object_params"]
    assert p["staff_count"] == 180
    assert p["current_labor_cost_year"] == round(180 * 100_000 * 12 * 1.302, 2)
    assert p.get("peak_demand")
    assert parsed.get("warnings")


def test_base_params_dict_from_dataset_aliases():
    class P:
        def __init__(self, key, base):
            self.key = key
            self.base = base

    params = [
        P("staff_count", 180),
        P("staff_salary_month", 100_000),
        P("payroll_tax_coef", 1.302),
        P("shifts_count", 2),
        P("shift_hours", 11),
        P("ops_count", 100_000),
        P("peak_factor", 1.5),
    ]
    out = base_params_dict(params)  # type: ignore[arg-type]
    assert out["current_labor_cost_year"] == round(180 * 100_000 * 12 * 1.302, 2)
    assert out["peak_demand"]


def test_tco_excludes_remaining_labor_but_reports_total_outlay():
    r = calculate_scenario(
        "purchase",
        peak_demand=200,
        productivity=50,
        unit_price=2_000_000,
        robots_count=3,
        years=5,
        overrides={"current_labor_cost_year": 18_000_000, "labor_reduction_share": 0.4},
        assumptions={"charging_station_cost": 0, "battery_cost_share": 0},
    )
    tco = r["tco"]
    assert tco["tco_scope"] == "robotics_only"
    rem = r["remaining_manual_labor_cost"]
    assert rem == 18_000_000 * 0.6
    assert abs(tco["total_outlay_with_remaining_labor"] - (tco["tco"] + rem * 5)) < 1
    assert "ручной" in (tco.get("tco_note") or "").lower()


def test_labor_reduction_marked_assumption_by_default():
    r = calculate_scenario(
        "purchase",
        peak_demand=100,
        productivity=40,
        unit_price=1_000_000,
        robots_count=2,
        overrides={"current_labor_cost_year": 10_000_000},
        assumptions={"charging_station_cost": 0, "battery_cost_share": 0},
    )
    assert r["annual_effect"]["labor_reduction_is_assumption"] is True
    assert r["assumption_flags"]["labor_reduction_share"] is True
    assert "ДОПУЩЕНИЕ" in (r["annual_effect"].get("note") or "").upper() or "допущение" in (
        r["annual_effect"].get("note") or ""
    )


def test_purchase_raas_comparable_basis_and_raas_no_roi():
    common = dict(
        peak_demand=200,
        productivity=50,
        unit_price=2_000_000,
        robots_count=4,
        years=5,
        overrides={"current_labor_cost_year": 18_000_000, "labor_reduction_share": 0.4},
        assumptions={"discount_rate": 0.12, "charging_station_cost": 0, "battery_cost_share": 0},
    )
    purchase = calculate_scenario("purchase", **common)
    raas = calculate_scenario("raas", **common)
    assert purchase["robots_count"] == raas["robots_count"] == 4
    assert purchase["inputs"]["years"] == raas["inputs"]["years"] == 5
    assert purchase["inputs"]["labor_reduction_share"] == raas["inputs"]["labor_reduction_share"]
    assert raas["roi"]["roi_percent"] is None
    assert raas["cost_comparison"]["raas_service_year"] is not None
    assert raas["cost_comparison"]["raas_service_year"] > 0
    assert purchase["cost_comparison"]["comparable_basis"]


def test_aliases_table_covers_staff_ops_keys():
    assert "общая численность персонала склада" in PARAM_ALIASES
    assert PARAM_ALIASES["стоимость персонала"] == "current_labor_cost_year"
