"""Единый источник текущих затрат на труд для экономики и импорта."""

from __future__ import annotations

from typing import Any, Optional


def _f(v: Any) -> Optional[float]:
    if v is None or v == "" or v is False:
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x != x:  # NaN
        return None
    return x


def derived_labor_from_headcount(params: dict[str, Any]) -> tuple[Optional[float], Optional[str]]:
    """Численность × годовая стоимость сотрудника или месячная з/п × 12 × коэф. ФОТ."""
    n = _f(params.get("staff_count"))
    if not n or n <= 0:
        return None, None
    per_year = _f(params.get("staff_cost_per_person_year"))
    if per_year and per_year > 0:
        return round(n * per_year, 2), "численность × годовая ставка на сотрудника"
    month = _f(
        params.get("staff_salary_month")
        or params.get("picker_salary_month")
        or params.get("avg_salary_month")
    )
    if month and month > 0:
        coef = _f(params.get("payroll_tax_coef")) or 1.0
        return round(n * month * 12.0 * coef, 2), "численность × з/п в месяц × 12 × коэф. ФОТ"
    return None, None


def resolve_current_labor_cost(
    params: dict[str, Any],
    *,
    assumption_default: float = 12_000_000.0,
    conflict_tolerance: float = 0.05,
) -> dict[str, Any]:
    """
    Каноническое поле экономики: current_labor_cost_year (₽/год).

    Приоритет:
      1) явное current_labor_cost_year
      2) производное из численности × ставка
      3) staff_cost_year
      4) допущение модели
    При конфликте источников значение не подменяется молча — выбирается приоритетный
    источник и добавляется предупреждение.
    """
    warnings: list[str] = []
    sources: dict[str, float] = {}

    explicit = _f(params.get("current_labor_cost_year"))
    if explicit is not None and explicit > 0:
        sources["current_labor_cost_year"] = explicit

    staff_year = _f(params.get("staff_cost_year"))
    if staff_year is not None and staff_year > 0:
        sources["staff_cost_year"] = staff_year

    derived, derived_how = derived_labor_from_headcount(params)
    if derived is not None and derived > 0:
        sources["derived_headcount"] = derived

    chosen: float
    origin: str
    if "current_labor_cost_year" in sources:
        chosen = sources["current_labor_cost_year"]
        origin = "current_labor_cost_year"
    elif "derived_headcount" in sources:
        chosen = sources["derived_headcount"]
        origin = f"derived:{derived_how}"
        warnings.append(
            f"Годовые затраты на персонал рассчитаны из численности: {derived_how} → {chosen:,.0f} ₽/год."
        )
    elif "staff_cost_year" in sources:
        chosen = sources["staff_cost_year"]
        origin = "staff_cost_year"
        warnings.append(
            f"Годовые затраты на персонал не заданы — использовано поле «Затраты на персонал» "
            f"= {chosen:,.0f} ₽/год."
        )
    else:
        chosen = float(assumption_default)
        origin = "model_assumption"
        warnings.append(
            f"Затраты на труд не заданы — допущение модели {chosen:,.0f} ₽/год "
            "(не является данными объекта)."
        )

    _src_ru = {
        "current_labor_cost_year": "годовые затраты на персонал",
        "staff_cost_year": "затраты на персонал",
        "derived_headcount": "расчёт из численности",
    }

    def _origin_ru(o: str) -> str:
        if o.startswith("derived:"):
            return f"расчёт из численности ({o.split(':', 1)[1]})"
        return _src_ru.get(o, "выбранный источник")

    # Конфликты
    for name, val in sources.items():
        if name == origin or (origin.startswith("derived") and name == "derived_headcount"):
            continue
        if chosen <= 0:
            continue
        if abs(val - chosen) / max(chosen, 1.0) > conflict_tolerance:
            warnings.append(
                f"Конфликт источников труда: {_src_ru.get(name, 'другой источник')} "
                f"= {val:,.0f} ₽/год отличается от используемого {chosen:,.0f} ₽/год "
                f"(источник: {_origin_ru(origin)}). "
                "Произвольная подмена не выполняется — проверьте параметры объекта."
            )

    if chosen >= 500_000_000:
        warnings.append(
            "Текущие затраты на труд ≥ 500 млн ₽/год выглядят аномально высокими. "
            "Проверьте размерность (₽/год по объекту)."
        )

    return {
        "current_labor_cost_year": round(chosen, 2),
        "labor_cost_origin": origin,
        "labor_cost_sources": sources,
        "warnings": warnings,
        "is_assumption": origin == "model_assumption",
    }


def estimate_peak_from_daily_ops(params: dict[str, Any]) -> tuple[Optional[float], Optional[str]]:
    """Грубая оценка пика оп/ч из суточного объёма, смен и пик-коэффициента."""
    daily = _f(
        params.get("ops_count")
        or params.get("pick_lines_per_day")
        or params.get("ops_per_day")
    )
    if not daily or daily <= 0:
        return None, None
    shifts = _f(params.get("shifts_count")) or 1.0
    hours = _f(params.get("shift_hours")) or 8.0
    peak_factor = _f(params.get("peak_factor")) or 1.0
    denom = shifts * hours
    if denom <= 0:
        return None, None
    peak = daily / denom * peak_factor
    return round(peak, 2), "суточный объём / (смены × часы) × пиковый коэффициент"
