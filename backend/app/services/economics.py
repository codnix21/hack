"""Прозрачный расчёт экономики робототехнических решений."""

from __future__ import annotations

import math
from typing import Any, Optional

from app.services.depreciation import (
    FORMULA_RU as DEPRECIATION_FORMULA_RU,
    accounting_annual_effect,
    calc_straight_line_depreciation,
)


FORMULAS_RU = {
    "robots_count": (
        "количество_роботов = ceil(пиковый_спрос / (производительность * загрузка * доступность)) "
        "* (1 + резерв)"
    ),
    "capex": (
        "CAPEX = оборудование + инфраструктура + ПО + интеграция + пусконаладка + обучение + непредвиденные"
    ),
    "opex": (
        "OPEX_год = сервис + лицензии + энергия + связь + расходники + ремонт + персонал_эксплуатации"
    ),
    "annual_effect": (
        "годовой_эффект = снижение_текущих_затрат + доп_выручка - прирост_OPEX"
    ),
    "payback": "срок_окупаемости_лет — год, когда накопленный денежный поток становится ≥ 0",
    "roi": "ROI_за_год_% = чистый_годовой_эффект / CAPEX * 100",
    "roi_horizon": "ROI_горизонт_% = сумма_чистых_эффектов_за_годы / CAPEX * 100",
    "tco": (
        "TCO_робототехники = CAPEX + OPEX_роботов_год × горизонт_лет "
        "(без оставшегося ручного труда; полный денежный выход — отдельный показатель)"
    ),
    "npv": "NPV = сумма CF_t / (1 + ставка)^t, CF_0 = −CAPEX",
    "irr": "IRR — ставка, при которой NPV = 0 (если поток меняет знак)",
    "gross_effect": "валовой операционный эффект = снижение затрат + доп. выручка",
    "net_effect": "чистый годовой эффект = валовой эффект − прирост OPEX роботов",
    "depreciation": DEPRECIATION_FORMULA_RU,
    "annual_effect_with_depreciation": (
        "годовой_эффект_с_амортизацией = чистый_денежный_эффект − амортизация_CAPEX_год "
        "(бухгалтерский вид; не денежный CF)"
    ),
}


DEFAULT_ASSUMPTIONS = {
    "utilization": 0.85,
    "availability": 0.95,
    "reserve": 0.10,
    "years": 5,
    "infra_share_of_equipment": 0.15,
    "integration_share": 0.12,
    "commissioning_share": 0.05,
    "training_per_robot": 150_000.0,
    "contingency_share": 0.08,
    "energy_per_robot_year": 80_000.0,
    "connectivity_per_robot_year": 24_000.0,
    "consumables_per_robot_year": 40_000.0,
    "repair_share_of_price": 0.03,
    "ops_staff_per_10_robots": 1.0,
    "ops_staff_salary_year": 900_000.0,
    "license_share_of_software": 0.2,
    "current_labor_cost_year": 0.0,
    "labor_reduction_share": 0.4,
    "additional_revenue": 0.0,
    "raas_monthly_per_robot": 180_000.0,
    "discount_rate": 0.12,
    "battery_cycle_years": 4,
    "battery_cost_share": 0.12,
    "charging_station_cost": 250_000.0,
    # TZ-08 / Дополнения §2.2 — допущения команды (срок и ликвидация в ТЗ не заданы)
    "depreciation_enabled": True,
    "depreciation_method": "straight_line",
    "depreciation_years": None,  # None → горизонт расчёта
    "salvage_value": 0.0,
}


def _ensure_non_negative(name: str, value: float) -> float:
    if value is None:
        raise ValueError(f"{name} не задан")
    v = float(value)
    if v < 0:
        raise ValueError(f"{name} не может быть отрицательным")
    return v


def calc_robots_count(
    peak_demand: float,
    productivity: float,
    utilization: float = 0.85,
    availability: float = 0.95,
    reserve: float = 0.10,
) -> dict[str, Any]:
    peak_demand = _ensure_non_negative("Пиковый спрос", peak_demand)
    if productivity <= 0:
        raise ValueError("Производительность должна быть больше 0")
    if utilization <= 0 or availability <= 0:
        raise ValueError("Коэффициенты загрузки и доступности должны быть больше 0")
    if reserve < 0:
        raise ValueError("Резерв не может быть отрицательным")

    effective = productivity * utilization * availability
    base = math.ceil(peak_demand / effective) if effective > 0 else 0
    with_reserve = math.ceil(base * (1 + reserve))
    return {
        "robots_count": with_reserve,
        "coefficients": {
            "peak_demand": peak_demand,
            "productivity": productivity,
            "utilization": utilization,
            "availability": availability,
            "reserve": reserve,
            "effective_productivity": round(effective, 4),
            "base_count_before_reserve": base,
        },
        "formula": FORMULAS_RU["robots_count"],
    }


