/** Локализованные подписи для статусов, допущений и ключей API */

export const NO_DATA = 'Нет данных'
export const NO_SOURCE_DATA = 'Нет данных в исходных материалах'

export const CONFIRMATION_LEVEL_LABELS: Record<string, string> = {
  confirmed: 'Подтверждено',
  needs_review: 'Требует проверки',
  assumption: 'Допущение',
}

export const MATCH_STATUS_LABELS: Record<string, string> = {
  suitable: 'Предварительно подходит',
  needs_review: 'Требует проверки',
  excluded: 'Не подходит',
}

export const IMPORT_BATCH_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидание',
  processing: 'Выполняется',
  completed: 'Завершено',
  ok: 'Завершено',
  failed: 'Ошибка',
  partial: 'Частично',
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активный',
  archived: 'В архиве',
  completed: 'Завершён',
  demo: 'Пример',
}

export const ASSUMPTION_LABELS: Record<string, string> = {
  utilization: 'Загрузка оборудования',
  availability: 'Доступность',
  reserve: 'Резерв парка',
  years: 'Горизонт анализа, лет',
  infra_share_of_equipment: 'Доля инфраструктуры от оборудования',
  integration_share: 'Доля интеграции',
  commissioning_share: 'Доля пусконаладки',
  training_per_robot: 'Обучение на робота, ₽',
  contingency_share: 'Доля непредвиденных расходов',
  energy_per_robot_year: 'Энергия на робота, ₽/год',
  connectivity_per_robot_year: 'Связь на робота, ₽/год',
  consumables_per_robot_year: 'Расходники на робота, ₽/год',
  repair_share_of_price: 'Доля ремонта от цены',
  ops_staff_per_10_robots: 'Персонал на 10 роботов',
  ops_staff_salary_year: 'Зарплата персонала, ₽/год',
  license_share_of_software: 'Доля лицензий от ПО',
  current_labor_cost_year: 'Годовые затраты на персонал, ₽/год',
  labor_reduction_share: 'Ожидаемая доля сокращения трудозатрат (допущение)',
  additional_revenue: 'Дополнительная выручка, ₽/год',
  raas_monthly_per_robot: 'Аренда в месяц на робота, ₽',
  unit_price: 'Цена решения, ₽',
  unit_price_assumed: 'Допущение цены решения',
  unit_price_origin: 'Источник цены',
  unit_price_assumed_note: 'Пояснение к допущению цены',
  unit_price_note: 'Пояснение к цене',
  assumed_unit_price: 'Принятая цена решения, ₽',
  peak_demand: 'Пиковая нагрузка, оп/ч',
  productivity: 'Производительность, оп/ч',
  productivity_ops_per_hour: 'Производительность в расчёте, оп/ч',
  productivity_origin: 'Источник производительности',
  productivity_model_fallback: 'Производительность — допущение модели (50 оп/ч)',
  productivity_model_fallback_note: 'Пояснение к запасной производительности модели',
  robots_count: 'Количество роботов',
  software_cost: 'Стоимость ПО, ₽',
  maintenance_year: 'Обслуживание, ₽/год',
  implementation_cost: 'Внедрение, ₽',
}

export const BREAKDOWN_LABELS: Record<string, string> = {
  equipment: 'Оборудование',
  infrastructure: 'Инфраструктура',
  software: 'Программное обеспечение',
  integration: 'Интеграция',
  commissioning: 'Пусконаладка',
  training: 'Обучение',
  contingency: 'Резерв / непредвиденные',
  service: 'Сервис и обслуживание',
  licenses: 'Лицензии',
  energy: 'Энергия',
  connectivity: 'Связь',
  consumables: 'Расходники',
  repair: 'Ремонт',
  ops_staff: 'Эксплуатационный персонал (₽/год)',
  ops_staff_count: 'Численность эксплуатационного персонала',
  charging_stations: 'Зарядные станции',
  charging_stations_count: 'Число зарядных станций',
  current_labor: 'Текущие затраты на труд',
  current_cost_reduction: 'Снижение текущих затрат',
  incremental_opex: 'Прирост эксплуатационных расходов',
  additional_revenue: 'Дополнительная выручка',
}

