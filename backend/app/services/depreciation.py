"""Линейная амортизация CAPEX (TZ-08 / Дополнения §2.2).

Амортизация — бухгалтерский расход периода, не денежный платёж.
Налоговый щит не моделируется: ставка налога в первоисточнике не задана.
"""

from __future__ import annotations

from typing import Any, Optional


METHOD_STRAIGHT_LINE = "straight_line"

FORMULA_RU = (
    "Амортизация_год = (база_CAPEX − ликвидационная_стоимость) / срок_лет "
    "(линейный метод; срок и ликвидация — допущения модели)"
)


class DepreciationError(ValueError):
    """Некорректные входные параметры амортизации."""


def calc_straight_line_depreciation(
    depreciable_base: float,
    useful_life_years: int,
    salvage_value: float = 0.0,
    horizon_years: Optional[int] = None,
    *,
    enabled: bool = True,
    asset_label: str = "CAPEX сценария",
) -> dict[str, Any]:
    """Линейная амортизация по годам горизонта.

    Returns
    -------
    dict с полями:
      applicable, method, depreciable_base, salvage_value, useful_life_years,
      annual_depreciation, schedule[{year, amount, book_value_end}],
      formula, assumptions, notes, error (если неприменимо без исключения)
    """
    notes: list[str] = [
        "Амортизация — бухгалтерский расход, не денежный отток периода.",
        "Налоговый щит не рассчитывается: ставка налога не задана.",
    ]

    if not enabled:
        return {
            "applicable": False,
            "enabled": False,
            "method": METHOD_STRAIGHT_LINE,
            "depreciable_base": round(float(depreciable_base or 0), 2),
            "salvage_value": round(float(salvage_value or 0), 2),
            "useful_life_years": useful_life_years,
            "annual_depreciation": None,
            "schedule": [],
            "formula": FORMULA_RU,
            "assumptions": {
                "depreciation_enabled": False,
                "depreciation_method": METHOD_STRAIGHT_LINE,
            },
            "notes": notes + ["Расчёт амортизации выключен допущением depreciation_enabled=false."],
            "asset_label": asset_label,
            "error": None,
        }

    try:
        base = float(depreciable_base)
        salvage = float(salvage_value)
    except (TypeError, ValueError) as exc:
        raise DepreciationError("База и ликвидационная стоимость должны быть числами") from exc

    if base < 0:
        raise DepreciationError("Амортизируемая база не может быть отрицательной")
    if salvage < 0:
        raise DepreciationError("Ликвидационная стоимость не может быть отрицательной")
    if salvage > base:
        raise DepreciationError("Ликвидационная стоимость не может превышать базу CAPEX")

    try:
        life = int(useful_life_years)
    except (TypeError, ValueError) as exc:
        raise DepreciationError("Срок амортизации должен быть целым числом лет") from exc

    if life <= 0:
        return {
            "applicable": False,
            "enabled": True,
            "method": METHOD_STRAIGHT_LINE,
            "depreciable_base": round(base, 2),
            "salvage_value": round(salvage, 2),
            "useful_life_years": life,
            "annual_depreciation": None,
            "schedule": [],
            "formula": FORMULA_RU,
            "assumptions": {
                "depreciation_enabled": True,
                "depreciation_method": METHOD_STRAIGHT_LINE,
                "depreciation_years": life,
                "salvage_value": salvage,
                "depreciation_years_is_assumption": True,
            },
            "notes": notes + ["Срок амортизации ≤ 0 — начисление неприменимо."],
            "asset_label": asset_label,
            "error": "useful_life_years must be >= 1",
        }

    horizon = int(horizon_years) if horizon_years is not None else life
    if horizon < 0:
        raise DepreciationError("Горизонт расчёта не может быть отрицательным")

    depreciable_amount = base - salvage
    annual = round(depreciable_amount / life, 2) if life else 0.0

    schedule: list[dict[str, Any]] = []
    book = base
    remaining = depreciable_amount
    for year in range(1, horizon + 1):
        if year <= life and remaining > 0:
            # последний год срока — добиваем остаток из‑за округления
            if year == life:
                amount = round(remaining, 2)
            else:
                amount = min(annual, round(remaining, 2))
            remaining = round(remaining - amount, 2)
            book = round(book - amount, 2)
        else:
            amount = 0.0
        schedule.append(
            {
                "year": year,
                "amount": round(amount, 2),
                "book_value_end": round(max(book, salvage) if year <= life else book, 2),
            }
        )

    # выравнивание: сумма начислений за срок = depreciable_amount
    charged = round(sum(row["amount"] for row in schedule if row["year"] <= life), 2)
    if schedule and abs(charged - round(depreciable_amount, 2)) > 0.02 and life <= horizon:
        diff = round(round(depreciable_amount, 2) - charged, 2)
        target = schedule[life - 1]
        target["amount"] = round(target["amount"] + diff, 2)
        # пересчёт book_value_end для года life
        book_run = base
        for row in schedule:
            book_run = round(book_run - row["amount"], 2)
            row["book_value_end"] = round(max(book_run, salvage) if row["year"] <= life else book_run, 2)

    annual_display = annual if depreciable_amount > 0 else 0.0

    return {
        "applicable": True,
        "enabled": True,
        "method": METHOD_STRAIGHT_LINE,
        "method_label_ru": "Линейный",
        "depreciable_base": round(base, 2),
        "salvage_value": round(salvage, 2),
        "useful_life_years": life,
        "horizon_years": horizon,
        "annual_depreciation": round(annual_display, 2),
        "schedule": schedule,
        "formula": FORMULA_RU,
        "assumptions": {
            "depreciation_enabled": True,
            "depreciation_method": METHOD_STRAIGHT_LINE,
            "depreciation_years": life,
            "salvage_value": round(salvage, 2),
            "depreciation_years_is_assumption": True,
            "salvage_value_is_assumption": True,
            "note": (
                "Срок службы и ликвидационная стоимость не заданы организатором; "
                "приняты допущения команды (см. docs/DEPRECIATION_DESIGN.md)."
            ),
        },
        "notes": notes
        + [
            f"Актив: {asset_label}.",
            "Неполный первый/последний год не моделируется — в ТЗ нет правила.",
        ],
        "asset_label": asset_label,
        "is_cash_outflow": False,
        "error": None,
    }


def accounting_annual_effect(
    cash_annual_effect: float,
    annual_depreciation: Optional[float],
) -> dict[str, Any]:
    """Годовой эффект с учётом амортизации (рекомендация §2.2), без изменения CF."""
    if annual_depreciation is None:
        return {
            "with_depreciation": None,
            "depreciation_deducted": None,
            "note": "Амортизация неприменима — accounting-эффект не рассчитан.",
        }
    dep = float(annual_depreciation)
    cash = float(cash_annual_effect)
    return {
        "with_depreciation": round(cash - dep, 2),
        "depreciation_deducted": round(dep, 2),
        "note": (
            "Бухгалтерский годовой эффект = денежный чистый эффект − амортизация CAPEX. "
            "Не используется в NPV/IRR/денежном payback (амортизация не денежный поток)."
        ),
    }