def explain_robots_count(inputs: dict[str, Any]) -> dict[str, Any]:
    """Пошаговое объяснение расчёта количества роботов для API прозрачности."""
    peak = float(inputs.get("peak_demand", 0))
    productivity = float(inputs.get("productivity", 0))
    utilization = float(inputs.get("utilization", DEFAULT_ASSUMPTIONS["utilization"]))
    availability = float(inputs.get("availability", DEFAULT_ASSUMPTIONS["availability"]))
    reserve = float(inputs.get("reserve", DEFAULT_ASSUMPTIONS["reserve"]))
    result = calc_robots_count(peak, productivity, utilization, availability, reserve)
    c = result["coefficients"]
    steps = [
        {
            "step": 1,
            "title": "Эффективная производительность",
            "expression": "производительность × загрузка × доступность",
            "values": {
                "productivity": c["productivity"],
                "utilization": c["utilization"],
                "availability": c["availability"],
            },
            "result": c["effective_productivity"],
        },
        {
            "step": 2,
            "title": "Базовое количество до резерва",
            "expression": "ceil(пиковый_спрос / эффективная_производительность)",
            "values": {
                "peak_demand": c["peak_demand"],
                "effective_productivity": c["effective_productivity"],
            },
            "result": c["base_count_before_reserve"],
        },
        {
            "step": 3,
            "title": "С учётом резерва",
            "expression": "ceil(базовое × (1 + резерв))",
            "values": {
                "base_count_before_reserve": c["base_count_before_reserve"],
                "reserve": c["reserve"],
            },
            "result": result["robots_count"],
        },
    ]
    return {
        "metric": "robots_count",
        "value": result["robots_count"],
        "steps": steps,
        "formula": FORMULAS_RU["robots_count"],
        "coefficients": c,
    }


def calc_capex(
    equipment: float,
    software: float = 0.0,
    robots_count: int = 1,
    infra: Optional[float] = None,
    integration: Optional[float] = None,
    commissioning: Optional[float] = None,
    training: Optional[float] = None,
    contingency: Optional[float] = None,
    assumptions: Optional[dict] = None,
) -> dict[str, Any]:
    equipment = _ensure_non_negative("Стоимость оборудования", equipment)
    software = _ensure_non_negative("Стоимость ПО", software)
    a = {**DEFAULT_ASSUMPTIONS, **(assumptions or {})}
    infra_assumed = infra is None
    integ_assumed = integration is None
    comm_assumed = commissioning is None
    train_assumed = training is None
    cont_assumed = contingency is None
    infra_v = infra if infra is not None else equipment * a["infra_share_of_equipment"]
    integration_v = integration if integration is not None else equipment * a["integration_share"]
    commissioning_v = commissioning if commissioning is not None else equipment * a["commissioning_share"]
    training_v = training if training is not None else a["training_per_robot"] * robots_count
    subtotal = equipment + infra_v + software + integration_v + commissioning_v + training_v
    contingency_v = contingency if contingency is not None else subtotal * a["contingency_share"]
    total = subtotal + contingency_v
    breakdown = {
        "equipment": round(equipment, 2),
        "infrastructure": round(infra_v, 2),
        "software": round(software, 2),
        "integration": round(integration_v, 2),
        "commissioning": round(commissioning_v, 2),
        "training": round(training_v, 2),
        "contingency": round(contingency_v, 2),
    }
    component_sources = {
        "equipment": {
            "origin": "input",
            "note": "unit_price × robots_count (+ внедрение, если задано)",
        },
        "software": {
            "origin": "catalog_or_zero",
            "note": "ПО из каталога робота или 0, если робот не выбран",
        },
        "infrastructure": {
            "origin": "model_assumption" if infra_assumed else "override",
            "note": f"доля {a['infra_share_of_equipment']} от стоимости оборудования",
        },
        "integration": {
            "origin": "model_assumption" if integ_assumed else "override",
            "note": f"доля {a['integration_share']} от стоимости оборудования",
        },
        "commissioning": {
            "origin": "model_assumption" if comm_assumed else "override",
            "note": f"доля {a['commissioning_share']} от стоимости оборудования",
        },
        "training": {
            "origin": "model_assumption" if train_assumed else "override",
            "note": f"{a['training_per_robot']} ₽ × число роботов",
        },
        "contingency": {
            "origin": "model_assumption" if cont_assumed else "override",
            "note": f"доля {a['contingency_share']} от суммы статей до резерва",
        },
    }
    return {
        "capex": round(total, 2),
        "breakdown": breakdown,
        "component_sources": component_sources,
        "breakdown_sum": round(sum(breakdown.values()), 2),
        "formula": FORMULAS_RU["capex"],
        "assumptions_used": {
            "infra_share_of_equipment": a["infra_share_of_equipment"],
            "integration_share": a["integration_share"],
            "commissioning_share": a["commissioning_share"],
            "training_per_robot": a["training_per_robot"],
            "contingency_share": a["contingency_share"],
        },
    }


def assess_fleet_vs_peak(
    *,
    selected_robots: int,
    recommended_robots: int,
    peak_demand: float,
    productivity: float,
    utilization: float,
    availability: float,
    robots_count_overridden: bool,
    peak_is_estimate: bool = False,
    peak_unit_note: Optional[str] = None,
) -> dict[str, Any]:
    """Сопоставление выбранного флота с расчётной потребностью (не симуляция)."""
    effective = productivity * utilization * availability if productivity > 0 else 0.0
    capacity = effective * max(0, selected_robots)
    coverage = (capacity / peak_demand) if peak_demand > 0 else None
    warnings: list[str] = []
    if robots_count_overridden and recommended_robots > 0 and selected_robots < recommended_robots:
        warnings.append(
            f"Выбрано {selected_robots} роботов, а расчётная потребность при пике "
            f"{peak_demand:g} оп/ч и производительности {productivity:g} оп/ч "
            f"(с загрузкой {utilization} и доступностью {availability}) ≈ "
            f"{recommended_robots} шт. Выбранный флот не является подтверждённой "
            f"достаточной конфигурацией."
        )
    if coverage is not None and coverage < 1.0:
        warnings.append(
            f"Оценочное покрытие пика парком: {coverage * 100:.1f}% "
            f"({capacity:.1f} из {peak_demand:g} оп/ч). Это оценка по формуле, "
            "не результат обследования склада."
        )
    if peak_is_estimate:
        warnings.append(
            "Пиковый спрос — оценка из суточного объёма операций (не измеренный пик). "
            "Единица «операция» в экономике = та же, что у производительности робота (оп/ч); "
            "паллетопоток приёмки/отгрузки в эту величину не входит автоматически."
        )
    if peak_unit_note:
        warnings.append(peak_unit_note)
    if productivity <= 0:
        warnings.append(
            "Производительность робота не задана — расчёт потребности во флоте недостоверен."
        )
    return {
        "selected_robots": selected_robots,
        "recommended_robots": recommended_robots,
        "robots_count_source": "user_or_fixed" if robots_count_overridden else "calculated",
        "effective_productivity_ops_per_hour": round(effective, 4),
        "fleet_capacity_ops_per_hour": round(capacity, 2),
        "peak_demand_ops_per_hour": peak_demand,
        "peak_coverage": round(coverage, 4) if coverage is not None else None,
        "meets_peak_demand": bool(coverage is not None and coverage >= 1.0),
        "peak_is_estimate": peak_is_estimate,
        "estimated": True,
        "note": (
            "Покрытие пика — оценочная формула "
            "(производительность × загрузка × доступность × N). "
            "Не учитывает зарядку как узкое место, очереди в проходах и смешанные типы операций."
        ),
        "warnings": warnings,
    }


