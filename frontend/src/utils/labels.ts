/** Локализованные подписи для статусов, допущений и ключей API */

export const NO_DATA = 'Нет данных'
export const NO_SOURCE_DATA = 'Нет данных в исходных материалах'

export const CONFIRMATION_LEVEL_LABELS: Record<string, string> = {
  confirmed: 'Подтверждено',
  needs_review: 'Требует проверки',
  assumption: 'Допущение',
}

export const MATCH_STATUS_LABELS: Record<string, string> = {
  suitable: 'Подходит',
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
  demo: 'Демонстрационный',
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
  current_labor_cost_year: 'Текущие затраты на труд, ₽/год',
  labor_reduction_share: 'Доля снижения затрат на труд',
  additional_revenue: 'Дополнительная выручка, ₽/год',
  raas_monthly_per_robot: 'Аренда (RaaS) в месяц на робота, ₽',
  unit_price: 'Цена единицы, ₽',
  peak_demand: 'Пиковый спрос, оп/ч',
  productivity: 'Производительность, оп/ч',
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
  ops_staff: 'Эксплуатационный персонал',
  ops_staff_count: 'Численность эксплуатационного персонала',
  current_labor: 'Текущие затраты на труд',
  current_cost_reduction: 'Снижение текущих затрат',
  incremental_opex: 'Прирост OPEX',
  additional_revenue: 'Дополнительная выручка',
}

export const FORMULA_LABELS: Record<string, string> = {
  robots_count: 'Количество роботов',
  количество_роботов: 'Количество роботов',
  capex: 'Капитальные затраты (CAPEX)',
  opex: 'Эксплуатационные затраты (OPEX)',
  annual_effect: 'Годовой эффект',
  payback: 'Срок окупаемости',
  roi: 'Рентабельность инвестиций (ROI)',
  tco: 'Совокупная стоимость владения (TCO)',
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
  peak_demand: 'Пиковый спрос',
  peak_ops_per_hour: 'Пиковый спрос',
  avg_demand: 'Средний спрос',
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
  current_labor_cost_year: 'Текущие затраты на труд',
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
  raas: 'Аренда (RaaS)',
  both: 'Покупка и аренда (RaaS)',
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
  'demo.clone': 'Копирование демо-проекта',
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

/** Происхождение значения в экономике / what-if */
export const VALUE_SOURCE_LABELS: Record<string, string> = {
  assumption: 'Допущение',
  default: 'Допущение',
  user: 'Задано пользователем',
  override: 'Задано пользователем',
}

export function confirmationLevelLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return CONFIRMATION_LEVEL_LABELS[value] || value
}

export function dataOriginLabel(value?: string | null): string {
  if (value === 'source') return 'Исходные материалы'
  if (value === 'enriched') return 'Обогащённые данные'
  return 'Демонстрационные данные'
}

/** Подсказка для бейджа происхождения */
export function dataOriginTooltip(value?: string | null): string {
  if (value === 'source') {
    return 'Данные получены из исходных материалов проекта'
  }
  if (value === 'enriched') {
    return 'Карточка из исходных материалов, дополнена сведениями из DOCX-примеров'
  }
  return 'Демонстрационные данные используются для показа возможностей платформы'
}

export function matchStatusLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return MATCH_STATUS_LABELS[value] || value
}

export function importBatchStatusLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return IMPORT_BATCH_STATUS_LABELS[value] || value
}

export function projectStatusLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return PROJECT_STATUS_LABELS[value] || value
}

export function assumptionLabel(key: string): string {
  return ASSUMPTION_LABELS[key] || BREAKDOWN_LABELS[key] || FORMULA_LABELS[key] || key
}

export function breakdownLabel(key: string): string {
  return BREAKDOWN_LABELS[key] || ASSUMPTION_LABELS[key] || key
}

export function formulaLabel(key: string): string {
  return FORMULA_LABELS[key] || ASSUMPTION_LABELS[key] || key
}

export function objectParamLabel(key: string, schema?: ParamSchemaLike): string {
  const fromSchema = schema?.properties?.[key]?.title
  if (fromSchema) return cleanParamTitle(String(fromSchema))
  return OBJECT_PARAM_LABELS[key] || ASSUMPTION_LABELS[key] || key
}

export function availabilityStatusLabel(value?: string | null): string {
  if (!value) return NO_SOURCE_DATA
  return AVAILABILITY_STATUS_LABELS[value] || value
}

export function acquisitionModelLabel(value?: string | null): string {
  if (!value) return NO_SOURCE_DATA
  return ACQUISITION_MODEL_LABELS[value] || value
}

export function catalogTypeLabel(value?: string | null): string {
  if (!value) return NO_DATA
  const lower = value.toLowerCase()
  return CATALOG_TYPE_LABELS[lower] || value
}

export function auditActionLabel(value?: string | null): string {
  if (!value) return NO_DATA
  return AUDIT_ACTION_LABELS[value] || value
}

export function entityTypeLabel(value?: string | null): string {
  if (!value) return ''
  return ENTITY_TYPE_LABELS[value] || value
}

const AUDIT_DETAIL_KEY_LABELS: Record<string, string> = {
  version: 'Версия расчёта',
  from: 'Исходный проект',
  keys: 'Параметры',
  total: 'Всего',
  suitable: 'Подходит',
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
  return 'Демонстрационный каталог. После импорта исходных материалов отобразятся решения из файла catalog_export_v4.csv.'
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
