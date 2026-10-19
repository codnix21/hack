"""Сравнение конфигураций парка (N роботов) без перезаписи проекта."""

from __future__ import annotations

from typing import Any, Optional

from app.services.economics import calculate_scenario


def estimate_ops_metrics(
    *,
    robots_count: int,
    peak_demand: float,
    productivity: float,
    utilization: float,
    availability: float,
) -> dict[str, Any]:
    """Оценочные метрики пропускной способности (не телеметрия симуляции)."""
    effective = productivity * utilization * availability
    fleet_capacity = effective * max(0, robots_count)
    coverage = (fleet_capacity / peak_demand) if peak_demand > 0 else None
    idle = None
    if fleet_capacity > 0 and peak_demand >= 0:
        idle = max(0.0, 1.0 - min(1.0, peak_demand / fleet_capacity))
    load = None
    if fleet_capacity > 0:
        load = min(1.0, peak_demand / fleet_capacity)
    meets = coverage is not None and coverage >= 1.0
    note = (
        "Оценка по формуле парка (оп/ч), не результат дискретной симуляции. "
        "Рост числа роботов не даёт пропорциональный рост, если узкое место — "
        "проходы, зарядка или пиковый спрос уже покрыт."
    )
    bottlenecks: list[str] = []
    if coverage is not None and coverage < 1:
        bottlenecks.append(
            f"Расчётная производительность парка покрывает {coverage * 100:.0f}% пика"
        )
    if robots_count >= 8:
        bottlenecks.append(
            "При большом парке вероятны очереди у зарядки и в узких проходах — проверьте план"
        )
    return {
        "fleet_capacity_ops_per_hour": round(fleet_capacity, 2),
        "peak_coverage": round(coverage, 3) if coverage is not None else None,
        "meets_peak_demand": meets,
        "utilization_estimate": round(load, 3) if load is not None else None,
        "idle_estimate": round(idle, 3) if idle is not None else None,
        "estimated": True,
        "note": note,
        "bottlenecks": bottlenecks,
    }


def compare_fleet_counts(
    counts: list[int],
    *,
    peak_demand: float,
    productivity: float,
    unit_price: float,
    software_cost: float = 0.0,
    maintenance_year: float = 0.0,
    implementation_cost: float = 0.0,
    utilization: float = 0.85,
    availability: float = 0.95,
    reserve: float = 0.10,
    years: int = 5,
    assumptions: Optional[dict] = None,
    overrides: Optional[dict] = None,
    robot_id: Optional[int] = None,
) -> dict[str, Any]:
    rows = []
    for n in counts:
        n = int(n)
        if n < 0 or n > 200:
            raise ValueError(f"Некорректное количество роботов: {n}")
        econ = calculate_scenario(
            scenario="purchase",
            peak_demand=peak_demand,
            productivity=productivity,
            unit_price=unit_price,
            software_cost=software_cost,
            maintenance_year=maintenance_year,
            implementation_cost=implementation_cost,
            robots_count=n,
            utilization=utilization,
            availability=availability,
            reserve=reserve,
            years=years,
            assumptions=assumptions,
            overrides=overrides,
        )
        ops = estimate_ops_metrics(
            robots_count=n,
            peak_demand=peak_demand,
            productivity=productivity,
            utilization=utilization,
            availability=availability,
        )
        rows.append(
            {
                "code": f"fleet_{n}",
                "name_ru": f"{n} роботов",
                "robots_count": n,
                "economics": econ,
                "operations": ops,
                "robot_id": robot_id,
                "missing": _missing_fields(econ),
            }
        )

    insight = (
        "Сравнение использует один план склада и одни финансовые допущения. "
        "Увеличение парка повышает CAPEX и часто снижает загрузку единицы; "
        "эффект на окупаемость зависит от пикового спроса и стоимости труда."
    )
    return {
        "counts": counts,
        "rows": rows,
        "insight": insight,
        "shared": {
            "peak_demand": peak_demand,
            "productivity": productivity,
            "utilization": utilization,
            "availability": availability,
            "years": years,
        },
    }


def _missing_fields(econ: dict) -> list[str]:
    missing = []
    if econ.get("payback", {}).get("payback_years") is None:
        missing.append("срок окупаемости: " + str(econ.get("payback", {}).get("message") or "не определён"))
    if econ.get("irr", {}).get("irr") is None:
        missing.append("IRR: " + str(econ.get("irr", {}).get("message") or "не определён"))
    if econ.get("npv", {}).get("npv") is None:
        missing.append("NPV недоступен")
    return missing
