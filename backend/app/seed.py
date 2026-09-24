"""Наполнение БД демо-данными."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.deps import hash_password
from app.models import (
    DataSource,
    Industry,
    Manufacturer,
    Normative,
    ObjectType,
    Project,
    Robot,
    Scenario,
    SolutionType,
    User,
)
from app.services.economics import DEFAULT_ASSUMPTIONS


WAREHOUSE_SCHEMA = {
    "type": "object",
    "properties": {
        "area_m2": {"type": "number", "title": "Площадь, м²"},
        "zones_count": {"type": "integer", "title": "Число зон, шт"},
        "work_mode": {"type": "string", "title": "Режим работы"},
        "shifts_count": {"type": "integer", "title": "Число смен, шт"},
        "staff_count": {"type": "integer", "title": "Численность персонала, чел"},
        "staff_cost_year": {"type": "number", "title": "Затраты на персонал, руб/год"},
        "ops_count": {"type": "number", "title": "Операций в сутки, оп/сут"},
        "peak_demand": {"type": "number", "title": "Пиковый спрос, оп/ч"},
        "avg_demand": {"type": "number", "title": "Средний спрос, оп/ч"},
        "sku_count": {"type": "integer", "title": "Число SKU, шт"},
        "required_payload_kg": {"type": "number", "title": "Требуемая грузоподъёмность, кг"},
        "cargo_length_mm": {"type": "number", "title": "Длина груза, мм"},
        "cargo_width_mm": {"type": "number", "title": "Ширина груза, мм"},
        "cargo_height_mm": {"type": "number", "title": "Высота груза, мм"},
        "aisle_width_mm": {"type": "number", "title": "Ширина прохода, мм"},
        "route_length_m": {"type": "number", "title": "Длина маршрута, м"},
        "floor_type": {"type": "string", "title": "Тип покрытия пола"},
        "temperature_min_c": {"type": "number", "title": "Мин. температура, °C"},
        "temperature_max_c": {"type": "number", "title": "Макс. температура, °C"},
        "charging_stations": {"type": "integer", "title": "Зарядные станции, шт"},
        "load_points": {"type": "integer", "title": "Точки погрузки, шт"},
        "unload_points": {"type": "integer", "title": "Точки разгрузки, шт"},
        "layout_constraints": {"type": "string", "title": "Ограничения планировки"},
        "area_width_m": {"type": "number", "title": "Ширина площадки, м"},
        "area_length_m": {"type": "number", "title": "Длина площадки, м"},
        "current_labor_cost_year": {"type": "number", "title": "Текущие затраты на труд, руб/год"},
        "required_processes": {
            "type": "array",
            "items": {"type": "string"},
            "title": "Требуемые процессы",
        },
        "indoor": {"type": "boolean", "title": "Работа в помещении"},
        "required_navigation": {"type": "string", "title": "Требуемая навигация"},
    },
}

AIRPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "passenger_flow": {"type": "number", "title": "Пассажиропоток, чел/сут"},
        "cargo_flow": {"type": "number", "title": "Грузопоток, т/сут"},
        "ops_count": {"type": "number", "title": "Операций в сутки, оп/сут"},
        "peak_demand": {"type": "number", "title": "Пиковый спрос, оп/ч"},
        "avg_demand": {"type": "number", "title": "Средний спрос, оп/ч"},
        "zones_count": {"type": "integer", "title": "Число зон, шт"},
        "route_length_m": {"type": "number", "title": "Длина маршрута, м"},
        "required_payload_kg": {"type": "number", "title": "Требуемая грузоподъёмность, кг"},
        "cargo_length_mm": {"type": "number", "title": "Длина груза, мм"},
        "cargo_width_mm": {"type": "number", "title": "Ширина груза, мм"},
        "cargo_height_mm": {"type": "number", "title": "Высота груза, мм"},
        "work_mode": {"type": "string", "title": "Режим работы"},
        "shifts_count": {"type": "integer", "title": "Число смен, шт"},
        "staff_count": {"type": "integer", "title": "Численность персонала, чел"},
        "access_constraints": {"type": "string", "title": "Ограничения доступа"},
        "security_requirements": {"type": "string", "title": "Требования безопасности"},
        "area_width_m": {"type": "number", "title": "Ширина площадки, м"},
        "area_length_m": {"type": "number", "title": "Длина площадки, м"},
        "aisle_width_mm": {"type": "number", "title": "Ширина прохода, мм"},
        "charging_stations": {"type": "integer", "title": "Зарядные станции, шт"},
        "indoor": {"type": "boolean", "title": "Работа в помещении"},
        "temperature_min_c": {"type": "number", "title": "Мин. температура, °C"},
        "temperature_max_c": {"type": "number", "title": "Макс. температура, °C"},
        "current_labor_cost_year": {"type": "number", "title": "Текущие затраты на труд, руб/год"},
        "required_processes": {
            "type": "array",
            "items": {"type": "string"},
            "title": "Требуемые процессы",
        },
        "zone_type": {"type": "string", "title": "Тип зоны"},
        "required_navigation": {"type": "string", "title": "Требуемая навигация"},
        "floor_type": {"type": "string", "title": "Тип покрытия"},
    },
}

MEDICAL_SCHEMA = {
    "type": "object",
    "properties": {
        "area_m2": {"type": "number", "title": "Площадь, м²"},
        "floors_count": {"type": "integer", "title": "Число этажей, шт"},
        "ops_count": {"type": "number", "title": "Операций в сутки, оп/сут"},
        "transport_count": {"type": "number", "title": "Транспортировок в сутки, шт"},
        "meds_share": {"type": "number", "title": "Доля медикаментов, %"},
        "meals_share": {"type": "number", "title": "Доля питания, %"},
        "linen_share": {"type": "number", "title": "Доля белья, %"},
        "waste_share": {"type": "number", "title": "Доля отходов, %"},
        "route_length_m": {"type": "number", "title": "Длина маршрута, м"},
        "elevators": {"type": "integer", "title": "Лифты, шт"},
        "sanitary_constraints": {"type": "string", "title": "Санитарные ограничения"},
        "work_mode": {"type": "string", "title": "Режим работы"},
        "staff_count": {"type": "integer", "title": "Численность персонала, чел"},
        "security_requirements": {"type": "string", "title": "Требования безопасности"},
        "area_width_m": {"type": "number", "title": "Ширина площадки, м"},
        "area_length_m": {"type": "number", "title": "Длина площадки, м"},
        "aisle_width_mm": {"type": "number", "title": "Ширина прохода, мм"},
        "required_payload_kg": {"type": "number", "title": "Требуемая грузоподъёмность, кг"},
        "peak_demand": {"type": "number", "title": "Пиковый спрос, оп/ч"},
        "charging_stations": {"type": "integer", "title": "Зарядные станции, шт"},
        "humidity_max_pct": {"type": "number", "title": "Макс. влажность, %"},
        "facility_type": {"type": "string", "title": "Тип учреждения"},
        "current_labor_cost_year": {"type": "number", "title": "Текущие затраты на труд, руб/год"},
        "required_processes": {
            "type": "array",
            "items": {"type": "string"},
            "title": "Требуемые процессы",
        },
        "indoor": {"type": "boolean", "title": "Работа в помещении"},
        "temperature_min_c": {"type": "number", "title": "Мин. температура, °C"},
        "temperature_max_c": {"type": "number", "title": "Макс. температура, °C"},
        "required_navigation": {"type": "string", "title": "Требуемая навигация"},
        "floor_type": {"type": "string", "title": "Тип покрытия пола"},
    },
}

# Роботы, способные работать на улице / перроне (indoor=False) или в обоих режимах (indoor=None)
OUTDOOR_CAPABLE_NAMES = {
    "MiR Hook 200",
    "OTTO Tugger",
    "Airport Clean X",
    "BD Stretch Yard",
    "OTTO Lifter Yard",
    "OTTO 1500",
    "RoboCV Fork-1.5",
    "MiR 600",
    "MiR 1350",
}
BOTH_ENV_NAMES = {
    "OTTO 1500",
    "MiR 600",
    "MiR 1350",
    "RoboCV Fork-1.5",
    "CleanBot Pro",
}


def _oc(object_types, tmin=-10, tmax=40, humidity=90, indoor=True, floor_types=None):
    data = {
        "object_types": object_types,
        "temperature_min_c": tmin,
        "temperature_max_c": tmax,
        "humidity_max_pct": humidity,
        "indoor": indoor,
    }
    if floor_types is not None:
        data["floor_types"] = floor_types
    return data


def seed_if_empty(db: Session) -> bool:
    """Idempotent bootstrap: structure once, then optional source imports."""
    created = False
    if not db.query(User).first():
        seed_all(db, import_sources=True)
        created = True
    else:
        # Existing DB: still try to load source materials without wiping demos
        _maybe_import_sources(db)
        _ensure_demo_projects_labeled(db)
        db.commit()
    return created


def _maybe_import_sources(db: Session) -> None:
    from app.services.import_source_catalog import import_source_catalog_if_needed
    from app.services.import_source_datasets import import_source_datasets_if_needed

    import_source_catalog_if_needed(db)
    import_source_datasets_if_needed(db)


def _ensure_demo_projects_labeled(db: Session) -> None:
    """Ensure demo project descriptions mention dataset provenance when present."""
    note = "Параметры из Датасеты_хакатон.xlsx"
    for p in db.query(Project).filter(Project.is_demo.is_(True)).all():
        if note not in (p.description or ""):
            p.description = ((p.description or "").rstrip() + f" {note}").strip()


def seed_all(db: Session, import_sources: bool = True) -> None:
    admin = User(
        email="admin@demo.local",
        password_hash=hash_password("Admin123!"),
        full_name="Администратор",
        role="admin",
    )
    user = User(
        email="user@demo.local",
        password_hash=hash_password("User123!"),
        full_name="Демо Пользователь",
        role="user",
    )
    guest = User(
        email="guest@demo.local",
        password_hash=hash_password("Guest123!"),
        full_name="Гость",
        role="guest",
    )
    db.add_all([admin, user, guest])
    db.flush()

    industries = [
        Industry(code="logistics", name_ru="Логистика и склады"),
        Industry(code="transport", name_ru="Транспорт и аэропорты"),
        Industry(code="healthcare", name_ru="Здравоохранение"),
    ]
    db.add_all(industries)
    db.flush()

    object_types = [
        ObjectType(
            code="warehouse",
            name_ru="Склад",
            industry_id=industries[0].id,
            parameter_schema=WAREHOUSE_SCHEMA,
        ),
        ObjectType(
            code="airport",
            name_ru="Аэропорт",
            industry_id=industries[1].id,
            parameter_schema=AIRPORT_SCHEMA,
        ),
        ObjectType(
            code="medical",
            name_ru="Медицинское учреждение",
            industry_id=industries[2].id,
            parameter_schema=MEDICAL_SCHEMA,
        ),
    ]
    db.add_all(object_types)
    db.flush()

    solution_defs = [
        ("amr", "AMR (автономный мобильный робот)"),
        ("fmr", "FMR (мобильный робот с вилами)"),
        ("stacker", "Штабелёр"),
        ("tugger", "Тягач"),
        ("cleaner", "Клининговый робот"),
        ("forklift", "Автопогрузчик"),
        ("stationary", "Стационарный робот"),
        ("truck", "Автономный грузовик"),
        ("delivery", "Робот-доставщик"),
    ]
    solution_types = [SolutionType(code=c, name_ru=n) for c, n in solution_defs]
    db.add_all(solution_types)
    db.flush()
    st = {s.code: s.id for s in solution_types}

    manufacturers_data = [
        ("Яндекс Роботикс", "Россия", "https://robotics.yandex.ru"),
        ("СберРоботикс", "Россия", None),
        ("Promobot", "Россия", "https://promo-bot.ru"),
        ("МИР", "Россия", None),
        ("KUKA", "Германия", "https://www.kuka.com"),
        ("ABB", "Швейцария", "https://new.abb.com"),
        ("Fanuc", "Япония", "https://www.fanuc.com"),
        ("MiR", "Дания", "https://www.mobile-industrial-robots.com"),
        ("OTTO Motors", "Канада", "https://ottomotors.com"),
        ("Geek+", "Китай", "https://www.geekplus.com"),
        ("Fetch Robotics", "США", None),
        ("Boston Dynamics", "США", "https://bostondynamics.com"),
        ("Locus Robotics", "США", "https://locusrobotics.com"),
        ("Hikrobot", "Китай", "https://www.hikrobotics.com"),
        ("RoboCV", "Россия", None),
    ]
    manufacturers = [Manufacturer(name=n, country=c, website=w) for n, c, w in manufacturers_data]
    db.add_all(manufacturers)
    db.flush()
    mf = {m.name: m.id for m in manufacturers}

    robots_spec = [
        # AMR
        ("MiR 250", "MiR", "amr", 250, 800, 580, 300, 2.0, 60, 10, 1_200_000, ["transport", "picking"], ["warehouse", "medical"]),
        ("MiR 600", "MiR", "amr", 600, 1350, 910, 320, 2.0, 45, 9, 2_800_000, ["transport"], ["warehouse", "airport"]),
        ("Geek+ P800", "Geek+", "amr", 800, 1100, 820, 280, 1.8, 70, 8, 2_200_000, ["picking", "transport"], ["warehouse"]),
        ("Hikrobot Latent QF", "Hikrobot", "amr", 1000, 1200, 900, 300, 1.5, 55, 8, 1_900_000, ["transport"], ["warehouse"]),
        ("RoboCV AMR-500", "RoboCV", "amr", 500, 1000, 700, 350, 1.6, 50, 7, 1_500_000, ["transport"], ["warehouse", "medical"]),
        ("Яндекс Ровер Склад", "Яндекс Роботикс", "amr", 150, 700, 500, 400, 1.5, 40, 6, 980_000, ["delivery", "transport"], ["warehouse"]),
        ("Locus Origin", "Locus Robotics", "amr", 36, 600, 450, 500, 1.8, 80, 8, 1_100_000, ["picking"], ["warehouse"]),
        # FMR
        ("OTTO 1500", "OTTO Motors", "fmr", 1500, 1800, 1200, 400, 2.0, 35, 8, 4_500_000, ["transport", "towing"], ["warehouse", "airport"]),
        ("Fetch Freight500", "Fetch Robotics", "fmr", 500, 1400, 900, 380, 1.7, 40, 7, 3_200_000, ["transport"], ["warehouse"]),
        ("Сбер FMR-800", "СберРоботикс", "fmr", 800, 1500, 1000, 420, 1.5, 30, 6, 2_900_000, ["transport"], ["warehouse"]),
        # stacker
        ("Geek+ X1200", "Geek+", "stacker", 1200, 1400, 1100, 2500, 1.2, 25, 6, 5_500_000, ["stacking", "storage"], ["warehouse"]),
        ("Hikrobot Forklift C", "Hikrobot", "stacker", 1500, 1600, 1200, 3000, 1.0, 20, 5, 6_200_000, ["stacking"], ["warehouse"]),
        ("RoboCV Stack-1T", "RoboCV", "stacker", 1000, 1500, 1150, 2800, 1.1, 22, 5, 4_800_000, ["stacking"], ["warehouse"]),
        # tugger
        ("MiR Hook 200", "MiR", "tugger", 200, 900, 600, 400, 1.5, 50, 9, 1_600_000, ["towing"], ["warehouse", "airport"]),
        ("OTTO Tugger", "OTTO Motors", "tugger", 5000, 2000, 1400, 500, 1.2, 20, 6, 7_000_000, ["towing"], ["warehouse", "airport"]),
        ("МИР Тягач-3Т", "МИР", "tugger", 3000, 1800, 1300, 450, 1.0, 18, 5, 3_800_000, ["towing"], ["warehouse"]),
        # cleaner
        ("CleanBot Pro", "Promobot", "cleaner", 50, 800, 600, 700, 0.8, 15, 4, 750_000, ["cleaning"], ["warehouse", "airport", "medical"]),
        ("Airport Clean X", "Promobot", "cleaner", 40, 900, 650, 750, 0.9, 12, 4, 890_000, ["cleaning"], ["airport"]),
        ("MedClean S", "Promobot", "cleaner", 30, 700, 500, 600, 0.7, 10, 5, 680_000, ["cleaning"], ["medical"]),
        # forklift
        ("AutoFork 2T", "Hikrobot", "forklift", 2000, 2200, 1300, 2200, 1.5, 28, 6, 8_500_000, ["forklift", "stacking"], ["warehouse"]),
        ("RoboCV Fork-1.5", "RoboCV", "forklift", 1500, 2000, 1250, 2100, 1.4, 25, 5, 7_200_000, ["forklift"], ["warehouse", "airport"]),
        ("Сбер Вилочный", "СберРоботикс", "forklift", 1800, 2100, 1280, 2150, 1.3, 24, 5, 6_900_000, ["forklift"], ["warehouse"]),
        # stationary
        ("KUKA KR AGILUS", "KUKA", "stationary", 10, 800, 800, 1200, 0.0, 120, None, 4_200_000, ["assembly", "pick_place"], ["warehouse"]),
        ("ABB IRB 2600", "ABB", "stationary", 20, 1000, 1000, 1600, 0.0, 100, None, 5_800_000, ["assembly", "palletizing"], ["warehouse"]),
        ("Fanuc M-20iD", "Fanuc", "stationary", 25, 1100, 1100, 1700, 0.0, 110, None, 5_500_000, ["palletizing"], ["warehouse"]),
        # truck
        ("BD Stretch Yard", "Boston Dynamics", "truck", 1000, 4000, 2000, 2000, 2.5, 15, 4, 25_000_000, ["yard", "transport"], ["airport", "warehouse"]),
        ("OTTO Lifter Yard", "OTTO Motors", "truck", 1500, 3500, 1800, 1800, 2.0, 18, 5, 12_000_000, ["yard"], ["warehouse", "airport"]),
        # delivery
        ("Яндекс Ровер", "Яндекс Роботикс", "delivery", 20, 600, 400, 500, 1.2, 25, 8, 450_000, ["delivery"], ["medical", "warehouse"]),
        ("Promobot Delivery", "Promobot", "delivery", 15, 550, 380, 480, 1.0, 20, 6, 520_000, ["delivery"], ["medical"]),
        ("Сбер Курьер", "СберРоботикс", "delivery", 25, 650, 420, 520, 1.1, 22, 7, 480_000, ["delivery"], ["medical", "warehouse"]),
        # extras
        ("Geek+ Four-Way", "Geek+", "stacker", 1000, 1300, 1000, 4000, 0.9, 18, 5, 9_500_000, ["storage", "stacking"], ["warehouse"]),
        ("MiR 1350", "MiR", "amr", 1350, 1500, 1000, 350, 1.8, 40, 8, 3_800_000, ["transport"], ["warehouse", "airport"]),
        ("Locus Vector", "Locus Robotics", "amr", 40, 620, 460, 520, 1.9, 90, 9, 1_250_000, ["picking"], ["warehouse"]),
        ("МИР AMR-300", "МИР", "amr", 300, 900, 650, 320, 1.4, 45, 6, 1_100_000, ["transport"], ["warehouse"]),
        ("KUKA mobile", "KUKA", "amr", 400, 1100, 750, 400, 1.6, 35, 7, 3_100_000, ["transport", "assembly"], ["warehouse"]),
    ]

    robots = []
    for name, mfr, stype, payload, L, W, H, speed, prod, auto, price, processes, otypes in robots_spec:
        if name in BOTH_ENV_NAMES:
            indoor = None  # помещение и улица
        elif name in OUTDOOR_CAPABLE_NAMES or stype == "truck":
            indoor = False
        else:
            indoor = True
        tmin, tmax = (-25, 40) if indoor is False else (-10, 40)
        floor_types = ["бетон", "асфальт", "плитка"] if "airport" in otypes else ["бетон", "плитка"]
        robots.append(
            Robot(
                manufacturer_id=mf[mfr],
                name=name,
                solution_type_id=st[stype],
                purpose=f"Решение типа {stype}",
                country=next(m.country for m in manufacturers if m.name == mfr),
                availability_status="available",
                payload_kg=payload,
                length_mm=L,
                width_mm=W,
                height_mm=H,
                speed_mps=speed,
                productivity_ops_per_hour=prod,
                autonomy_hours=auto,
                positioning_accuracy_mm=10 if stype != "stationary" else 0.05,
                navigation="SLAM/LiDAR" if stype not in ("stationary",) else "фиксированная база",
                operating_conditions=_oc(otypes, tmin=tmin, tmax=tmax, indoor=indoor, floor_types=floor_types),
                infrastructure_requirements={"charging": True, "wifi": True, "markers": stype == "stacker"},
                price_rub=price,
                software_cost_rub=round(price * 0.08, 2),
                implementation_cost_rub=round(price * 0.15, 2),
                maintenance_cost_year_rub=round(price * 0.06, 2),
                service_life_years=7,
                acquisition_model="both",
                supported_processes=processes,
                limitations=["Требуется обучение персонала"],
                cases=[{"title": "Пилот", "result": "Снижение ручного труда"}],
                source="Демо-каталог",
                source_url=None,
                confirmation_level="confirmed",
                archived=False,
                raw_data={"seed": True, "name": name},
                data_origin="demo",
                source_status="assumption",
            )
        )
    # one incomplete for needs_review testing
    robots.append(
        Robot(
            manufacturer_id=mf["МИР"],
            name="МИР Прототип X",
            solution_type_id=st["amr"],
            purpose="Опытный образец",
            country="Россия",
            payload_kg=None,
            width_mm=None,
            productivity_ops_per_hour=None,
            price_rub=None,
            confirmation_level="assumption",
            supported_processes=["transport"],
            operating_conditions=_oc(["warehouse"]),
            raw_data={"seed": True, "incomplete": True},
            data_origin="demo",
            source_status="assumption",
        )
    )
    db.add_all(robots)
    db.flush()

    # Normatives
    norm_meta = {
        "utilization": ("Коэффициент загрузки", "доля", "Отраслевая практика WMS"),
        "availability": ("Коэффициент технической готовности", "доля", "ГОСТ/отраслевые KPI"),
        "reserve": ("Резерв парка", "доля", "Методика расчёта парка ТС"),
        "years": ("Горизонт TCO", "лет", "Корпоративная политика CAPEX"),
        "infra_share_of_equipment": ("Доля инфраструктуры от оборудования", "доля", "Опыт интеграторов"),
        "integration_share": ("Доля интеграции", "доля", "Опыт интеграторов"),
        "commissioning_share": ("Доля пусконаладки", "доля", "Опыт интеграторов"),
        "training_per_robot": ("Обучение на робота", "руб", "Прайс учебных центров"),
        "contingency_share": ("Непредвиденные расходы", "доля", "PMBOK contingency"),
        "energy_per_robot_year": ("Энергия на робота в год", "руб/год", "Расчёт по тарифу"),
        "connectivity_per_robot_year": ("Связь на робота в год", "руб/год", "Корп. тарифы"),
        "consumables_per_robot_year": ("Расходники на робота в год", "руб/год", "Сервисные контракты"),
        "repair_share_of_price": ("Ремонт от цены", "доля", "Сервисные контракты"),
        "ops_staff_per_10_robots": ("Персонал на 10 роботов", "чел", "Норматив эксплуатации"),
        "ops_staff_salary_year": ("ФОТ оператора в год", "руб/год", "Рынок труда РФ"),
        "license_share_of_software": ("Лицензии от стоимости ПО", "доля", "Практика вендоров"),
        "current_labor_cost_year": ("Текущие затраты труда (по умолч.)", "руб/год", "Демо"),
        "labor_reduction_share": ("Доля сокращения труда", "доля", "Оценка проектов"),
        "additional_revenue": ("Доп. выручка", "руб/год", "Демо"),
        "raas_monthly_per_robot": ("RaaS в месяц на робота", "руб/мес", "Рыночные предложения"),
    }
    for code, value in DEFAULT_ASSUMPTIONS.items():
        meta = norm_meta.get(code, (code, "", "Модель economics-v1.0"))
        db.add(
            Normative(
                code=code,
                name_ru=meta[0],
                value=float(value),
                unit=meta[1],
                source=meta[2],
                editable=True,
            )
        )

    db.add_all(
        [
            DataSource(name="Сайты производителей", url=None, description="Публичные спецификации"),
            DataSource(name="Пилотные проекты РФ", url=None, description="Обезличенные кейсы"),
            DataSource(name="Нормативы эксплуатации", url=None, description="Внутренние и отраслевые"),
        ]
    )

    demos = [
        Project(
            owner_id=None,
            name="Автоматизация склада",
            industry_id=industries[0].id,
            object_type_id=object_types[0].id,
            description=(
                "Демонстрационный проект: подбор AMR и штабелёров для склада. "
                "Параметры из Датасеты_хакатон.xlsx"
            ),
            region="Москва",
            work_mode="3с",
            status="demo",
            is_demo=True,
            object_params={
                "area_m2": 9600,
                "zones_count": 6,
                "work_mode": "3с",
                "shifts_count": 3,
                "staff_count": 45,
                "staff_cost_year": 18_000_000,
                "ops_count": 3200,
                "peak_demand": 400,
                "avg_demand": 220,
                "sku_count": 12000,
                "required_payload_kg": 200,
                "cargo_length_mm": 1200,
                "cargo_width_mm": 800,
                "cargo_height_mm": 1500,
                "aisle_width_mm": 1500,
                "route_length_m": 850,
                "floor_type": "бетон",
                "temperature_min_c": 5,
                "temperature_max_c": 30,
                "charging_stations": 4,
                "load_points": 8,
                "unload_points": 6,
                "layout_constraints": "Узкие проходы в зоне комплектации",
                "area_width_m": 80,
                "area_length_m": 120,
                "current_labor_cost_year": 18_000_000,
                "required_processes": ["transport", "picking"],
                "indoor": True,
                "required_navigation": "SLAM",
            },
        ),
        Project(
            owner_id=None,
            name="Автоматизация аэропортового объекта",
            industry_id=industries[1].id,
            object_type_id=object_types[1].id,
            description=(
                "Демонстрационный проект: тягачи и AMR для перрона и терминала. "
                "Параметры из Датасеты_хакатон.xlsx"
            ),
            region="Санкт-Петербург",
            work_mode="24/7",
            status="demo",
            is_demo=True,
            object_params={
                "passenger_flow": 45000,
                "cargo_flow": 320,
                "ops_count": 1800,
                "peak_demand": 250,
                "avg_demand": 140,
                "zones_count": 4,
                "route_length_m": 1200,
                "required_payload_kg": 500,
                "cargo_length_mm": 1600,
                "cargo_width_mm": 1200,
                "cargo_height_mm": 1400,
                "work_mode": "24/7",
                "shifts_count": 3,
                "staff_count": 60,
                "access_constraints": "Зона авиационной безопасности, пропуска",
                "security_requirements": "Контроль доступа, видеонаблюдение",
                "area_width_m": 100,
                "area_length_m": 200,
                "aisle_width_mm": 2500,
                "charging_stations": 3,
                "indoor": False,
                "temperature_min_c": -20,
                "temperature_max_c": 35,
                "current_labor_cost_year": 25_000_000,
                "required_processes": ["towing", "transport"],
                "zone_type": "перрон",
                "floor_type": "асфальт",
                "required_navigation": "SLAM",
            },
        ),
        Project(
            owner_id=None,
            name="Роботизация медицинского учреждения",
            industry_id=industries[2].id,
            object_type_id=object_types[2].id,
            description=(
                "Демонстрационный проект: внутрибольничная логистика и клининг. "
                "Параметры из Датасеты_хакатон.xlsx"
            ),
            region="Казань",
            work_mode="2с",
            status="demo",
            is_demo=True,
            object_params={
                "area_m2": 2400,
                "floors_count": 5,
                "ops_count": 600,
                "transport_count": 420,
                "meds_share": 35,
                "meals_share": 25,
                "linen_share": 20,
                "waste_share": 20,
                "route_length_m": 480,
                "elevators": 4,
                "sanitary_constraints": "Разделение чистых и грязных потоков",
                "work_mode": "2с",
                "staff_count": 28,
                "security_requirements": "Контроль доступа в proceduralные зоны",
                "area_width_m": 40,
                "area_length_m": 60,
                "aisle_width_mm": 1200,
                "required_payload_kg": 30,
                "peak_demand": 80,
                "charging_stations": 2,
                "humidity_max_pct": 70,
                "facility_type": "многопрофильный стационар",
                "current_labor_cost_year": 9_000_000,
                "required_processes": ["delivery", "cleaning"],
                "indoor": True,
                "temperature_min_c": 18,
                "temperature_max_c": 26,
                "floor_type": "плитка",
                "required_navigation": "SLAM",
            },
        ),
    ]
    db.add_all(demos)
    db.flush()
    for p in demos:
        for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
            db.add(Scenario(project_id=p.id, code=code, name_ru=name, params={}, results={}))

    # personal sample project for user
    user_project = Project(
        owner_id=user.id,
        name="Мой тестовый склад",
        industry_id=industries[0].id,
        object_type_id=object_types[0].id,
        description="Проект пользователя",
        region="Екатеринбург",
        work_mode="2с",
        status="draft",
        object_params={
            "area_width_m": 50,
            "area_length_m": 70,
            "aisle_width_mm": 1400,
            "required_payload_kg": 300,
            "peak_demand": 180,
            "current_labor_cost_year": 10_000_000,
            "required_processes": ["transport"],
            "indoor": True,
            "charging_stations": 2,
            "floor_type": "бетон",
        },
    )
    db.add(user_project)
    db.flush()
    for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
        db.add(Scenario(project_id=user_project.id, code=code, name_ru=name, params={}, results={}))

    db.commit()

    if import_sources:
        _maybe_import_sources(db)
