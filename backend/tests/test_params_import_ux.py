"""Импорт параметров объекта: preview / validate / форматы / ошибки."""

from __future__ import annotations

import io

import pandas as pd
import pytest
from fastapi import HTTPException

from app.services.import_catalog import (
    import_project_params,
    validate_project_params_import,
)
from app.services.uploads import validate_upload_bytes


def _xlsx(df: pd.DataFrame, sheet: str = "Параметры") -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=sheet)
    return buf.getvalue()


def test_import_russian_headers_key_value():
    df = pd.DataFrame(
        {
            "Параметр": ["Пиковый спрос", "Стоимость персонала", "Ширина площадки"],
            "Значение": [6818, 48_000_000, 80],
        }
    )
    parsed = import_project_params(_xlsx(df), "params.xlsx")
    p = parsed["object_params"]
    assert p["peak_demand"] == 6818
    assert p["current_labor_cost_year"] == 48_000_000
    assert p["area_width_m"] == 80
    assert parsed["mode"] == "key_value"


def test_import_english_headers_key_value():
    df = pd.DataFrame(
        {
            "Parameter": ["peak_demand", "staff_count", "current_labor_cost_year"],
            "Value": [200, 40, 12_000_000],
        }
    )
    parsed = import_project_params(_xlsx(df, "Sheet1"), "en.xlsx")
    p = parsed["object_params"]
    assert p["peak_demand"] == 200
    assert p["staff_count"] == 40


def test_import_yo_ye_normalization():
    df = pd.DataFrame(
        {
            "Параметр": ["Объём отбора (строк/сутки, всего)", "Объем отбора (строк/сутки, всего)"],
            "Значение": [100_000, 110_000],
        }
    )
    parsed = import_project_params(_xlsx(df), "yo.xlsx")
    p = parsed["object_params"]
    # ё/е в «Объём/Объем» нормализуются в один ключ ops_count
    assert p.get("ops_count") == 110_000


def test_import_missing_columns_still_parses_known():
    df = pd.DataFrame({"Параметр": ["Пиковый спрос"], "Значение": [100]})
    parsed = import_project_params(_xlsx(df), "partial.xlsx")
    assert parsed["object_params"]["peak_demand"] == 100


def test_import_unknown_columns_wide_row():
    df = pd.DataFrame([{"peak_demand": 150, "mystery_col": 1, "foo_bar": 2}])
    parsed = import_project_params(
        _xlsx(df, "Sheet1"),
        "wide.xlsx",
        mapping={"peak_demand": "peak_demand", "mystery_col": "ignore", "foo_bar": "ignore"},
    )
    assert parsed["object_params"]["peak_demand"] == 150
    assert "mystery_col" not in parsed["object_params"]


def test_import_duplicate_param_labels_last_wins():
    df = pd.DataFrame(
        {
            "Параметр": ["Пиковый спрос", "Пиковый спрос"],
            "Значение": [100, 200],
        }
    )
    parsed = import_project_params(_xlsx(df), "dup.xlsx")
    assert parsed["object_params"]["peak_demand"] == 200


def test_import_invalid_numeric_skipped_or_coerced():
    df = pd.DataFrame(
        {
            "Параметр": ["Пиковый спрос", "Численность персонала"],
            "Значение": ["не число", 40],
        }
    )
    parsed = import_project_params(_xlsx(df), "badnum.xlsx")
    # coerce может дать None/строку — главное staff_count ок и нет падения
    assert parsed["object_params"].get("staff_count") == 40


def test_import_empty_file():
    df = pd.DataFrame({"Параметр": [], "Значение": []})
    parsed = import_project_params(_xlsx(df), "empty.xlsx")
    assert parsed.get("errors") or parsed.get("object_params") == {}


def test_import_corrupt_bytes():
    parsed = import_project_params(b"not-an-excel", "broken.xlsx")
    assert parsed.get("errors")


def test_import_unsupported_extension_upload():
    with pytest.raises(HTTPException) as ei:
        validate_upload_bytes("plan.dwg", b"x" * 100)
    assert ei.value.status_code == 400


def test_import_too_large_upload():
    with pytest.raises(HTTPException) as ei:
        validate_upload_bytes("big.xlsx", b"x" * (11 * 1024 * 1024))
    assert ei.value.status_code == 400
    assert "больш" in ei.value.detail.lower()


def test_validate_params_does_not_require_robot_name():
    df = pd.DataFrame(
        {
            "Параметр": ["Пиковый спрос", "Стоимость персонала"],
            "Значение": [500, 10_000_000],
        }
    )
    content = _xlsx(df)
    v = validate_project_params_import(content, "ok.xlsx", existing_params={})
    assert v["valid"] is True
    assert not any("name" in e.lower() and "обязатель" in e.lower() for e in v.get("errors") or [])


def test_validate_reports_overwrite():
    df = pd.DataFrame(
        {"Параметр": ["Пиковый спрос"], "Значение": [999]}
    )
    content = _xlsx(df)
    v = validate_project_params_import(
        content, "ow.xlsx", existing_params={"peak_demand": 100}
    )
    assert "peak_demand" in v["will_overwrite"]
    assert v["valid"] is True


def test_validate_empty_invalid():
    df = pd.DataFrame({"Параметр": [], "Значение": []})
    v = validate_project_params_import(_xlsx(df), "e.xlsx")
    assert v["valid"] is False


def test_validate_warns_monthly_labor_as_yearly():
    df = pd.DataFrame(
        {
            "Параметр": ["Стоимость персонала"],
            "Значение": [120_000],  # похоже на ₽/мес, не ₽/год
        }
    )
    v = validate_project_params_import(_xlsx(df), "unit.xlsx")
    assert v["valid"] is True
    assert any("месяц" in w.lower() or "₽/год" in w for w in v.get("warnings") or [])


def test_wide_excel_manual_mapping():
    """Широкая таблица без колонок Параметр/Значение — mapping обязателен."""
    df = pd.DataFrame(
        [
            {
                "Peak ops": 300,
                "Labor year": 20_000_000,
                "Mystery": 1,
            }
        ]
    )
    content = _xlsx(df, "Sheet1")
    mapping = {
        "Peak ops": "peak_demand",
        "Labor year": "current_labor_cost_year",
        "Mystery": "ignore",
    }
    parsed = import_project_params(content, "wide.xlsx", mapping=mapping)
    assert parsed["mode"] == "wide_row"
    assert parsed["object_params"]["peak_demand"] == 300
    assert parsed["object_params"]["current_labor_cost_year"] == 20_000_000
    assert "Mystery" not in parsed["object_params"]
    v = validate_project_params_import(content, "wide.xlsx", mapping=mapping)
    assert v["valid"] is True
    assert "Mystery" in (v.get("unmapped_columns") or [])
