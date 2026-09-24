"""Движок подбора роботов с объяснениями на русском."""

from __future__ import annotations

from typing import Any, Optional


def _get_param(params: dict, *keys, default=None):
    for k in keys:
        if k in params and params[k] is not None:
            return params[k]
    return default


def _estimate_shift_hours(params: dict) -> Optional[float]:
    """Длительность одной смены в часах (для проверки автономности с учётом зарядки)."""
    mode = str(_get_param(params, "work_mode", default="") or "").strip().lower()
    explicit = _get_param(params, "shift_hours", "shift_duration_h")
    if explicit is not None:
        try:
            return float(explicit)
        except (TypeError, ValueError):
            pass
    mapping = {
        "1с": 8.0,
        "1смен": 8.0,
        "1": 8.0,
        "2с": 8.0,
        "2смен": 8.0,
        "2": 8.0,
        "3с": 8.0,
        "3смен": 8.0,
        "3": 8.0,
        "24/7": 8.0,
        "24x7": 8.0,
    }
    if mode in mapping:
        return mapping[mode]
    shifts = _get_param(params, "shifts_count")
    if shifts is not None:
        return 8.0
    return None


def _mark_needs_review(status: str) -> str:
    if status == "excluded":
        return status
    return "needs_review"


def _norm_text(value: Any) -> str:
    return str(value or "").strip().lower().replace("ё", "е")


def _soft_contains(haystack: Any, needle: Any) -> bool:
    h, n = _norm_text(haystack), _norm_text(needle)
    if not h or not n:
        return False
    return n in h or h in n


