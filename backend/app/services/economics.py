"""Прозрачный расчёт экономики робототехнических решений."""

from __future__ import annotations

import math
from typing import Any, Optional


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
    "payback": "срок_окупаемости_лет = CAPEX / годовой_эффект (если годовой_эффект > 0)",
    "roi": "ROI_% = накопленный_эффект / CAPEX * 100",
    "tco": "TCO = CAPEX + OPEX_год * горизонт_лет",
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
    return {
        "capex": round(total, 2),
        "breakdown": breakdown,
        "formula": FORMULAS_RU["capex"],
        "assumptions_used": {
            "infra_share_of_equipment": a["infra_share_of_equipment"],
            "integration_share": a["integration_share"],
            "commissioning_share": a["commissioning_share"],
            "training_per_robot": a["training_per_robot"],
            "contingency_share": a["contingency_share"],
        },
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


def calc_payback(capex: float, annual_effect: float) -> dict[str, Any]:
    if annual_effect <= 0:
        return {
            "payback_years": None,
            "message": "Окупаемость не определена: годовой эффект ≤ 0",
            "formula": FORMULAS_RU["payback"],
        }
    return {
        "payback_years": round(capex / annual_effect, 2),
        "formula": FORMULAS_RU["payback"],
    }


def calc_roi(cumulative_effect: float, capex: float) -> dict[str, Any]:
    if capex <= 0:
        return {"roi_percent": None, "message": "CAPEX должен быть больше 0", "formula": FORMULAS_RU["roi"]}
    return {
        "roi_percent": round(cumulative_effect / capex * 100, 2),
        "formula": FORMULAS_RU["roi"],
    }


def calc_tco(capex: float, opex_annual: float, years: int = 5) -> dict[str, Any]:
    return {
        "tco": round(capex + opex_annual * years, 2),
        "years": years,
        "formula": FORMULAS_RU["tco"],
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
    n = robots_count if robots_count is not None else count_info["robots_count"]

    current_labor = o.get("current_labor_cost_year", a["current_labor_cost_year"])
    current_labor = _ensure_non_negative("Текущие затраты на труд", float(current_labor))
    labor_reduction = o.get("labor_reduction_share", a["labor_reduction_share"])
    additional_revenue = o.get("additional_revenue", a["additional_revenue"])
    additional_revenue = _ensure_non_negative("Доп. выручка", float(additional_revenue))

    if scenario == "baseline":
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
            "annual_effect": calc_annual_effect(0, 0, 0),
            "payback": calc_payback(0, 0),
            "roi": calc_roi(0, 1),
            "tco": calc_tco(0, current_labor, years),
            "assumptions": a,
            "formulas": FORMULAS_RU,
        }
        result["annual_effect"] = {
            "annual_effect": 0.0,
            "components": {
                "current_cost_reduction": 0.0,
                "additional_revenue": 0.0,
                "incremental_opex": 0.0,
            },
            "formula": FORMULAS_RU["annual_effect"],
            "note": "В базовом сценарии эффект автоматизации = 0",
        }
        return result

    equipment = unit_price * n + implementation_cost
    software_total = software_cost * n if software_cost else 0.0

    if scenario == "raas":
        monthly = o.get("raas_monthly_per_robot", a["raas_monthly_per_robot"])
        raas_year = monthly * 12 * n
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

    cost_reduction = current_labor * labor_reduction
    incremental_opex = opex_info["opex_annual"] - (current_labor * (1 - labor_reduction))
    # Более прозрачно: прирост OPEX = новый OPEX − оставшиеся ручные затраты
    remaining_labor = current_labor * (1 - labor_reduction)
    incremental = opex_info["opex_annual"]  # относительно нулевого OPEX роботов; эффект считает reduction отдельно
    effect_info = calc_annual_effect(cost_reduction, additional_revenue, opex_info["opex_annual"] - remaining_labor + remaining_labor - cost_reduction)
    # Simplify: annual_effect = cost_reduction + additional_revenue - opex_robots
    # where baseline labor is reduced; incremental opex is robot opex (manual remaining stays in baseline comparison)
    effect_info = calc_annual_effect(
        current_cost_reduction=cost_reduction,
        additional_revenue=additional_revenue,
        incremental_opex=opex_info["opex_annual"],
    )
    # Better economic meaning: effect vs baseline labor
    # annual_effect = (baseline_labor - remaining_labor) + revenue - robot_opex
    # = cost_reduction + revenue - robot_opex
    # That's what we have if incremental_opex = robot opex. Good.

    payback = calc_payback(capex_info["capex"], effect_info["annual_effect"])
    cumulative = effect_info["annual_effect"] * years - (opex_info["opex_annual"] * 0)  # cumulative net effect
    # ROI: (annual_effect * years - 0) / CAPEX — иногда считают без вычета CAPEX в числителе как накопленный эффект
    cumulative_effect = effect_info["annual_effect"] * years
    roi = calc_roi(cumulative_effect, capex_info["capex"] if capex_info["capex"] > 0 else 1)
    tco = calc_tco(capex_info["capex"], opex_info["opex_annual"], years)

    return {
        "scenario": scenario,
        "scenario_name_ru": scenario_name,
        "robots_count": n,
        "robots_count_detail": count_info,
        "capex": capex_info,
        "opex": opex_info,
        "annual_effect": effect_info,
        "payback": payback,
        "roi": roi,
        "tco": tco,
        "remaining_manual_labor_cost": round(remaining_labor, 2),
        "assumptions": a,
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
            "years": years,
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
    rows = []
    for v in values:
        kw = {**base_kwargs, parameter: v}
        # Map nested overrides
        if parameter in ("utilization", "availability", "reserve", "years", "peak_demand", "productivity", "robots_count"):
            pass
        elif parameter.startswith("override_"):
            key = parameter.replace("override_", "")
            overrides = dict(kw.get("overrides") or {})
            overrides[key] = v
            kw["overrides"] = overrides
            kw.pop(parameter, None)
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
        "formula_note": "Чувствительность: пересчёт полного сценария при изменении одного параметра",
    }


def get_formulas() -> dict[str, str]:
    return dict(FORMULAS_RU)