def calc_opex_annual(
    robots_count: int,
    service: float = 0.0,
    software_cost: float = 0.0,
    price_per_robot: float = 0.0,
    assumptions: Optional[dict] = None,
    overrides: Optional[dict] = None,
) -> dict[str, Any]:
    a = {**DEFAULT_ASSUMPTIONS, **(assumptions or {})}
    o = overrides or {}
    licenses = o.get("licenses", software_cost * a["license_share_of_software"])
    energy = o.get("energy", a["energy_per_robot_year"] * robots_count)
    connectivity = o.get("connectivity", a["connectivity_per_robot_year"] * robots_count)
    consumables = o.get("consumables", a["consumables_per_robot_year"] * robots_count)
    repair = o.get("repair", price_per_robot * robots_count * a["repair_share_of_price"])
    staff_count = math.ceil(robots_count / 10 * a["ops_staff_per_10_robots"]) if robots_count else 0
    ops_staff = o.get("ops_staff", staff_count * a["ops_staff_salary_year"])
    service_v = o.get("service", service)
    total = service_v + licenses + energy + connectivity + consumables + repair + ops_staff
    breakdown = {
        "service": round(service_v, 2),
        "licenses": round(licenses, 2),
        "energy": round(energy, 2),
        "connectivity": round(connectivity, 2),
        "consumables": round(consumables, 2),
        "repair": round(repair, 2),
        "ops_staff": round(ops_staff, 2),
        "ops_staff_count": staff_count,
    }
    return {
        "opex_annual": round(total, 2),
        "breakdown": breakdown,
        "formula": FORMULAS_RU["opex"],
    }


def calc_annual_effect(
    current_cost_reduction: float,
    additional_revenue: float,
    incremental_opex: float,
) -> dict[str, Any]:
    effect = current_cost_reduction + additional_revenue - incremental_opex
    return {
        "annual_effect": round(effect, 2),
        "components": {
            "current_cost_reduction": round(current_cost_reduction, 2),
            "additional_revenue": round(additional_revenue, 2),
            "incremental_opex": round(incremental_opex, 2),
        },
        "formula": FORMULAS_RU["annual_effect"],
    }


def _round_payback_years(years: float) -> float:
    """Не округлять учтимый срок < 0,1 года до 0,00 (иначе UI показывает 0,0 лет)."""
    y = max(0.0, float(years))
    if y < 0.1:
        return round(y, 4)
    return round(y, 2)


def enrich_payback_display(payback: dict[str, Any]) -> dict[str, Any]:
    """Добавляет месяцы и человекочитаемую подпись срока окупаемости."""
    out = dict(payback)
    y = out.get("payback_years")
    if y is None:
        return out
    months = float(y) * 12.0
    out["payback_months"] = round(months, 1)
    if y < 1.0 / 12.0:
        out["payback_display"] = "менее 1 месяца"
    elif y < 1.0:
        out["payback_display"] = f"{round(months, 1)} мес."
    else:
        out["payback_display"] = f"{_round_payback_years(float(y))} лет"
    return out


def calc_payback(capex: float, annual_effect: float) -> dict[str, Any]:
    if annual_effect <= 0:
        return {
            "payback_years": None,
            "message": "Окупаемость не определена: годовой эффект ≤ 0",
            "formula": FORMULAS_RU["payback"],
        }
    return enrich_payback_display(
        {
            "payback_years": _round_payback_years(capex / annual_effect),
            "formula": FORMULAS_RU["payback"],
        }
    )


def calc_roi(cumulative_effect: float, capex: float) -> dict[str, Any]:
    if capex <= 0:
        return {"roi_percent": None, "message": "CAPEX должен быть больше 0", "formula": FORMULAS_RU["roi"]}
    return {
        "roi_percent": round(cumulative_effect / capex * 100, 2),
        "formula": FORMULAS_RU["roi"],
    }