export const FORMULA_LABELS: Record<string, string> = {
  robots_count: 'Количество роботов',
  количество_роботов: 'Количество роботов',
  capex: 'Капитальные затраты',
  opex: 'Эксплуатационные расходы',
  opex_annual: 'Эксплуатационные расходы, ₽/год',
  annual_effect: 'Годовой экономический эффект',
  net_annual_effect: 'Чистый годовой экономический эффект',
  gross_operating_effect: 'Валовой операционный эффект',
  gross_effect: 'Валовой операционный эффект',
  net_effect: 'Чистый годовой эффект',
  payback: 'Срок окупаемости',
  payback_years: 'Срок окупаемости',
  roi: 'Рентабельность инвестиций',
  roi_percent: 'Рентабельность инвестиций',
  roi_horizon: 'Рентабельность за горизонт анализа',
  tco: 'Совокупная стоимость владения в границах модели',
  npv: 'Чистая приведённая стоимость',
  irr: 'Внутренняя норма доходности',
  depreciation: 'Амортизация',
  annual_effect_with_depreciation: 'Годовой эффект с учётом амортизации',
  fleet_capacity: 'Расчётная пропускная способность парка',
  cashflow: 'Денежный поток',
  cf: 'Денежный поток',
}

/** Краткие KPI-подписи для карточек. */
export const METRIC_LABELS: Record<string, string> = {
  capex: 'Капитальные затраты',
  opex: 'Эксплуатационные расходы',
  opex_year: 'Эксплуатационные расходы / год',
  annual_effect: 'Годовой экономический эффект',
  payback: 'Срок окупаемости',
  roi: 'Рентабельность инвестиций',
  tco: 'Совокупная стоимость владения',
  npv: 'Чистая приведённая стоимость',
  irr: 'Внутренняя норма доходности',
  robots_count: 'Количество роботов',
  depreciation: 'Амортизация',
  fleet_capacity: 'Пропускная способность парка',
}

export const WORK_MODE_LABELS: Record<string, string> = {
  '1shift': '1 смена',
  '2shift': '2 смены',
  '24x7': 'Круглосуточно (24/7)',
  '24/7': 'Круглосуточно (24/7)',
}

export const ROBOTS_COUNT_SOURCE_LABELS: Record<string, string> = {
  user_or_fixed: 'сценарий / фиксированная конфигурация',
  calculated: 'формула потребности',
  catalog: 'каталог',
}

export const DEPRECIATION_METHOD_LABELS: Record<string, string> = {
  straight_line: 'Линейный метод',
  linear: 'Линейный метод',
}

export const DXF_ENTITY_TYPE_LABELS: Record<string, string> = {
  LINE: 'Отрезок',
  CIRCLE: 'Окружность',
  ARC: 'Дуга',
  LWPOLYLINE: 'Полилиния',
  POLYLINE: 'Полилиния',
  INSERT: 'Вставка блока',
  TEXT: 'Текст',
  MTEXT: 'Многострочный текст',
  POINT: 'Точка',
  HATCH: 'Штриховка',
  DIMENSION: 'Размер',
  SPLINE: 'Сплайн',
  ELLIPSE: 'Эллипс',
}

export function dxfEntityTypeLabel(dxftype?: string | null): string {
  if (!dxftype) return NO_DATA
  const key = String(dxftype).toUpperCase()
  return DXF_ENTITY_TYPE_LABELS[key] || 'Элемент чертежа'
}

export const MISSING_CHECK_LABELS: Record<string, string> = {
  object_type: 'Тип объекта',
  payload_kg: 'Грузоподъёмность',
  width_mm: 'Ширина робота',
  operating_conditions: 'Условия эксплуатации',
  floor_type: 'Тип пола',
  price_rub: 'Цена',
  productivity_ops_per_hour: 'Производительность',
  speed_mps: 'Скорость',
  supported_processes: 'Поддерживаемые процессы',
  navigation: 'Навигация',
  autonomy_hours: 'Автономность',
  missing_checks: 'Что необходимо проверить',
}