def match_robot_to_project(
    robot: Any,
    object_params: dict,
    object_type_code: Optional[str] = None,
) -> dict[str, Any]:
    """
    Жёсткие исключения — только при конфликте, когда есть данные с обеих сторон:
    грузоподъёмность, ширина прохода, тип объекта, процессы, температура/влажность.

    Отсутствующие ТТХ у робота → needs_review / warning, НЕ exclude.
    """
    params = object_params or {}
    reasons: list[str] = []
    warnings: list[str] = []
    missing_checks: list[str] = []
    exclusions: list[str] = []
    status = "suitable"
    score = 100.0

    required_payload = _get_param(params, "required_payload_kg", "payload_kg", "max_payload_kg")
    aisle_width = _get_param(params, "aisle_width_mm", "min_aisle_width_mm", "corridor_width_mm")
    temp_min = _get_param(params, "temperature_min_c", "temp_min")
    temp_max = _get_param(params, "temperature_max_c", "temp_max")
    humidity_max = _get_param(params, "humidity_max_pct", "humidity_max")
    indoor = _get_param(params, "indoor", default=True)
    required_processes = _get_param(params, "required_processes", "processes", default=[]) or []
    required_navigation = _get_param(params, "required_navigation", "navigation")
    required_speed = _get_param(params, "required_speed_mps", "min_speed_mps", "speed_mps")
    floor_type = _get_param(params, "floor_type")
    charging_stations = _get_param(params, "charging_stations")
    industry_req = _get_param(params, "industry_raw", "industry", "industry_name")
    scenario_req = _get_param(params, "scenario_raw", "scenario", "use_case")

    oc = robot.operating_conditions or {}
    if not isinstance(oc, dict):
        oc = {}

    allowed_object_types = oc.get("object_types") or oc.get("supported_object_types")

    # Object type: hard exclude only when both sides have data
    if object_type_code and allowed_object_types:
        if object_type_code not in allowed_object_types:
            exclusions.append(
                f"✕ Несоответствие типа объекта: требуется «{object_type_code}», "
                f"решение поддерживает: {', '.join(map(str, allowed_object_types))}"
            )
            score -= 40
    elif object_type_code and not allowed_object_types:
        status = _mark_needs_review(status)
        msg = "⚠ Тип объекта не проверен — нет данных в исходных материалах"
        warnings.append(msg)
        missing_checks.append("object_type")
        reasons.append(msg)
        score -= 8

    # Payload: missing → needs_review; conflict → exclude
    if required_payload is not None:
        if robot.payload_kg is None:
            status = _mark_needs_review(status)
            msg = "⚠ Грузоподъёмность не проверена — нет данных в исходных материалах"
            warnings.append(msg)
            missing_checks.append("payload_kg")
            reasons.append(msg)
            score -= 15
        elif robot.payload_kg < float(required_payload):
            exclusions.append(
                f"✕ Недостаточная грузоподъёмность: {robot.payload_kg} кг < требуемых {required_payload} кг"
            )
            score -= 50
        else:
            reasons.append(
                f"✓ Грузоподъёмность достаточна: {robot.payload_kg} кг ≥ {required_payload} кг"
            )
            score += 5

    # Width: missing → needs_review; conflict → exclude
    if aisle_width is not None:
        if robot.width_mm is None:
            status = _mark_needs_review(status)
            msg = "⚠ Ширина не проверена — нет данных в исходных материалах"
            warnings.append(msg)
            missing_checks.append("width_mm")
            reasons.append(msg)
            score -= 10
        elif robot.width_mm > float(aisle_width):
            exclusions.append(
                f"✕ Робот не проходит по ширине прохода: {robot.width_mm} мм > {aisle_width} мм"
            )
            score -= 50
        else:
            reasons.append(
                f"✓ Ширина робота {robot.width_mm} мм укладывается в проход {aisle_width} мм"
            )
            score += 5

    # Operating conditions
    r_tmin = oc.get("temperature_min_c")
    r_tmax = oc.get("temperature_max_c")
    r_hum = oc.get("humidity_max_pct")
    r_indoor = oc.get("indoor")

    if temp_min is not None and r_tmin is not None and float(temp_min) < float(r_tmin):
        exclusions.append(
            f"✕ Температура объекта ниже допуска робота: {temp_min}°C < {r_tmin}°C"
        )
        score -= 30
    if temp_max is not None and r_tmax is not None and float(temp_max) > float(r_tmax):
        exclusions.append(
            f"✕ Температура объекта выше допуска робота: {temp_max}°C > {r_tmax}°C"
        )
        score -= 30
    if humidity_max is not None and r_hum is not None and float(humidity_max) > float(r_hum):
        exclusions.append(
            f"✕ Влажность объекта выше допуска: {humidity_max}% > {r_hum}%"
        )
        score -= 25

    if (temp_min is not None or temp_max is not None) and r_tmin is None and r_tmax is None:
        status = _mark_needs_review(status)
        msg = "⚠ Условия эксплуатации не проверены — нет данных в исходных материалах"
        warnings.append(msg)
        missing_checks.append("operating_conditions")
        reasons.append(msg)
        score -= 10
    elif not exclusions and (r_tmin is not None or r_tmax is not None):
        reasons.append("✓ Условия эксплуатации совместимы")
        score += 5

    # Soft: indoor mismatch
    if indoor is False and r_indoor is True:
        status = _mark_needs_review(status)
        msg = "⚠ Требуется работа на улице, а робот заявлен только для помещений — нужна проверка"
        warnings.append(msg)
        reasons.append(msg)
        score -= 15
    elif indoor is False and r_indoor is False:
        reasons.append("✓ Робот допускает работу на открытом воздухе")
        score += 5
    elif indoor is False and r_indoor is None:
        reasons.append("✓ Робот допускает работу в помещении и на улице")
        score += 5
    elif indoor is True and r_indoor is False:
        status = _mark_needs_review(status)
        msg = "⚠ Объект в помещении, а робот ориентирован на улицу — требуется проверка"
        warnings.append(msg)
        reasons.append(msg)
        score -= 8

    # Floor type
    robot_floors = oc.get("floor_types") or oc.get("floor_type")
    if floor_type:
        if not robot_floors:
            status = _mark_needs_review(status)
            msg = "⚠ Тип покрытия не проверен — нет данных в исходных материалах"
            warnings.append(msg)
            missing_checks.append("floor_type")
            reasons.append(msg)
            score -= 8
        else:
            floors_list = robot_floors if isinstance(robot_floors, list) else [robot_floors]
            floors_norm = [str(f).lower() for f in floors_list]
            if str(floor_type).lower() not in floors_norm:
                status = _mark_needs_review(status)
                msg = (
                    f"⚠ Несоответствие типа покрытия: объект «{floor_type}», "
                    f"робот допускает: {', '.join(map(str, floors_list))}"
                )
                warnings.append(msg)
                reasons.append(msg)
                score -= 10
            else:
                reasons.append(f"✓ Тип покрытия «{floor_type}» совместим")
                score += 3

    # Soft: missing key commercial/tech data (informational)
    missing = []
    for field, label in [
        ("price_rub", "цена"),
        ("productivity_ops_per_hour", "производительность"),
        ("speed_mps", "скорость"),
    ]:
        if getattr(robot, field, None) is None:
            missing.append(label)
    if missing:
        status = _mark_needs_review(status)
        msg = (
            "⚠ В исходных материалах отсутствуют данные о: " + ", ".join(missing)
        )
        warnings.append(msg)
        for label in missing:
            key = {"цена": "price_rub", "производительность": "productivity_ops_per_hour", "скорость": "speed_mps"}.get(
                label, label
            )
            if key not in missing_checks:
                missing_checks.append(key)
        reasons.append(msg)
        score -= 5 * len(missing)

    # Processes: hard exclude only when both sides have data
    supported = robot.supported_processes or []
    if required_processes and supported:
        matched = [p for p in required_processes if p in supported]
        if not matched:
            exclusions.append(
                f"✕ Нет поддержки требуемых процессов: {', '.join(map(str, required_processes))}"
            )
            score -= 35
        else:
            reasons.append(f"✓ Поддерживаемые процессы: {', '.join(map(str, matched))}")
            score += 5 * len(matched)
    elif required_processes and not supported:
        status = _mark_needs_review(status)
        msg = "⚠ Процессы не проверены — нет данных в исходных материалах"
        warnings.append(msg)
        missing_checks.append("supported_processes")
        reasons.append(msg)
        score -= 8

    # Navigation
    if required_navigation:
        robot_nav = getattr(robot, "navigation", None)
        if not robot_nav:
            status = _mark_needs_review(status)
            msg = "⚠ Навигация не проверена — нет данных в исходных материалах"
            warnings.append(msg)
            missing_checks.append("navigation")
            reasons.append(msg)
            score -= 8
        elif str(required_navigation).lower() not in str(robot_nav).lower():
            status = _mark_needs_review(status)
            msg = (
                f"⚠ Навигация робота «{robot_nav}» может не соответствовать требованию "
                f"«{required_navigation}»"
            )
            warnings.append(msg)
            reasons.append(msg)
            score -= 8
        else:
            reasons.append(f"✓ Навигация совместима: {robot_nav}")
            score += 3

    # Speed (soft / missing)
    if required_speed is not None:
        robot_speed = getattr(robot, "speed_mps", None)
        if robot_speed is None:
            status = _mark_needs_review(status)
            msg = "⚠ Скорость не проверена — нет данных в исходных материалах"
            warnings.append(msg)
            if "speed_mps" not in missing_checks:
                missing_checks.append("speed_mps")
            reasons.append(msg)
            score -= 8
        elif float(robot_speed) < float(required_speed):
            status = _mark_needs_review(status)
            msg = (
                f"⚠ Скорость робота {robot_speed} м/с ниже требуемой {required_speed} м/с — "
                "требуется проверка"
            )
            warnings.append(msg)
            reasons.append(msg)
            score -= 10
        else:
            reasons.append(f"✓ Скорость достаточна: {robot_speed} м/с ≥ {required_speed} м/с")
            score += 3

    # Autonomy vs shift hours
    shift_hours = _estimate_shift_hours(params)
    autonomy = getattr(robot, "autonomy_hours", None)
    has_charging = False
    try:
        has_charging = charging_stations is not None and int(charging_stations) > 0
    except (TypeError, ValueError):
        has_charging = False
    if shift_hours is not None and autonomy is not None:
        if float(autonomy) < float(shift_hours):
            if has_charging:
                reasons.append(
                    f"ℹ Автономность {autonomy} ч меньше смены {shift_hours} ч — "
                    "требуется плановая зарядка на объекте"
                )
            else:
                status = _mark_needs_review(status)
                msg = (
                    f"⚠ Автономность {autonomy} ч меньше длительности смены {shift_hours} ч — "
                    "нужна зарядная инфраструктура"
                )
                warnings.append(msg)
                reasons.append(msg)
                score -= 10
        else:
            reasons.append(f"✓ Автономность {autonomy} ч достаточна для смены {shift_hours} ч")
            score += 3
    elif shift_hours is not None and autonomy is None:
        status = _mark_needs_review(status)
        msg = "⚠ Автономность не проверена — нет данных в исходных материалах"
        warnings.append(msg)
        missing_checks.append("autonomy_hours")
        reasons.append(msg)
        score -= 5

    # Charging infrastructure
    if charging_stations is not None:
        try:
            if int(charging_stations) == 0:
                status = _mark_needs_review(status)
                msg = "⚠ На объекте нет зарядных станций — требуется инфраструктура для зарядки"
                warnings.append(msg)
                reasons.append(msg)
                score -= 12
            else:
                reasons.append(f"✓ Зарядные станции на объекте: {charging_stations}")
                score += 2
        except (TypeError, ValueError):
            pass

    # Soft industry / scenario match
    robot_industry = getattr(robot, "industry_raw", None)
    robot_scenario = getattr(robot, "scenario_raw", None)
    if industry_req and robot_industry and _soft_contains(robot_industry, industry_req):
        reasons.append(f"✓ Отрасль совместима: {robot_industry}")
        score += 8
    if scenario_req and robot_scenario and _soft_contains(robot_scenario, scenario_req):
        reasons.append(f"✓ Сценарий совместим: {robot_scenario}")
        score += 8

    # Productivity vs peak
    peak = _get_param(params, "peak_demand", "peak_ops_per_hour")
    if peak is not None and robot.productivity_ops_per_hour:
        prod = float(robot.productivity_ops_per_hour)
        peak_f = float(peak)
        if prod >= peak_f * 0.1:
            reasons.append(
                f"✓ Производительность {prod} оп/ч достаточна относительно пика {peak_f} "
                f"(оценка парка: ceil(пик / эфф.произв.))"
            )
            score += 5
        else:
            reasons.append(
                f"ℹ Производительность {prod} оп/ч низкая относительно пика {peak_f} — "
                "потребуется больший парк"
            )

    if exclusions:
        status = "excluded"
        score = min(score, 40)

    score = max(0.0, min(100.0, score))
    if status == "suitable" and not reasons:
        reasons.append("✓ Базовые критерии выполнены")

    return {
        "robot_id": robot.id,
        "status": status,
        "match_score": round(score, 2),
        "match_reasons": reasons,
        "exclusion_reasons": exclusions,
        "warnings": warnings,
        "missing_checks": missing_checks,
    }


def run_matching(
    robots: list[Any],
    object_params: dict,
    object_type_code: Optional[str] = None,
) -> list[dict[str, Any]]:
    results = [
        match_robot_to_project(r, object_params, object_type_code)
        for r in robots
        if not getattr(r, "archived", False)
    ]
    order = {"suitable": 0, "needs_review": 1, "excluded": 2}
    results.sort(key=lambda x: (order.get(x["status"], 9), -x["match_score"]))
    return results
