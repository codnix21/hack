"""Импорт каталога роботов из CSV/Excel с маппингом колонок."""

from __future__ import annotations

import io
from typing import Any, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.models.manufacturer import Manufacturer
from app.models.catalog_meta import SolutionType
from app.models.robot import Robot
from app.models.user import utcnow
from app.services.param_templates import normalize_param_value, resolve_param_key

CANONICAL_FIELDS = {
    "name": "Название",
    "manufacturer": "Производитель",
    "solution_type": "Тип решения",
    "purpose": "Назначение",
    "country": "Страна",
    "payload_kg": "Грузоподъёмность, кг",
    "length_mm": "Длина, мм",
    "width_mm": "Ширина, мм",
    "height_mm": "Высота, мм",
    "speed_mps": "Скорость, м/с",
    "productivity_ops_per_hour": "Производительность, оп/ч",
    "autonomy_hours": "Автономность, ч",
    "positioning_accuracy_mm": "Точность позиционирования, мм",
    "navigation": "Навигация",
    "price_rub": "Цена, руб",
    "software_cost_rub": "Стоимость ПО, руб",
    "implementation_cost_rub": "Стоимость внедрения, руб",
    "maintenance_cost_year_rub": "ТО в год, руб",
    "service_life_years": "Срок службы, лет",
    "acquisition_model": "Модель приобретения",
    "source": "Источник",
    "source_url": "URL источника",
    "confirmation_level": "Уровень подтверждения",
}


FLOAT_FIELDS = {
    "payload_kg",
    "length_mm",
    "width_mm",
    "height_mm",
    "speed_mps",
    "productivity_ops_per_hour",
    "autonomy_hours",
    "positioning_accuracy_mm",
    "price_rub",
    "software_cost_rub",
    "implementation_cost_rub",
    "maintenance_cost_year_rub",
    "service_life_years",
}


def read_tabular(content: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    bio = io.BytesIO(content)
    if name.endswith(".csv"):
        for enc in ("utf-8-sig", "utf-8", "cp1251"):
            try:
                bio.seek(0)
                return pd.read_csv(bio, encoding=enc)
            except Exception:
                continue
        bio.seek(0)
        return pd.read_csv(bio)
    if name.endswith((".xlsx", ".xls")):
        xl = pd.ExcelFile(bio)
        sheet = "Параметры" if "Параметры" in xl.sheet_names else xl.sheet_names[0]
        return pd.read_excel(xl, sheet_name=sheet)
    raise ValueError("Поддерживаются только CSV и Excel (.xlsx)")


def preview_import(content: bytes, filename: str, limit: int = 20) -> dict[str, Any]:
    df = read_tabular(content, filename)
    columns = [str(c) for c in df.columns.tolist()]
    suggested = suggest_mapping(columns)
    sample = df.head(limit).fillna("").astype(str).to_dict(orient="records")
    return {
        "columns": columns,
        "suggested_mapping": suggested,
        "canonical_fields": CANONICAL_FIELDS,
        "row_count": len(df),
        "preview": sample,
    }


def suggest_mapping(columns: list[str]) -> dict[str, str]:
    """Map file column -> canonical field."""
    mapping: dict[str, str] = {}
    aliases = {
        "name": ["name", "название", "модель", "robot", "робот"],
        "manufacturer": ["manufacturer", "производитель", "vendor", "бренд"],
        "solution_type": ["solution_type", "тип", "type", "категория"],
        "purpose": ["purpose", "назначение", "application"],
        "country": ["country", "страна"],
        "payload_kg": ["payload", "payload_kg", "грузоподъемность", "грузоподъёмность", "нагрузка"],
        "length_mm": ["length", "length_mm", "длина"],
        "width_mm": ["width", "width_mm", "ширина"],
        "height_mm": ["height", "height_mm", "высота"],
        "speed_mps": ["speed", "speed_mps", "скорость"],
        "productivity_ops_per_hour": ["productivity", "производительность", "ops"],
        "price_rub": ["price", "price_rub", "цена", "стоимость"],
        "navigation": ["navigation", "навигация"],
        "source": ["source", "источник"],
        "source_url": ["source_url", "url", "ссылка"],
    }
    lower_cols = {c: c.lower().strip() for c in columns}
    for field, keys in aliases.items():
        for col, low in lower_cols.items():
            if any(k in low for k in keys):
                mapping[col] = field
                break
    return mapping


def _to_float(val) -> Optional[float]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, str) and not val.strip():
        return None
    try:
        return float(str(val).replace(",", ".").replace(" ", ""))
    except (TypeError, ValueError):
        return None