export const OBJECT_PARAM_LABELS: Record<string, string> = {
  area_m2: 'Площадь',
  active_area_m2: 'Площадь активной зоны',
  apron_area_m2: 'Площадь перрона',
  ceiling_height_m: 'Высота потолков',
  floors_count: 'Число этажей',
  zones_count: 'Число зон',
  work_mode: 'Режим работы',
  shifts_count: 'Число смен',
  shift_hours: 'Продолжительность смены',
  staff_count: 'Численность персонала',
  staff_cost_year: 'Затраты на персонал',
  staff_cost_per_person_year: 'Стоимость сотрудника',
  ops_count: 'Операций в сутки',
  peak_demand: 'Пиковая нагрузка',
  peak_ops_per_hour: 'Пиковая нагрузка',
  /** Поля из operating_conditions / каталога */
  region: 'Регион',
  industry: 'Отрасль',
  object_types: 'Типы объектов',
  floor_types: 'Типы пола',
  charging: 'Зарядка',
  wifi: 'Wi‑Fi',
  markers: 'Маркеры / метки',

  avg_demand: 'Средняя нагрузка',
  peak_factor: 'Пиковый коэффициент',
  sku_count: 'Число SKU',
  required_payload_kg: 'Требуемая грузоподъёмность',
  cargo_length_mm: 'Длина груза',
  cargo_width_mm: 'Ширина груза',
  cargo_height_mm: 'Высота груза',
  aisle_width_mm: 'Ширина прохода',
  aisle_width_m: 'Ширина прохода',
  main_aisle_width_m: 'Ширина главных проездов',
  route_length_m: 'Длина маршрута',
  floor_type: 'Тип покрытия пола',
  temperature_min_c: 'Мин. температура',
  temperature_max_c: 'Макс. температура',
  humidity_max_pct: 'Макс. влажность',
  charging_stations: 'Зарядные станции',
  load_points: 'Точки погрузки',
  unload_points: 'Точки разгрузки',
  layout_constraints: 'Ограничения планировки',
  area_width_m: 'Ширина площадки',
  area_length_m: 'Длина площадки',
  current_labor_cost_year: 'Годовые затраты на персонал',
  required_processes: 'Требуемые процессы',
  indoor: 'Работа в помещении',
  required_navigation: 'Требуемая навигация',
  passenger_flow: 'Пассажиропоток',
  cargo_flow: 'Грузопоток',
  access_constraints: 'Ограничения доступа',
  security_requirements: 'Требования безопасности',
  zone_type: 'Тип зоны',
  transport_count: 'Транспортировок в сутки',
  meds_share: 'Доля медикаментов',
  meals_share: 'Доля питания',
  orders_per_day: 'Заказов в сутки',
  operators_count: 'Число операторов',
  productivity: 'Производительность',
  storage_type: 'Тип хранения',
  facility_type: 'Тип учреждения',
  terminals_count: 'Число терминалов',
  gates_count: 'Число гейтов',
  elevators: 'Число лифтов',
  staff_salary_month: 'Средняя зарплата, ₽/мес.',
  payroll_tax_coef: 'Коэффициент начислений на ФОТ',
  shifts_per_day: 'Число смен в сутки',
  hours_per_shift: 'Часов в смене',
  estimated: 'Расчётная оценка',
  // параметры из Датасеты_хакатон (транслит-ключи)
  rovnost_pola_otklonenie: 'Ровность пола (отклонение)',
  rabochih_dney_v_godu: 'Рабочих дней в году',
  obem_priemki_poddony_sutki: 'Объём приёмки (поддоны/сутки)',
  obem_otgruzki_poddony_sutki: 'Объём отгрузки (поддоны/сутки)',
  obem_otbora_strok_sutki_vsego: 'Объём отбора (строк/сутки)',
  obem_otbora_shtuk_sutki_vsego: 'Объём отбора (штук/сутки)',
  dolya_melkoshtuchnogo_otbora_piece_pick: 'Доля мелкоштучного отбора',
  kolichestvo_sku_aktivnyh: 'Количество активных SKU',
  dolya_sku_s_bystrym_oborotom_a_klass: 'Доля SKU A-класса',
  obschaya_chislennost_personala_sklada: 'Общая численность персонала склада',
  iz_nih_otborschiki_komplektovschiki: 'Из них: отборщики',
  iz_nih_operatory_pogruzchikov: 'Из них: операторы погрузчиков',
  iz_nih_operatory_upakovochnyh_liniy: 'Из них: операторы упаковки',
  srednyaya_z_p_otborschika_gross: 'Средняя з/п отборщика',
  srednyaya_z_p_operatora_pogruzchika_gross: 'Средняя з/п оператора погрузчика',
  koeffitsient_nachisleniy_na_fot_strahovye_vznosy: 'Коэффициент начислений на ФОТ',
  srednyaya_vyrabotka_otborschika_strok_ch: 'Средняя выработка отборщика',
  koeffitsient_poter_rabochego_vremeni_otpusk_bolezn_tekuchest:
    'Коэффициент потерь рабочего времени',
  srednyaya_dlina_marshruta_otborschika_na_1_stroku: 'Средняя длина маршрута отборщика',
  protyazhennost_konveyernoy_transportnoy_sistemy: 'Протяжённость конвейерной системы',
  tip_stellazhnoy_sistemy: 'Тип стеллажной системы',
  kolichestvo_palletomest: 'Количество паллетомест',
  srednyaya_massa_gruzovoy_edinitsy_pallet: 'Средняя масса паллеты',
  srednyaya_massa_shtuchnoy_edinitsy_sku: 'Средняя масса штучной единицы',
  srednie_gabarity_pallety_d_sh_v: 'Средние габариты паллеты',
  srednie_gabarity_shtuchnoy_edinitsy_d_sh_v: 'Средние габариты штучной единицы',
  dolya_negabaritnyh_nestandartnyh_gruzov: 'Доля негабаритных грузов',
  moschnost_elektrosnabzheniya_dostupnaya: 'Мощность электроснабжения',
  nalichie_wms: 'Наличие WMS',
  nalichie_erp_1s: 'Наличие ERP/1С',
  planiruemyy_byudzhet_na_robotizatsiyu_capex: 'Планируемый бюджет на роботизацию',
  gorizont_rascheta_okupaemosti: 'Горизонт расчёта окупаемости',
}