def calc_tco(
    capex: float,
    opex_annual: float,
    years: int = 5,
    *,
    remaining_manual_labor_annual: float = 0.0,
    scope: str = "robotics_only",
) -> dict[str, Any]:
    """
    tco — совокупные затраты на роботизацию (CAPEX + OPEX роботов × годы).
    Не включает оставшийся ручной труд; полный денежный выход — total_outlay_with_remaining_labor.
    """
    years = max(1, int(years))
    robot_tco = round(capex + opex_annual * years, 2)
    rem = max(0.0, float(remaining_manual_labor_annual))
    return {
        "tco": robot_tco,
        "tco_scope": scope,
        "tco_note": (
            "TCO = первоначальные инвестиции (CAPEX) + ежегодный OPEX роботизации × горизонт. "
            "Оставшиеся затраты на ручной труд в TCO не входят."
        ),
        "initial_investment": round(capex, 2),
        "opex_annual": round(opex_annual, 2),
        "opex_horizon": round(opex_annual * years, 2),
        "remaining_manual_labor_annual": round(rem, 2),
        "remaining_manual_labor_horizon": round(rem * years, 2),
        "total_outlay_with_remaining_labor": round(robot_tco + rem * years, 2),
        "years": years,
        "formula": FORMULAS_RU["tco"],
    }


def calc_npv(cashflows: list[float], discount_rate: float) -> dict[str, Any]:
    if discount_rate <= -0.99:
        raise ValueError("Ставка дисконтирования некорректна")
    total = 0.0
    parts = []
    for t, cf in enumerate(cashflows):
        disc = cf / ((1 + discount_rate) ** t)
        parts.append({"year": t, "cashflow": round(cf, 2), "discounted": round(disc, 2)})
        total += disc
    return {
        "npv": round(total, 2),
        "discount_rate": discount_rate,
        "rows": parts,
        "formula": FORMULAS_RU["npv"],
        "assumption": True,
    }


def calc_irr(cashflows: list[float], guess: float = 0.1) -> dict[str, Any]:
    if not cashflows or all(c == 0 for c in cashflows):
        return {"irr": None, "message": "IRR не определён: нулевой денежный поток", "formula": FORMULAS_RU["irr"]}
    signs = {1 if c > 0 else -1 for c in cashflows if c != 0}
    if len(signs) < 2:
        return {
            "irr": None,
            "message": "IRR не определён: денежный поток не меняет знак (проект не окупается или нет инвестиций)",
            "formula": FORMULAS_RU["irr"],
        }

    def npv(r: float) -> float:
        return sum(cf / ((1 + r) ** t) for t, cf in enumerate(cashflows))

    def dnpv(r: float) -> float:
        return sum(-t * cf / ((1 + r) ** (t + 1)) for t, cf in enumerate(cashflows) if t)

    rate = guess
    for _ in range(80):
        y = npv(rate)
        dy = dnpv(rate)
        if abs(dy) < 1e-12:
            break
        nxt = rate - y / dy
        if nxt <= -0.95 or nxt > 20:
            break
        if abs(nxt - rate) < 1e-7:
            rate = nxt
            break
        rate = nxt
    if npv(rate) == npv(rate) and abs(npv(rate)) < max(1.0, abs(cashflows[0]) * 0.001):
        return {"irr": round(rate * 100, 2), "irr_rate": round(rate, 6), "formula": FORMULAS_RU["irr"]}
    return {"irr": None, "message": "IRR не удалось вычислить для данного потока", "formula": FORMULAS_RU["irr"]}


def calc_payback_from_cashflows(cashflows: list[float]) -> dict[str, Any]:
    acc = 0.0
    for t, cf in enumerate(cashflows):
        prev = acc
        acc += cf
        if acc >= 0 and t > 0:
            if cf == 0:
                years = float(t)
            else:
                frac = -prev / cf if cf else 0
                years = (t - 1) + frac
            return enrich_payback_display(
                {
                    "payback_years": _round_payback_years(years),
                    "formula": FORMULAS_RU["payback"],
                }
            )
    return {
        "payback_years": None,
        "message": "Окупаемость не достигнута на горизонте расчёта",
        "formula": FORMULAS_RU["payback"],
    }