def _get_or_create_manufacturer(db: Session, name: str) -> Optional[Manufacturer]:
    if not name or not str(name).strip():
        return None
    name = str(name).strip()
    m = db.query(Manufacturer).filter(Manufacturer.name == name).first()
    if m:
        return m
    m = Manufacturer(name=name, country=None)
    db.add(m)
    db.flush()
    return m


def _resolve_solution_type(db: Session, value: str) -> Optional[int]:
    if not value or not str(value).strip():
        return None
    v = str(value).strip()
    st = db.query(SolutionType).filter(
        (SolutionType.code == v.lower()) | (SolutionType.name_ru == v)
    ).first()
    if st:
        return st.id
    # try partial
    st = db.query(SolutionType).filter(SolutionType.code.ilike(f"%{v.lower()}%")).first()
    return st.id if st else None


def validate_mapped_rows(df: pd.DataFrame, mapping: dict[str, str]) -> dict[str, Any]:
    """Validate before confirm. mapping: file_col -> canonical."""
    errors = []
    if "name" not in mapping.values():
        errors.append("Обязательное поле «name» (название) не сопоставлено")
    inv = {v: k for k, v in mapping.items()}
    for i, row in df.iterrows():
        if "name" in inv:
            name = row.get(inv["name"])
            if pd.isna(name) or str(name).strip() == "":
                errors.append(f"Строка {int(i) + 2}: пустое название")
        for field in FLOAT_FIELDS:
            if field in inv:
                raw = row.get(inv[field])
                if raw is not None and not (isinstance(raw, float) and pd.isna(raw)) and str(raw).strip():
                    if _to_float(raw) is None:
                        errors.append(f"Строка {int(i) + 2}: нечисловое значение в «{field}»: {raw}")
    return {"valid": len(errors) == 0, "errors": errors[:100], "error_count": len(errors)}


def apply_import(
    db: Session,
    content: bytes,
    filename: str,
    mapping: dict[str, str],
) -> dict[str, Any]:
    df = read_tabular(content, filename)
    validation = validate_mapped_rows(df, mapping)
    if not validation["valid"]:
        return {
            "added": 0,
            "updated": 0,
            "skipped": 0,
            "errors": validation["errors"],
            "error_count": validation["error_count"],
        }

    inv = {v: k for k, v in mapping.items()}
    added = updated = skipped = 0
    errors: list[str] = []

    for i, row in df.iterrows():
        try:
            raw = {str(k): (None if pd.isna(v) else v) for k, v in row.to_dict().items()}
            name_col = inv["name"]
            name = str(row.get(name_col)).strip()
            if not name:
                skipped += 1
                continue

            data: dict[str, Any] = {"name": name, "raw_data": raw, "updated_at": utcnow()}
            for field, col in inv.items():
                if field == "name":
                    continue
                val = row.get(col)
                if pd.isna(val):
                    continue
                if field == "manufacturer":
                    m = _get_or_create_manufacturer(db, str(val))
                    if m:
                        data["manufacturer_id"] = m.id
                elif field == "solution_type":
                    sid = _resolve_solution_type(db, str(val))
                    if sid:
                        data["solution_type_id"] = sid
                elif field in FLOAT_FIELDS:
                    fv = _to_float(val)
                    if fv is not None:
                        data[field] = fv
                else:
                    data[field] = str(val).strip()

            existing = db.query(Robot).filter(Robot.name == name, Robot.archived.is_(False)).first()
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                data.setdefault("confirmation_level", "needs_review")
                db.add(Robot(**data))
                added += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Строка {int(i) + 2}: {exc}")
            skipped += 1

    db.commit()
    return {
        "added": added,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:100],
        "error_count": len(errors),
        "message": f"Импорт завершён: добавлено {added}, обновлено {updated}, пропущено {skipped}",
    }