type ParamSchemaLike = {
  properties?: Record<string, { title?: string } | undefined>
} | null

/** Короткое название без хвостовой единицы («Площадь, м²» → «Площадь») */
function cleanParamTitle(title: string): string {
  const t = title.trim()
  // не режем, если запятая внутри скобок / перечисления
  const m = /^(.+?),\s*[^,]{1,12}$/.exec(t)
  return m ? m[1].trim() : t
}

export const AVAILABILITY_STATUS_LABELS: Record<string, string> = {
  available: 'Доступен',
  unavailable: 'Недоступен',
  limited: 'Ограниченно',
  discontinued: 'Снят с производства',
}

export const ACQUISITION_MODEL_LABELS: Record<string, string> = {
  purchase: 'Покупка',
  raas: 'Аренда',
  both: 'Покупка и аренда',
  lease: 'Лизинг',
}

export const CATALOG_TYPE_LABELS: Record<string, string> = {
  brs: 'БРС',
  bas: 'БАС',
  software: 'ПО',
  amr: 'AMR',
  agv: 'AGV',
  manipulator: 'Манипулятор',
  other: 'Прочее',
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'Вход в систему',
  register: 'Регистрация',
  'project.create': 'Создание проекта',
  'project.update': 'Обновление проекта',
  'project.delete': 'Удаление проекта',
  'project.copy': 'Копирование проекта',
  'project.params_import': 'Импорт параметров проекта',
  'demo.clone': 'Копирование примера проекта',
  'scenario.update': 'Обновление сценария',
  'economics.calculate': 'Расчёт экономики',
  'matching.run': 'Запуск подбора',
  'admin.user_update': 'Обновление пользователя',
  'admin.robot_create': 'Создание решения в каталоге',
  'admin.robot_update': 'Обновление решения',
  'admin.robot_archive': 'Архивация решения',
  'admin.manufacturer_create': 'Добавление производителя',
  'admin.manufacturer_update': 'Обновление производителя',
  'admin.manufacturer_delete': 'Удаление производителя',
  'admin.object_type_create': 'Добавление типа объекта',
  'admin.object_type_update': 'Обновление типа объекта',
  'admin.object_type_delete': 'Удаление типа объекта',
  'admin.solution_type_create': 'Добавление типа решения',
  'admin.solution_type_update': 'Обновление типа решения',
  'admin.solution_type_delete': 'Удаление типа решения',
  'admin.source_create': 'Добавление источника',
  'admin.source_update': 'Обновление источника',
  'admin.source_delete': 'Удаление источника',
  'admin.normative_update': 'Обновление норматива',
  'admin.catalog_import': 'Импорт каталога',
  'admin.source_catalog_import': 'Импорт каталога материалов',
  'admin.source_datasets_import': 'Импорт датасетов',
  'admin.docx_examples_import': 'Обогащение из DOCX',
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  user: 'Пользователь',
  project: 'Проект',
  robot: 'Решение',
  normative: 'Норматив',
  object_type: 'Тип объекта',
  solution_type: 'Тип решения',
  manufacturer: 'Производитель',
  source: 'Источник',
  scenario: 'Сценарий',
}