def calculate_scenario(
    scenario: str,
    peak_demand: float,
    productivity: float,
    unit_price: float,
    software_cost: float = 0.0,
    maintenance_year: float = 0.0,
    implementation_cost: float = 0.0,
    robots_count: Optional[int] = None,
    utilization: float = 0.85,
    availability: float = 0.95,
    reserve: float = 0.10,
    years: int = 5,
    assumptions: Optional[dict] = None,
    overrides: Optional[dict] = None,
) -> dict[str, Any]:
    """Полный расчёт сценария: baseline | purchase | raas."""
    peak_demand = _ensure_non_negative("Пиковый спрос", peak_demand)
    unit_price = _ensure_non_negative("Цена робота", unit_price)
    software_cost = _ensure_non_negative("Стоимость ПО", software_cost)
    maintenance_year = _ensure_non_negative("Стоимость ТО", maintenance_year)
    implementation_cost = _ensure_non_negative("Стоимость внедрения", implementation_cost)

    a = {**DEFAULT_ASSUMPTIONS, **(assumptions or {})}
    o = overrides or {}

    count_info = calc_robots_count(peak_demand, productivity, utilization, availability, reserve)
    robots_overridden = robots_count is not None
    n = int(robots_count) if robots_overridden else count_info["robots_count"]
    peak_is_estimate = bool(o.get("peak_is_estimate") or a.get("peak_is_estimate"))

    current_labor = o.get("current_labor_cost_year", a["current_labor_cost_year"])
    current_labor = _ensure_non_negative("Текущие затраты на труд", float(current_labor))
    labor_reduction = o.get("labor_reduction_share", a["labor_reduction_share"])
    additional_revenue = o.get("additional_revenue", a["additional_revenue"])
    additional_revenue = _ensure_non_negative("Доп. выручка", float(additional_revenue))

    if scenario == "baseline":
        tco_base = calc_tco(
            0.0,
            current_labor,
            years,
            remaining_manual_labor_annual=0.0,
            scope="baseline_labor_only",
        )
        tco_base["tco_note"] = (
            "В сценарии без роботизации TCO = текущие затраты на труд × горизонт "
            "(ручной труд целиком)."
        )
        result = {
            "scenario": "baseline",
            "scenario_name_ru": "Без роботизации",
            "robots_count": 0,
            "robots_count_detail": count_info,
            "capex": {"capex": 0.0, "breakdown": {}, "formula": FORMULAS_RU["capex"]},
            "opex": {
                "opex_annual": round(current_labor, 2),
                "breakdown": {"current_labor": round(current_labor, 2)},
                "formula": "OPEX_базовый = текущие_затраты_труда",
            },
            "annual_effect": {
                "annual_effect": 0.0,
                "gross_operating_effect": 0.0,
                "net_annual_effect": 0.0,
                "components": {
                    "current_cost_reduction": 0.0,
                    "additional_revenue": 0.0,
                    "incremental_opex": 0.0,
                },
                "formula": FORMULAS_RU["annual_effect"],
                "note": "В базовом сценарии эффект автоматизации = 0",
            },
            "payback": calc_payback(0, 0),
            "roi": {
                "roi_percent": None,
                "message": "ROI не применим к сценарию без инвестиций",
                "formula": FORMULAS_RU["roi"],
            },
            "tco": tco_base,
            "remaining_manual_labor_cost": round(current_labor, 2),
            "assumptions": a,
            "assumption_flags": {"labor_reduction_share": False, "discount_rate": True},
            "formulas": FORMULAS_RU,
            "cost_comparison": {
                "initial_investment": 0.0,
                "annual_opex": round(current_labor, 2),
                "raas_service_year": None,
                "remaining_manual_labor_annual": round(current_labor, 2),
                "horizon_years": years,
                "robot_tco": tco_base["tco"],
                "total_outlay_with_remaining_labor": tco_base["tco"],
            },
        }
        result["npv"] = calc_npv([0.0] * (years + 1), float(a.get("discount_rate") or 0.12))
        result["irr"] = {"irr": None, "message": "IRR не применим к сценарию без инвестиций", "formula": FORMULAS_RU["irr"]}
        result["cashflows"] = [{"year": i, "cashflow": 0.0, "cumulative": 0.0} for i in range(years + 1)]
        result["depreciation"] = {
            "applicable": False,
            "enabled": False,
            "annual_depreciation": None,
            "schedule": [],
            "notes": ["В сценарии без роботизации амортизация CAPEX не применяется."],
            "is_cash_outflow": False,
        }
        result["annual_effect"]["with_depreciation"] = None
        return result

    equipment = unit_price * n + implementation_cost
    software_total = software_cost * n if software_cost else 0.0

    raas_year: Optional[float] = None
    if scenario == "raas":
        monthly = o.get("raas_monthly_per_robot", a["raas_monthly_per_robot"])
        raas_year = float(monthly) * 12 * n
        # CAPEX минимальный: обучение + часть инфраструктуры
        capex_info = calc_capex(
            equipment=0.0,
            software=0.0,
            robots_count=n,
            infra=o.get("infra", unit_price * n * a["infra_share_of_equipment"] * 0.5),
            integration=o.get("integration", 0.0),
            commissioning=o.get("commissioning", 0.0),
            training=None,
            contingency=None,
            assumptions=a,
        )
        opex_info = calc_opex_annual(
            robots_count=n,
            service=raas_year,
            software_cost=0.0,
            price_per_robot=0.0,
            assumptions=a,
            overrides={**o, "service": raas_year, "repair": 0.0},
        )
        scenario_name = "Роботы как услуга"
    else:
        # purchase
        capex_info = calc_capex(
            equipment=equipment,
            software=software_total,
            robots_count=n,
            infra=o.get("infra"),
            integration=o.get("integration"),
            commissioning=o.get("commissioning"),
            training=o.get("training"),
            contingency=o.get("contingency"),
            assumptions=a,
        )
        opex_info = calc_opex_annual(
            robots_count=n,
            service=maintenance_year * n,
            software_cost=software_total,
            price_per_robot=unit_price,
            assumptions=a,
            overrides=o,
        )
        scenario_name = "Покупка оборудования"

    # Чистый эффект = снижение труда + доп. выручка − OPEX роботов.
    # CAPEX в годовой эффект не входит (учитывается в CF_0 / NPV / окупаемости).
    remaining_labor = current_labor * (1 - labor_reduction)
    cost_reduction = current_labor * labor_reduction
    effect_info = calc_annual_effect(
        current_cost_reduction=cost_reduction,
        additional_revenue=additional_revenue,
        incremental_opex=opex_info["opex_annual"],
    )

    gross = cost_reduction + additional_revenue
    net = effect_info["annual_effect"]
    effect_info["gross_operating_effect"] = round(gross, 2)
    effect_info["net_annual_effect"] = round(net, 2)
    labor_reduction_is_assumption = "labor_reduction_share" not in o
    effect_info["labor_reduction_share"] = float(labor_reduction)
    effect_info["labor_reduction_is_assumption"] = labor_reduction_is_assumption
    effect_info["note"] = (
        f"Снижение затрат на персонал = {float(labor_reduction) * 100:.0f}% от текущих затрат на труд. "
        + (
            "Это ДОПУЩЕНИЕ модели по умолчанию, не гарантированная экономия и не отраслевая статистика."
            if labor_reduction_is_assumption
            else "Доля задана пользователем / переопределением расчёта."
        )
    )

    capex_v = capex_info["capex"]
    stations = int(o.get("charging_stations") or a.get("charging_stations") or max(1, math.ceil(n / 3)))
    station_cost = float(a.get("charging_station_cost") or 0) * stations
    if station_cost and scenario != "raas":
        capex_info["breakdown"]["charging_stations"] = round(station_cost, 2)
        capex_info["capex"] = round(capex_v + station_cost, 2)
        capex_v = capex_info["capex"]
        capex_info["assumptions_used"]["charging_station_cost"] = a.get("charging_station_cost")
        capex_info["assumptions_used"]["charging_stations_count"] = stations
        sources = dict(capex_info.get("component_sources") or {})
        sources["charging_stations"] = {
            "origin": "model_assumption",
            "note": (
                f"ceil(N/3) станций × {a.get('charging_station_cost')} ₽ "
                "(допущение модели, не КП поставщика)"
            ),
        }
        capex_info["component_sources"] = sources
    # Контроль: сумма статей breakdown = итоговый CAPEX
    bd = capex_info.get("breakdown") or {}
    capex_info["breakdown_sum"] = round(sum(float(v) for v in bd.values()), 2)
    capex_info["breakdown_matches_total"] = abs(capex_info["breakdown_sum"] - capex_v) < 0.02

    fleet_cap = assess_fleet_vs_peak(
        selected_robots=n,
        recommended_robots=int(count_info["robots_count"]),
        peak_demand=peak_demand,
        productivity=productivity,
        utilization=utilization,
        availability=availability,
        robots_count_overridden=robots_overridden,
        peak_is_estimate=peak_is_estimate,
    )

    # TZ-08: амортизация CAPEX (бухгалтерская). Не вычитается из денежных CF.
    dep_enabled = bool(a.get("depreciation_enabled", True))
    if "depreciation_enabled" in o:
        dep_enabled = bool(o["depreciation_enabled"])
    dep_years_raw = o.get("depreciation_years", a.get("depreciation_years"))
    dep_years = int(dep_years_raw) if dep_years_raw not in (None, "") else int(years)
    salvage = float(o.get("salvage_value", a.get("salvage_value") or 0.0))
    asset_label = (
        "Собственный CAPEX сценария RaaS (арендованный парк не амортизируется)"
        if scenario == "raas"
        else "CAPEX покупки (оборудование и внедрение)"
    )
    depreciation = calc_straight_line_depreciation(
        depreciable_base=capex_v,
        useful_life_years=dep_years,
        salvage_value=salvage,
        horizon_years=years,
        enabled=dep_enabled,
        asset_label=asset_label,
    )
    acct = accounting_annual_effect(net, depreciation.get("annual_depreciation"))
    effect_info["with_depreciation"] = acct.get("with_depreciation")
    effect_info["depreciation_deducted"] = acct.get("depreciation_deducted")
    effect_info["accounting_note"] = acct.get("note")

    cashflows = [-capex_v]
    batt_year = int(a.get("battery_cycle_years") or 0)
    batt_cost = unit_price * n * float(a.get("battery_cost_share") or 0)
    dep_schedule_by_year = {
        int(row["year"]): float(row["amount"]) for row in (depreciation.get("schedule") or [])
    }
    for year in range(1, years + 1):
        cf = net
        if batt_year and year == batt_year and scenario != "raas":
            cf -= batt_cost
        cashflows.append(round(cf, 2))
        # амортизация намеренно НЕ вычитается из CF (не денежный поток)

    discount = float(a.get("discount_rate") or 0.12)
    npv_info = calc_npv(cashflows, discount)
    irr_info = calc_irr(cashflows)
    payback = calc_payback_from_cashflows(cashflows)
    simple = calc_payback(capex_v, net)
    payback["simple_payback_years"] = simple.get("payback_years")
    payback["horizon_years"] = years
    # Пояснение: «не достигнута» ≠ «не посчитана» — CF не вышли в плюс за горизонт.
    if payback.get("payback_years") is None:
        if net <= 0:
            payback["message"] = (
                "Окупаемость не определена: чистый годовой эффект ≤ 0 "
                "(экономия не покрывает ежегодные затраты сценария)."
            )
        elif simple.get("payback_years") is not None:
            payback["message"] = (
                f"На горизонте {years} лет накопленный денежный поток не стал ≥ 0. "
                f"Простая оценка CAPEX ÷ годовой эффект ≈ {simple['payback_years']} лет — "
                f"дольше горизонта. Увеличьте горизонт в «что если», снизьте CAPEX "
                f"или повысьте экономию (ФОТ / долю снижения труда)."
            )
        else:
            payback["message"] = (
                f"Окупаемость не достигнута на горизонте расчёта ({years} лет)."
            )

    if scenario == "raas":
        # ROI = эффект / стартовый CAPEX для аренды даёт абсурдные проценты:
        # CAPEX ≈ инфра/обучение, а эффект сравнивается с экономией труда.
        roi = {
            "roi_percent": None,
            "roi_horizon_percent": None,
            "message": (
                "Для сценария «Роботы как услуга» ROI относительно стартового CAPEX "
                "не применяется и не сопоставляется с покупкой. "
                "Смотрите: первоначальные затраты, годовой платёж RaaS, TCO роботизации, "
                "NPV и чистый годовой эффект."
            ),
            "definition": (
                "ROI по CAPEX для RaaS отключён намеренно (методология аренды ≠ покупка)."
            ),
        }
    else:
        roi_annual = calc_roi(net, capex_v if capex_v > 0 else 0)
        cumulative_effect = net * years
        roi_horizon = calc_roi(cumulative_effect, capex_v if capex_v > 0 else 0)
        roi = {
            **roi_annual,
            "roi_percent": roi_annual.get("roi_percent"),
            "roi_horizon_percent": roi_horizon.get("roi_percent"),
            "definition": (
                "Годовой ROI = чистый годовой эффект / CAPEX. "
                "Горизонтный ROI = сумма эффектов / CAPEX."
            ),
        }
    tco = calc_tco(
        capex_v,
        opex_info["opex_annual"],
        years,
        remaining_manual_labor_annual=remaining_labor,
        scope="robotics_only",
    )
    payback = enrich_payback_display(payback)

    cumulative_rows = []
    acc = 0.0
    for t, cf in enumerate(cashflows):
        acc += cf
        cumulative_rows.append(
            {
                "year": t,
                "cashflow": cf,
                "cumulative": round(acc, 2),
                "note": (
                    "CF_0 = −CAPEX (инвестиции)"
                    if t == 0
                    else (
                        "CF_t = чистый годовой эффект (− замена АКБ в год цикла, если задано); "
                        "амортизация CAPEX в CF не входит"
                        + (
                            f" (бух. {dep_schedule_by_year.get(t, 0):.2f} ₽/год)"
                            if dep_schedule_by_year.get(t)
                            else ""
                        )
                    )
                ),
                "depreciation_accounting": (
                    None if t == 0 else round(float(dep_schedule_by_year.get(t, 0.0)), 2)
                ),
            }
        )

    cost_comparison = {
        "initial_investment": round(capex_v, 2),
        "annual_opex": round(opex_info["opex_annual"], 2),
        "raas_service_year": round(raas_year, 2) if raas_year is not None else None,
        "remaining_manual_labor_annual": round(remaining_labor, 2),
        "net_annual_effect": round(net, 2),
        "horizon_years": years,
        "robot_tco": tco["tco"],
        "total_outlay_with_remaining_labor": tco["total_outlay_with_remaining_labor"],
        "comparable_basis": (
            "Одинаковый объект, горизонт, peak_demand, labor_reduction_share и ставка дисконта; "
            "отличается модель владения (покупка vs аренда)."
        ),
    }

    model_warnings = list(fleet_cap.get("warnings") or [])
    if not capex_info.get("breakdown_matches_total"):
        model_warnings.append(
            "Внутренняя проверка: сумма статей CAPEX не совпала с итогом — проверьте расчёт."
        )

    return {
        "scenario": scenario,
        "scenario_name_ru": scenario_name,
        "robots_count": n,
        "robots_count_detail": count_info,
        "fleet_capacity": fleet_cap,
        "capex": capex_info,
        "opex": opex_info,
        "annual_effect": effect_info,
        "depreciation": depreciation,
        "payback": payback,
        "roi": roi,
        "tco": tco,
        "npv": npv_info,
        "irr": irr_info,
        "cashflows": cumulative_rows,
        "remaining_manual_labor_cost": round(remaining_labor, 2),
        "cost_comparison": cost_comparison,
        "assumptions": {
            **a,
            "depreciation_enabled": dep_enabled,
            "depreciation_years": dep_years,
            "salvage_value": salvage,
            "depreciation_method": "straight_line",
        },
        "assumption_flags": {
            "discount_rate": True,
            "labor_reduction_share": labor_reduction_is_assumption,
            "battery_cycle_years": True,
            "charging_station_cost": True,
            "capex_shares": True,
            "peak_is_estimate": peak_is_estimate,
            "depreciation_years": True,
            "salvage_value": True,
        },
        "model_warnings": model_warnings,
        "formulas": FORMULAS_RU,
        "inputs": {
            "peak_demand": peak_demand,
            "productivity": productivity,
            "unit_price": unit_price,
            "software_cost": software_cost,
            "maintenance_year": maintenance_year,
            "implementation_cost": implementation_cost,
            "utilization": utilization,
            "availability": availability,
            "reserve": reserve,
            "current_labor_cost_year": current_labor,
            "labor_reduction_share": float(labor_reduction),
            "labor_reduction_is_assumption": labor_reduction_is_assumption,
            "years": years,
            "discount_rate": discount,
            "robots_count_source": fleet_cap["robots_count_source"],
            "recommended_robots": fleet_cap["recommended_robots"],
            "peak_is_estimate": peak_is_estimate,
        },
    }