def _coerce_param_value(key: str, value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    normalized = normalize_param_value(key, value)
    if key in ("storage_type", "zone_type", "facility_type"):
        return normalized
    if isinstance(normalized, (int, float)) and not isinstance(normalized, bool):
        return normalized
    fv = _to_float(normalized)
    if fv is not None:
        return fv
    return normalized


def _finalize_imported_params(params: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Согласование труда/пика после импорта; конфликты → предупреждения, без молчаливой подмены."""
    from app.services.labor_cost import estimate_peak_from_daily_ops, resolve_current_labor_cost

    warnings: list[str] = []
    out = dict(params)
    labor = resolve_current_labor_cost(out, assumption_default=0.0)
    if labor["labor_cost_origin"] != "model_assumption" and labor["current_labor_cost_year"] > 0:
        if out.get("current_labor_cost_year") in (None, "", 0, "0"):
            out["current_labor_cost_year"] = labor["current_labor_cost_year"]
        out.setdefault("staff_cost_year", labor["current_labor_cost_year"])
        warnings.extend(labor.get("warnings") or [])
    else:
        # Явные конфликты при наличии источников, даже если выбран приоритетный
        warnings.extend([w for w in (labor.get("warnings") or []) if "Конфликт" in w])

    if out.get("peak_demand") in (None, "", 0, "0"):
        peak, how = estimate_peak_from_daily_ops(out)
        if peak:
            out["peak_demand"] = peak
            warnings.append(
                f"Пиковая нагрузка оценена ({how}) = {peak} оп/ч — подтвердите значение."
            )

    if warnings:
        out["_import_warnings"] = warnings
    return out, warnings


def _detect_key_value_columns(columns: list[str]) -> tuple[Optional[int], Optional[int]]:
    low = [c.lower().strip() for c in columns]
    key_col_idx = next(
        (i for i, n in enumerate(low) if any(x in n for x in ("параметр", "param", "ключ", "name", "field"))),
        None,
    )
    val_col_idx = next(
        (i for i, n in enumerate(low) if any(x in n for x in ("значен", "value"))),
        None,
    )
    return key_col_idx, val_col_idx


def import_project_params(content: bytes, filename: str, mapping: Optional[dict[str, str]] = None) -> dict[str, Any]:
    """Импорт параметров объекта проекта из таблицы (ключ-значение или одна строка)."""
    try:
        df = read_tabular(content, filename)
    except ValueError as exc:
        from app.services.safe_errors import public_error_detail

        return {
            "object_params": {},
            "mapping": mapping or {},
            "errors": [
                public_error_detail(exc, fallback="Не удалось разобрать файл. Проверьте формат CSV/Excel."),
            ],
            "mode": None,
        }
    except Exception:
        return {
            "object_params": {},
            "mapping": mapping or {},
            "errors": ["Не удалось разобрать файл. Проверьте формат CSV/Excel."],
            "mode": None,
        }

    columns = [str(c) for c in df.columns]
    if mapping is None:
        mapping = suggest_param_column_mapping(columns)

    if df.empty or len(columns) == 0:
        return {"object_params": {}, "mapping": mapping, "errors": ["Пустой файл"], "mode": None}

    key_col_idx, val_col_idx = _detect_key_value_columns(columns)
    if key_col_idx is not None and val_col_idx is not None:
        params: dict[str, Any] = {}
        unrecognized_labels: list[str] = []
        for _, row in df.iterrows():
            raw_key = row.iloc[key_col_idx]
            if pd.isna(raw_key):
                continue
            label = str(raw_key).strip()
            if not label or label.lower() in ("параметр", "parameter", "ключ"):
                continue
            k = resolve_param_key(label)
            v = row.iloc[val_col_idx]
            if pd.isna(v) or (isinstance(v, str) and not v.strip()):
                continue
            # Если ключ не изменился после resolve и не канонический — помечаем
            if k == label and not _is_canonical_param(k):
                unrecognized_labels.append(label)
            params[k] = _coerce_param_value(k, v)
        params, warnings = _finalize_imported_params(params)
        if unrecognized_labels:
            warnings.append(
                "Не сопоставлены с моделью NETCORE (сохранены как есть): "
                + ", ".join(unrecognized_labels[:12])
                + ("…" if len(unrecognized_labels) > 12 else "")
            )
        return {
            "object_params": params,
            "mapping": mapping,
            "mode": "key_value",
            "warnings": warnings,
            "unrecognized_labels": unrecognized_labels,
        }

    # Single wide data row
    if len(df) >= 1:
        row = df.iloc[0]
        params = {}
        ignored_columns: list[str] = []
        for col in columns:
            if str(col).lower().startswith("unnamed"):
                continue
            mapped = (mapping or {}).get(col) or col
            if mapped in ("ignore", "", None):
                ignored_columns.append(col)
                continue
            canon = resolve_param_key(str(mapped))
            val = row[col]
            if pd.isna(val) or (isinstance(val, str) and not str(val).strip()):
                continue
            params[canon] = _coerce_param_value(canon, val)
        params, warnings = _finalize_imported_params(params)
        return {
            "object_params": params,
            "mapping": mapping,
            "mode": "wide_row",
            "preview": params,
            "warnings": warnings,
            "ignored_columns": ignored_columns,
        }

    return {"object_params": {}, "mapping": mapping, "errors": ["Пустой файл"], "mode": None}


def _is_canonical_param(key: str) -> bool:
    try:
        from app.services.import_source_datasets import PARAM_ALIASES as DS_ALIASES
    except Exception:
        DS_ALIASES = {}
    known = set(DS_ALIASES.values()) if isinstance(DS_ALIASES, dict) else set()
    known |= {
        "peak_demand",
        "area_m2",
        "area_width_m",
        "area_length_m",
        "aisle_width_mm",
        "required_payload_kg",
        "current_labor_cost_year",
        "staff_count",
        "staff_salary_month",
        "payroll_tax_coef",
        "ops_count",
        "charging_stations",
        "zones_count",
        "shifts_count",
        "shift_hours",
        "peak_factor",
    }
    if key in known:
        return True
    # resolve_param_key нормализует русские ярлыки в канон
    resolved = resolve_param_key(key)
    return resolved != key and resolved in known


def suggest_param_column_mapping(columns: list[str]) -> dict[str, str]:
    """Сопоставление колонок wide-таблицы → параметры объекта (не каталог роботов)."""
    mapping: dict[str, str] = {}
    for col in columns:
        canon = resolve_param_key(col)
        if canon != col or _is_canonical_param(canon):
            mapping[col] = canon
        else:
            # попробуем вложенные алиасы через нижний регистр
            low = col.lower().strip().replace("ё", "е")
            guessed = resolve_param_key(low)
            mapping[col] = guessed if guessed != low else "ignore"
    return mapping


def validate_project_params_import(
    content: bytes,
    filename: str,
    mapping: Optional[dict[str, str]] = None,
    existing_params: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Валидация импорта параметров объекта (не каталога). Не требует robot name."""
    errors: list[str] = []
    warnings: list[str] = []
    try:
        df = read_tabular(content, filename)
    except ValueError as exc:
        from app.services.safe_errors import public_error_detail

        return {
            "valid": False,
            "errors": [
                public_error_detail(exc, fallback="Не удалось разобрать файл. Проверьте формат CSV/Excel."),
            ],
            "warnings": [],
            "row_count": 0,
            "mode": None,
            "parsed_params": {},
            "will_overwrite": [],
            "unmapped_columns": [],
        }
    except Exception:
        return {
            "valid": False,
            "errors": ["Файл повреждён или не читается как CSV/Excel"],
            "warnings": [],
            "row_count": 0,
            "mode": None,
            "parsed_params": {},
            "will_overwrite": [],
            "unmapped_columns": [],
        }

    if df.empty:
        return {
            "valid": False,
            "errors": ["Пустой файл — нет строк данных"],
            "warnings": [],
            "row_count": 0,
            "mode": None,
            "parsed_params": {},
            "will_overwrite": [],
            "unmapped_columns": list(map(str, df.columns)),
        }

    parsed = import_project_params(content, filename, mapping)
    if parsed.get("errors"):
        errors.extend(parsed["errors"])
    warnings.extend(parsed.get("warnings") or [])
    params = parsed.get("object_params") or {}
    mode = parsed.get("mode")

    columns = [str(c) for c in df.columns]
    key_i, val_i = _detect_key_value_columns(columns)
    unmapped_columns: list[str] = []
    if mode == "wide_row":
        for col, dest in (mapping or parsed.get("mapping") or {}).items():
            if dest in (None, "", "ignore"):
                unmapped_columns.append(col)
        for col in columns:
            if col not in (mapping or {}) and not str(col).lower().startswith("unnamed"):
                unmapped_columns.append(col)
    elif key_i is None or val_i is None:
        warnings.append(
            "Не удалось уверенно определить колонки «Параметр» и «Значение». "
            "Проверьте заголовки или сопоставьте колонки вручную."
        )

    # числовые поля
    for k, v in params.items():
        if k.startswith("_"):
            continue
        if k in (
            "peak_demand",
            "area_m2",
            "current_labor_cost_year",
            "staff_count",
            "required_payload_kg",
        ):
            if isinstance(v, (int, float)) and v < 0:
                errors.append(f'Поле «{k}»: значение не может быть отрицательным')

    # ₽/мес vs ₽/год — не смешивать без подтверждения пользователем
    labor_year = params.get("current_labor_cost_year")
    salary_month = params.get("staff_salary_month")
    if isinstance(labor_year, (int, float)) and 0 < labor_year < 500_000:
        warnings.append(
            "«Стоимость персонала» выглядит как сумма за месяц (< 500 000 ₽), "
            "а в модели ожидаются ₽/год. Проверьте единицу или укажите годовой ФОТ."
        )
    if (
        isinstance(salary_month, (int, float))
        and isinstance(labor_year, (int, float))
        and salary_month > 0
        and abs(labor_year - salary_month) < 1
    ):
        warnings.append(
            "Годовая стоимость персонала совпадает с месячной зарплатой — "
            "возможна ошибка единицы измерения (₽/мес вместо ₽/год)."
        )
    # Паллеты vs операции: пик из ops_count vs inbound pallets без смешения единиц
    if params.get("inbound_pallets_per_day") and params.get("ops_count"):
        warnings.append(
            "В файле есть и суточный объём операций (строки), и паллетопоток. "
            "Пик в экономике считается в операциях/час — паллеты не подставляются как ops автоматически."
        )

    existing = existing_params or {}
    will_overwrite = [
        k
        for k, v in params.items()
        if not str(k).startswith("_")
        and k in existing
        and existing.get(k) not in (None, "")
        and existing.get(k) != v
    ]
    if will_overwrite:
        warnings.append(
            f"Будут перезаписаны уже сохранённые параметры: {', '.join(will_overwrite[:10])}"
            + ("…" if len(will_overwrite) > 10 else "")
        )

    if not params and not errors:
        errors.append("Не распознано ни одного параметра. Проверьте заголовки и значения.")

    return {
        "valid": len(errors) == 0 and bool(params),
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "mode": mode,
        "parsed_params": params,
        "will_overwrite": will_overwrite,
        "unmapped_columns": sorted(set(unmapped_columns)),
        "mapping": parsed.get("mapping") or mapping or {},
        "unrecognized_labels": parsed.get("unrecognized_labels") or [],
    }