/** Происхождение значения в экономике и анализе «что если» */
export const VALUE_SOURCE_LABELS: Record<string, string> = {
  assumption: 'Допущение',
  default: 'Допущение',
  user: 'Задано пользователем',
  override: 'Задано пользователем',
}

/** Безопасная подпись для неизвестного ключа — без утечки snake_case пользователю. */
export function unknownFieldLabel(key?: string | null): string {
  if (!key) return NO_DATA
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[labels] нет русской подписи для ключа: ${key}`)
  }
  return 'Параметр без подписи'
}

function resolveLabel(maps: Record<string, string>[], key: string): string {
  for (const m of maps) {
    if (m[key]) return m[key]
  }
  return unknownFieldLabel(key)
}

export function confirmationLevelLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return CONFIRMATION_LEVEL_LABELS[value] || unknownFieldLabel(value)
}

export function dataOriginLabel(value?: string | null): string {
  if (value === 'source') return 'Исходные материалы'
  if (value === 'enriched') return 'Обогащённые данные'
  return 'Данные каталога платформы'
}

/** Подсказка для бейджа происхождения */
export function dataOriginTooltip(value?: string | null): string {
  if (value === 'source') {
    return 'Данные получены из исходных материалов проекта'
  }
  if (value === 'enriched') {
    return 'Карточка из исходных материалов, дополнена сведениями из DOCX-примеров'
  }
  return 'Данные из каталога платформы'
}

export function matchStatusLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return MATCH_STATUS_LABELS[value] || unknownFieldLabel(value)
}

export function importBatchStatusLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return IMPORT_BATCH_STATUS_LABELS[value] || unknownFieldLabel(value)
}

export function projectStatusLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return PROJECT_STATUS_LABELS[value] || unknownFieldLabel(value)
}

export function assumptionLabel(key: string): string {
  return resolveLabel([ASSUMPTION_LABELS, BREAKDOWN_LABELS, FORMULA_LABELS, METRIC_LABELS], key)
}

export function breakdownLabel(key: string): string {
  return resolveLabel([BREAKDOWN_LABELS, ASSUMPTION_LABELS, FORMULA_LABELS], key)
}

export function formulaLabel(key: string): string {
  return resolveLabel([FORMULA_LABELS, METRIC_LABELS, ASSUMPTION_LABELS], key)
}

export function metricLabel(key: string): string {
  return resolveLabel([METRIC_LABELS, FORMULA_LABELS, ASSUMPTION_LABELS], key)
}

export function objectParamLabel(key: string, schema?: ParamSchemaLike): string {
  // Словарь — источник истины для UX; schema.title только если ключа ещё нет в словаре
  if (OBJECT_PARAM_LABELS[key]) return OBJECT_PARAM_LABELS[key]
  if (ASSUMPTION_LABELS[key]) return ASSUMPTION_LABELS[key]
  const fromSchema = schema?.properties?.[key]?.title
  if (fromSchema) return cleanParamTitle(String(fromSchema))
  return resolveLabel([FORMULA_LABELS], key)
}

export function workModeLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return WORK_MODE_LABELS[value] || WORK_MODE_LABELS[value.toLowerCase()] || String(value)
}

export function robotsCountSourceLabel(value?: string | null): string {
  if (!value) return 'расчёт'
  return ROBOTS_COUNT_SOURCE_LABELS[value] || 'расчёт'
}

export function depreciationMethodLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return DEPRECIATION_METHOD_LABELS[value] || unknownFieldLabel(value)
}

export function missingCheckLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return MISSING_CHECK_LABELS[value] || objectParamLabel(value)
}

export function availabilityStatusLabel(value?: string | null): string {
  if (!value) return NO_SOURCE_DATA
  return AVAILABILITY_STATUS_LABELS[value] || unknownFieldLabel(value)
}

export function acquisitionModelLabel(value?: string | null): string {
  if (!value) return NO_SOURCE_DATA
  return ACQUISITION_MODEL_LABELS[value] || unknownFieldLabel(value)
}

export function catalogTypeLabel(value?: string | null): string {
  if (!value) return NO_DATA
  const lower = value.toLowerCase()
  return CATALOG_TYPE_LABELS[lower] || value
}

export function auditActionLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return AUDIT_ACTION_LABELS[value] || 'Действие журнала'
}

export function entityTypeLabel(value?: string | null): string {
  if (!value) return ''
  return ENTITY_TYPE_LABELS[value] || 'Объект'
}

export function userRoleLabel(value?: string | null): string {
  if (!value) return NO_DATA
  const roles: Record<string, string> = {
    admin: 'Администратор',
    user: 'Пользователь',
    guest: 'Гость',
    vendor: 'Поставщик',
    viewer: 'Наблюдатель',
  }
  return roles[value] || 'Пользователь'
}

/** Известные пользовательские ключи (для тестов покрытия). */
export const KNOWN_USER_FACING_KEYS = [
  'current_labor_cost_year',
  'labor_reduction_share',
  'peak_demand',
  'unit_price',
  'robots_count',
  'capex',
  'opex',
  'payback',
  'annual_effect',
  'npv',
  'irr',
  'tco',
  'depreciation',
  'fleet_capacity',
  'needs_review',
  'suitable',
  'excluded',
  'missing_checks',
  'available',
  'estimated',
] as const

const AUDIT_DETAIL_KEY_LABELS: Record<string, string> = {
  version: 'Версия расчёта',
  from: 'Исходный проект',
  keys: 'Параметры',
  total: 'Всего',
  suitable: 'Предварительно подходит',
  added: 'Добавлено',
  updated: 'Обновлено',
  skipped: 'Пропущено',
  processed: 'Обработано',
  created: 'Создано',
  errors: 'Ошибок',
  warnings: 'Предупреждений',
  role: 'Роль',
  is_active: 'Активен',
  full_name: 'ФИО',
  message: 'Сообщение',
  status: 'Статус',
}

function formatAuditDetailValue(key: string, value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (Array.isArray(value)) {
    if (key === 'keys') return `${value.length} шт.`
    if (value.length <= 3) return value.map(String).join(', ')
    return `${value.length} шт.`
  }
  if (typeof value === 'object') return '…'
  if (key === 'from') return `№${value}`
  if (key === 'role') {
    const roles: Record<string, string> = {
      admin: 'администратор',
      user: 'пользователь',
      viewer: 'наблюдатель',
    }
    return roles[String(value)] || String(value)
  }
  return String(value)
}

/** Человекочитаемые детали записи журнала вместо сырого JSON */
export function formatAuditDetails(details: unknown, action?: string | null): string {
  if (details == null || details === '') return '—'
  if (typeof details === 'string') return details
  if (typeof details !== 'object') return String(details)

  const d = details as Record<string, unknown>
  const keys = Object.keys(d)
  if (!keys.length) return '—'

  if (action === 'economics.calculate' && 'version' in d) {
    return `Сохранена версия расчёта ${d.version}`
  }
  if ((action === 'project.copy' || action === 'demo.clone') && 'from' in d) {
    return `Скопировано из проекта №${d.from}`
  }
  if (action === 'project.params_import' && Array.isArray(d.keys)) {
    return `Импортировано параметров: ${d.keys.length}`
  }
  if (action === 'matching.run') {
    const parts = []
    if (d.total != null) parts.push(`всего ${d.total}`)
    if (d.suitable != null) parts.push(`подходит ${d.suitable}`)
    if (parts.length) return parts.join(', ')
  }

  const parts = keys
    .filter((k) => !['filename', 'batch_id', 'object_params_by_code', 'sheets'].includes(k))
    .slice(0, 6)
    .map((k) => {
      const label = AUDIT_DETAIL_KEY_LABELS[k] || k
      return `${label}: ${formatAuditDetailValue(k, d[k])}`
    })
  return parts.length ? parts.join(' · ') : '—'
}

/** Подпись объекта в журнале: «Проект «Склад…»» */
export function formatAuditEntity(
  entityType?: string | null,
  entityId?: number | null,
  entityName?: string | null,
): string {
  const type = entityTypeLabel(entityType)
  if (!type && entityId == null && !entityName) return '—'
  if (entityName) {
    const short = entityName.length > 48 ? `${entityName.slice(0, 46)}…` : entityName
    return type ? `${type} «${short}»` : `«${short}»`
  }
  if (type && entityId != null) return `${type} №${entityId}`
  if (type) return type
  if (entityId != null) return `№${entityId}`
  return '—'
}

export function valueSourceLabel(kind?: string | null): string {
  if (!kind) return VALUE_SOURCE_LABELS.assumption
  return VALUE_SOURCE_LABELS[kind] || kind
}

/** Подпись статистики каталога — без хардкода фиксированного числа решений */
export function catalogStatsLabel(total: number, hasSourceData: boolean): string {
  if (hasSourceData) {
    return `Каталог из исходных материалов. Всего в базе (с учётом фильтров): ${total}.`
  }
  return 'Платформенный каталог. После импорта исходных материалов отобразятся решения из файла catalog_export_v4.csv.'
}

export function matchStatusIcon(status?: string | null): string {
  if (status === 'suitable') return '✓'
  if (status === 'needs_review') return '⚠'
  if (status === 'excluded') return '✕'
  return '·'
}

/** Выделяет предупреждения о недостающих данных в текстах подбора */
export function isMissingDataWarning(text: string): boolean {
  const t = text.toLowerCase()
  return (
    text.includes('⚠') ||
    t.includes('отсутствуют данные') ||
    t.includes('нет данных') ||
    t.includes('не указаны')
  )
}

/** Убирает технические ключи API из пользовательских предупреждений (в т.ч. уже сохранённых). */
const WARNING_KEY_REPLACEMENTS: [RegExp, string][] = [
  [/\bcurrent_labor_cost_year\b/gi, 'годовые затраты на персонал'],
  [/\bstaff_cost_per_person_year\b/gi, 'годовая ставка на сотрудника'],
  [/\bstaff_cost_year\b/gi, 'затраты на персонал'],
  [/\bstaff_count\b/gi, 'численность'],
  [/\bstaff_salary_month\b/gi, 'з/п в месяц'],
  [/\bpayroll_tax_coef\b/gi, 'коэф. ФОТ'],
  [/\bpeak_demand\b/gi, 'пиковая нагрузка'],
  [/\bpeak_factor\b/gi, 'пиковый коэффициент'],
  [/\bops_count\b/gi, 'операций в сутки'],
  [/\bunit_price_assumed\b/gi, 'допущение цены'],
  [/\bassumed_unit_price\b/gi, 'принятая цена'],
  [/\bunit_price\b/gi, 'цена решения'],
  [/суточный_объём/gi, 'суточный объём'],
  [/пик_коэффициент/gi, 'пиковый коэффициент'],
  [/з\/п_мес/gi, 'з/п в месяц'],
  [/коэф_ФОТ/gi, 'коэф. ФОТ'],
]

export function localizeUserFacingWarning(text: string): string {
  if (!text) return text
  let out = text
  for (const [re, ru] of WARNING_KEY_REPLACEMENTS) {
    out = out.replace(re, ru)
  }
  // «помечено допущение цены» → естественнее
  out = out.replace(/\(помечено\s+допущение цены\)/gi, '(цена принята как допущение модели)')
  return out
}