def explain_calculation(inputs: dict[str, Any], result: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Структурированные шаги расчёта для API прозрачности."""
    if result is None:
        result = calculate_scenario(
            scenario=inputs.get("scenario", "purchase"),
            peak_demand=float(inputs["peak_demand"]),
            productivity=float(inputs["productivity"]),
            unit_price=float(inputs.get("unit_price", 0)),
            software_cost=float(inputs.get("software_cost", 0)),
            maintenance_year=float(inputs.get("maintenance_year", 0)),
            implementation_cost=float(inputs.get("implementation_cost", 0)),
            robots_count=inputs.get("robots_count"),
            utilization=float(inputs.get("utilization", DEFAULT_ASSUMPTIONS["utilization"])),
            availability=float(inputs.get("availability", DEFAULT_ASSUMPTIONS["availability"])),
            reserve=float(inputs.get("reserve", DEFAULT_ASSUMPTIONS["reserve"])),
            years=int(inputs.get("years", DEFAULT_ASSUMPTIONS["years"])),
            assumptions=inputs.get("assumptions"),
            overrides=inputs.get("overrides"),
        )

    robots_explain = explain_robots_count(
        {
            "peak_demand": inputs.get("peak_demand", result.get("inputs", {}).get("peak_demand")),
            "productivity": inputs.get("productivity", result.get("inputs", {}).get("productivity")),
            "utilization": inputs.get("utilization", result.get("inputs", {}).get("utilization")),
            "availability": inputs.get("availability", result.get("inputs", {}).get("availability")),
            "reserve": inputs.get("reserve", result.get("inputs", {}).get("reserve")),
        }
    )

    capex = result.get("capex") or {}
    opex = result.get("opex") or {}
    effect = result.get("annual_effect") or {}
    payback = result.get("payback") or {}
    roi = result.get("roi") or {}
    tco = result.get("tco") or {}

    return {
        "scenario": result.get("scenario"),
        "scenario_name_ru": result.get("scenario_name_ru"),
        "robots_count": robots_explain,
        "capex": {
            "metric": "capex",
            "value": capex.get("capex"),
            "steps": [
                {
                    "step": 1,
                    "title": "Сумма статей CAPEX",
                    "expression": FORMULAS_RU["capex"],
                    "values": capex.get("breakdown") or {},
                    "result": capex.get("capex"),
                }
            ],
            "formula": FORMULAS_RU["capex"],
        },
        "opex": {
            "metric": "opex",
            "value": opex.get("opex_annual"),
            "steps": [
                {
                    "step": 1,
                    "title": "Сумма статей OPEX за год",
                    "expression": FORMULAS_RU["opex"],
                    "values": opex.get("breakdown") or {},
                    "result": opex.get("opex_annual"),
                }
            ],
            "formula": FORMULAS_RU["opex"],
        },
        "effect": {
            "metric": "annual_effect",
            "value": effect.get("annual_effect"),
            "steps": [
                {
                    "step": 1,
                    "title": "Годовой эффект",
                    "expression": FORMULAS_RU["annual_effect"],
                    "values": effect.get("components") or {},
                    "result": effect.get("annual_effect"),
                }
            ],
            "formula": FORMULAS_RU["annual_effect"],
        },
        "payback": {
            "metric": "payback",
            "value": payback.get("payback_years"),
            "steps": [
                {
                    "step": 1,
                    "title": "Срок окупаемости",
                    "expression": FORMULAS_RU["payback"],
                    "values": {
                        "capex": capex.get("capex"),
                        "annual_effect": effect.get("annual_effect"),
                    },
                    "result": payback.get("payback_years"),
                    "message": payback.get("message"),
                }
            ],
            "formula": FORMULAS_RU["payback"],
        },
        "roi": {
            "metric": "roi",
            "value": roi.get("roi_percent"),
            "steps": [
                {
                    "step": 1,
                    "title": "ROI",
                    "expression": FORMULAS_RU["roi"],
                    "values": {
                        "cumulative_effect": (effect.get("annual_effect") or 0)
                        * int((tco.get("years") or inputs.get("years") or 5)),
                        "capex": capex.get("capex"),
                    },
                    "result": roi.get("roi_percent"),
                    "message": roi.get("message"),
                }
            ],
            "formula": FORMULAS_RU["roi"],
        },
        "tco": {
            "metric": "tco",
            "value": tco.get("tco"),
            "steps": [
                {
                    "step": 1,
                    "title": "Совокупная стоимость владения",
                    "expression": FORMULAS_RU["tco"],
                    "values": {
                        "capex": capex.get("capex"),
                        "opex_annual": opex.get("opex_annual"),
                        "years": tco.get("years"),
                    },
                    "result": tco.get("tco"),
                }
            ],
            "formula": FORMULAS_RU["tco"],
        },
        "formulas": FORMULAS_RU,
    }


def sensitivity_analysis(
    base_kwargs: dict,
    parameter: str,
    values: list[float],
) -> dict[str, Any]:
    """Пересчёт полного сценария при вариации одного параметра.

    Прямые kwargs calculate_scenario: utilization, peak_demand, unit_price, …
    Через overrides: current_labor_cost_year, labor_reduction_share, …
    Также: parameter=\"override_<key>\" → overrides[key].
    """
    direct = {
        "utilization",
        "availability",
        "reserve",
        "years",
        "peak_demand",
        "productivity",
        "robots_count",
        "unit_price",
        "software_cost",
        "maintenance_year",
        "implementation_cost",
        "scenario",
    }
    via_overrides = {
        "current_labor_cost_year",
        "labor_reduction_share",
        "additional_revenue",
        "raas_monthly_per_robot",
    }
    rows = []
    for v in values:
        kw = {**base_kwargs}
        kw["overrides"] = dict(base_kwargs.get("overrides") or {})
        kw["assumptions"] = dict(base_kwargs.get("assumptions") or {})
        if parameter in direct:
            kw[parameter] = v
        elif parameter in via_overrides or parameter.startswith("override_"):
            key = parameter.replace("override_", "") if parameter.startswith("override_") else parameter
            kw["overrides"][key] = v
        else:
            # неизвестный ключ — в overrides, чтобы не ронять API
            kw["overrides"][parameter] = v
        result = calculate_scenario(**kw)
        rows.append(
            {
                "parameter": parameter,
                "value": v,
                "capex": result["capex"]["capex"],
                "opex_annual": result["opex"]["opex_annual"],
                "annual_effect": result["annual_effect"]["annual_effect"],
                "payback_years": result["payback"].get("payback_years"),
                "roi_percent": result["roi"].get("roi_percent"),
                "tco": result["tco"]["tco"],
                "robots_count": result["robots_count"],
            }
        )
    return {
        "parameter": parameter,
        "values": values,
        "rows": rows,
        "formula_note": (
            "Чувствительность: полный пересчёт сценария при изменении одного параметра "
            "(стоимость оборудования / объём операций / стоимость труда и др.)"
        ),
    }


def get_formulas() -> dict[str, str]:
    return dict(FORMULAS_RU)
