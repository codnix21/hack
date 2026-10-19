"""
Единая модель обязательности входов для возможностей проекта.

Категории:
  required      — без значения соответствующий расчёт недостоверен / блокируется
  conditional   — нужно при выбранном сценарии / отсутствии альтернативы
  optional      — улучшает точность, не блокирует
  derived       — получается из других полей

Формулы экономики не меняются: модуль только валидирует наличие входов
до вызова calculate_scenario. Молчаливые демо-подстановки (peak=200,
цена 3.5M, труд 12M) при блокирующей проверке не считаются валидным вводом.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from app.services.labor_cost import resolve_current_labor_cost

Capability = Literal["economics", "matching", "layout", "des", "report"]
Severity = Literal["error", "warning"]
Category = Literal["required", "conditional", "optional", "derived"]


def _f(v: Any) -> Optional[float]:
    if v is None or v == "" or v is False:
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x != x or x in (float("inf"), float("-inf")):
        return None
    return x


def _present(v: Any) -> bool:
    if v is None or v == "":
        return False
    if isinstance(v, (list, dict)) and len(v) == 0:
        return False
    return True


def _issue(
    field: str,
    code: str,
    message: str,
    *,
    severity: Severity = "error",
    category: Category = "required",
    capability: Optional[Capability] = None,
) -> dict[str, Any]:
    return {
        "field": field,
        "code": code,
        "message": message,
        "severity": severity,
        "category": category,
        "capability": capability,
    }


FIELD_CATALOG: list[dict[str, Any]] = [
    {
        "field": "peak_demand",
        "aliases": ["peak_ops_per_hour"],
        "category": "required",
        "capabilities": ["economics", "matching", "des", "report"],
        "reason": "Пиковая нагрузка задаёт число роботов, CAPEX и покрытие пика",
        "group": "ops",
        "formula_refs": ["calc_robots_count", "fleet_capacity", "capex"],
    },
    {
        "field": "current_labor_cost_year",
        "aliases": ["staff_cost_year", "staff_count+salary"],
        "category": "conditional",
        "capabilities": ["economics", "report"],
        "reason": "Без затрат на персонал (явных или производных) годовой эффект недостоверен",
        "group": "staff",
        "formula_refs": ["annual_effect", "payback", "npv"],
    },
    {
        "field": "unit_price",
        "aliases": ["economics_robot_id", "selected_robot.price_rub", "assumed_unit_price"],
        "category": "conditional",
        "capabilities": ["economics", "report"],
        "reason": "Нужна цена из каталога или вручную — для расчёта CAPEX",
        "group": "ops",
        "formula_refs": ["calc_capex", "opex"],
    },
    {
        "field": "required_payload_kg",
        "category": "optional",
        "capabilities": ["matching"],
        "reason": "Улучшает отсев решений по грузоподъёмности",
        "group": "infra",
        "formula_refs": ["match_robot_to_project"],
    },
    {
        "field": "area_m2",
        "aliases": ["area_width_m+area_length_m"],
        "category": "conditional",
        "capabilities": ["layout", "des"],
        "reason": "Габариты площадки нужны для планировки и DES-сцены",
        "group": "area",
        "formula_refs": ["visualization.layout"],
    },
    {
        "field": "aisle_width_mm",
        "category": "optional",
        "capabilities": ["matching", "layout"],
        "reason": "Уточняет пригодность робота и проходы на плане",
        "group": "area",
        "formula_refs": ["match_robot_to_project"],
    },
    {
        "field": "staff_count",
        "category": "derived",
        "capabilities": ["economics"],
        "reason": "Вместе со ставкой даёт годовые затраты на персонал",
        "group": "staff",
        "formula_refs": ["derived_labor_from_headcount"],
    },
]


def peak_value(params: dict[str, Any]) -> Optional[float]:
    if _present(params.get("peak_demand")):
        return _f(params.get("peak_demand"))
    return _f(params.get("peak_ops_per_hour"))


def has_labor_source(params: dict[str, Any]) -> tuple[bool, str]:
    meta = resolve_current_labor_cost(params, assumption_default=12_000_000.0)
    origin = str(meta.get("labor_cost_origin") or "")
    if origin == "model_assumption":
        return False, origin
    return True, origin


def has_price_source(
    params: dict[str, Any],
    *,
    robot_price: Optional[float] = None,
) -> tuple[bool, str]:
    if robot_price is not None and robot_price > 0:
        return True, "robot.price_rub"
    up = _f(params.get("unit_price"))
    if up is not None and up > 0:
        return True, "unit_price"
    assumed = _f(params.get("assumed_unit_price"))
    if assumed is not None and assumed > 0:
        return True, "assumed_unit_price"
    return False, "missing"


def has_area(params: dict[str, Any]) -> bool:
    a = _f(params.get("area_m2"))
    if a is not None and a > 0:
        return True
    w = _f(params.get("area_width_m"))
    length = _f(params.get("area_length_m"))
    return w is not None and length is not None and w > 0 and length > 0


def _range_issues(field: str, value: Any, *, min_value: float = 0.0) -> list[dict[str, Any]]:
    if not _present(value):
        return []
    num = _f(value)
    if num is None:
        return [
            _issue(
                field,
                "invalid_type",
                f"Поле «{field}» должно быть конечным числом",
                severity="error",
            )
        ]
    out: list[dict[str, Any]] = []
    if num < min_value:
        out.append(
            _issue(
                field,
                "out_of_range",
                f"Значение «{field}» не может быть меньше {min_value}",
                severity="error",
            )
        )
    # Мягкий контроль единиц: пик > 1e7 оп/ч почти наверняка ошибка единиц
    if field in ("peak_demand", "peak_ops_per_hour") and num > 10_000_000:
        out.append(
            _issue(
                field,
                "out_of_range",
                "Пиковая нагрузка выглядит нереалистично большой — проверьте единицы (оп/ч)",
                severity="error",
            )
        )
    if field in ("current_labor_cost_year", "staff_cost_year", "unit_price", "assumed_unit_price"):
        if num > 1e15:
            out.append(
                _issue(
                    field,
                    "out_of_range",
                    f"Значение «{field}» слишком велико — проверьте единицы (₽)",
                    severity="error",
                )
            )
    return out


def validate_for_economics(
    params: dict[str, Any],
    *,
    robot_price: Optional[float] = None,
    has_selected_robot: bool = False,
    req_peak: Optional[float] = None,
) -> dict[str, Any]:
    """Блокирующие ошибки и предупреждения для расчёта экономики."""
    params = params or {}
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    peak = req_peak if req_peak is not None else peak_value(params)
    if peak is None:
        errors.append(
            _issue(
                "peak_demand",
                "required",
                "Укажите пиковую нагрузку (оп/ч). Без неё число роботов и CAPEX не рассчитываются "
                "из данных объекта (молчание модели не используется).",
                capability="economics",
            )
        )
    else:
        errors.extend(_range_issues("peak_demand", peak, min_value=0.0))
        if peak <= 0:
            errors.append(
                _issue(
                    "peak_demand",
                    "out_of_range",
                    "Пиковая нагрузка должна быть больше нуля",
                    capability="economics",
                )
            )
        if params.get("peak_demand_is_estimate"):
            warnings.append(
                _issue(
                    "peak_demand",
                    "assumption",
                    "Пиковая нагрузка оценена из суточного объёма — не измерение на объекте",
                    severity="warning",
                    category="optional",
                    capability="economics",
                )
            )

    labor_ok, labor_origin = has_labor_source(params)
    if not labor_ok:
        errors.append(
            _issue(
                "current_labor_cost_year",
                "required",
                "Укажите годовые затраты на персонал (₽/год) либо численность и ставку "
                "(з/п в месяц или годовая ставка). Допущение модели 12 млн ₽/год "
                "не подставляется как данные объекта.",
                category="conditional",
                capability="economics",
            )
        )
    else:
        if labor_origin.startswith("derived"):
            warnings.append(
                _issue(
                    "current_labor_cost_year",
                    "derived",
                    f"Затраты на персонал рассчитаны производно ({labor_origin})",
                    severity="warning",
                    category="derived",
                    capability="economics",
                )
            )
        for key in ("current_labor_cost_year", "staff_cost_year", "staff_count", "staff_salary_month"):
            if _present(params.get(key)):
                errors.extend(_range_issues(key, params.get(key), min_value=0.0))

    price_ok, price_origin = has_price_source(params, robot_price=robot_price)
    if not price_ok:
        msg = (
            "Условно обязательное поле: выберите решение с ценой в каталоге («В расчёт») "
            "или укажите цену вручную. Скрытое демо-допущение 3.5 млн ₽ не используется."
        )
        if has_selected_robot and (robot_price is None or robot_price <= 0):
            msg = (
                "У выбранного решения нет цены в каталоге. Укажите цену вручную "
                "или выберите другое решение."
            )
        errors.append(
            _issue(
                "unit_price",
                "required",
                msg,
                category="conditional",
                capability="economics",
            )
        )
    elif price_origin == "assumed_unit_price":
        warnings.append(
            _issue(
                "assumed_unit_price",
                "assumption",
                "Используется принятая цена (явное допущение) — не коммерческое предложение",
                severity="warning",
                category="conditional",
                capability="economics",
            )
        )

    # Согласованность: ширина/длина vs площадь (мягко)
    a = _f(params.get("area_m2"))
    w = _f(params.get("area_width_m"))
    length = _f(params.get("area_length_m"))
    if a and w and length and w > 0 and length > 0:
        derived = w * length
        if derived > 0 and abs(derived - a) / max(derived, a) > 0.35:
            warnings.append(
                _issue(
                    "area_m2",
                    "inconsistent",
                    "Площадь заметно расходится с шириной×длиной — проверьте единицы",
                    severity="warning",
                    category="optional",
                    capability="layout",
                )
            )

    ready = len(errors) == 0
    required_checklist = _economics_checklist(params, robot_price=robot_price)
    return {
        "capability": "economics",
        "ready": ready,
        "errors": errors,
        "warnings": warnings,
        "checklist": required_checklist,
        "filled_required": sum(1 for c in required_checklist if c["filled"]),
        "total_required": len(required_checklist),
    }


def _economics_checklist(
    params: dict[str, Any],
    *,
    robot_price: Optional[float] = None,
) -> list[dict[str, Any]]:
    peak_ok = peak_value(params) is not None and (peak_value(params) or 0) > 0
    labor_ok, _ = has_labor_source(params)
    price_ok, _ = has_price_source(params, robot_price=robot_price)
    return [
        {
            "field": "peak_demand",
            "label": "Пиковая нагрузка",
            "filled": peak_ok,
            "category": "required",
            "reason": "Число роботов и CAPEX",
        },
        {
            "field": "current_labor_cost_year",
            "label": "Затраты на персонал",
            "filled": labor_ok,
            "category": "conditional",
            "reason": "Годовой эффект и окупаемость",
        },
        {
            "field": "unit_price",
            "label": "Цена решения",
            "filled": price_ok,
            "category": "conditional",
            "reason": "Нужна цена из каталога или вручную — для CAPEX",
        },
    ]


def validate_for_matching(params: dict[str, Any]) -> dict[str, Any]:
    params = params or {}
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    # Подбор можно запускать почти всегда; предупреждаем о слабых фильтрах
    if peak_value(params) is None:
        warnings.append(
            _issue(
                "peak_demand",
                "optional_missing",
                "Без пиковой нагрузки оценка парка в подборе будет ограничена",
                severity="warning",
                category="optional",
                capability="matching",
            )
        )
    if not _present(params.get("required_payload_kg")):
        warnings.append(
            _issue(
                "required_payload_kg",
                "optional_missing",
                "Без требуемой грузоподъёмности отсев решений слабее",
                severity="warning",
                category="optional",
                capability="matching",
            )
        )
    return {
        "capability": "matching",
        "ready": True,
        "errors": errors,
        "warnings": warnings,
        "checklist": [],
        "filled_required": 0,
        "total_required": 0,
    }


def validate_for_layout(
    params: dict[str, Any],
    *,
    has_layout_objects: bool = False,
    layout_source: Optional[str] = None,
) -> dict[str, Any]:
    params = params or {}
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if not has_layout_objects and not has_area(params):
        errors.append(
            _issue(
                "area_m2",
                "required",
                "Укажите площадь или ширину и длину площадки для планировки",
                category="conditional",
                capability="layout",
            )
        )
    if layout_source == "default_example":
        warnings.append(
            _issue(
                "layout",
                "example_geometry",
                "На плане демо-пример геометрии, не обмер вашего объекта — уточните планировку перед DES/отчётом",
                severity="warning",
                category="optional",
                capability="layout",
            )
        )
    return {
        "capability": "layout",
        "ready": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "checklist": [
            {
                "field": "area_m2",
                "label": "Габариты площадки",
                "filled": has_area(params) or has_layout_objects,
                "category": "conditional",
                "reason": "Планировка / DES",
            }
        ],
        "filled_required": 1 if (has_area(params) or has_layout_objects) else 0,
        "total_required": 1,
    }


def assess_capabilities(
    params: dict[str, Any],
    *,
    robot_price: Optional[float] = None,
    has_selected_robot: bool = False,
    has_layout_objects: bool = False,
    has_economics_result: bool = False,
    req_peak: Optional[float] = None,
    layout_source: Optional[str] = None,
) -> dict[str, Any]:
    econ = validate_for_economics(
        params,
        robot_price=robot_price,
        has_selected_robot=has_selected_robot,
        req_peak=req_peak,
    )
    match = validate_for_matching(params)
    layout = validate_for_layout(
        params,
        has_layout_objects=has_layout_objects,
        layout_source=layout_source,
    )
    des_errors: list[dict[str, Any]] = []
    if not has_economics_result:
        des_errors.append(
            _issue(
                "economics",
                "dependency",
                "Сначала рассчитайте экономику — DES использует число роботов из расчёта",
                capability="des",
            )
        )
    if not layout["ready"] and not has_layout_objects:
        des_errors.append(
            _issue(
                "area_m2",
                "required",
                "Для DES нужны габариты площадки или сохранённый план",
                category="conditional",
                capability="des",
            )
        )
    des = {
        "capability": "des",
        "ready": len(des_errors) == 0,
        "errors": des_errors,
        "warnings": [],
        "checklist": [],
        "filled_required": 0,
        "total_required": 0,
    }

    report_errors: list[dict[str, Any]] = []
    if not has_economics_result:
        report_errors.append(
            _issue(
                "economics",
                "dependency",
                "Сформируйте расчёт экономики перед итоговым отчётом",
                capability="report",
            )
        )
    report = {
        "capability": "report",
        "ready": len(report_errors) == 0,
        "errors": report_errors,
        "warnings": econ["warnings"],
        "checklist": econ["checklist"],
        "filled_required": econ["filled_required"],
        "total_required": econ["total_required"],
    }

    return {
        "economics": econ,
        "matching": match,
        "layout": layout,
        "des": des,
        "report": report,
        "catalog": FIELD_CATALOG,
        "summary": {
            "economics_ready": econ["ready"],
            "matching_ready": match["ready"],
            "layout_ready": layout["ready"],
            "des_ready": des["ready"],
            "report_ready": report["ready"],
            "filled_required": econ["filled_required"],
            "total_required": econ["total_required"],
        },
    }
