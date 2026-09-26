import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { catalogApi } from '../api/catalog'
import { projectsApi } from '../api/projects'
import { getFieldErrors, getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Card } from '../components/ui/Card'
import { toastError, toastSuccess } from '../store/toastStore'
import { useAuthStore } from '../store/authStore'

type FieldKey = 'name' | 'object_type_id' | 'industry_id' | 'region' | 'work_mode' | 'description'

const FIELD_ORDER: FieldKey[] = ['name', 'object_type_id', 'industry_id', 'region', 'work_mode']

const API_FIELD_MAP: Record<string, FieldKey> = {
  name: 'name',
  object_type_id: 'object_type_id',
  industry_id: 'industry_id',
  region: 'region',
  work_mode: 'work_mode',
  description: 'description',
}

export function ProjectCreatePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const isGuest = useAuthStore((s) => s.isGuest)

  useEffect(() => {
    if (isGuest) {
      toastError('Гостевой режим только для просмотра — зарегистрируйтесь, чтобы создавать проекты')
      navigate('/app/demo', { replace: true })
    }
  }, [isGuest, navigate])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [industryId, setIndustryId] = useState('')
  const [objectTypeId, setObjectTypeId] = useState('')
  const [region, setRegion] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})

  const nameRef = useRef<HTMLInputElement>(null)

  const industriesQuery = useQuery({
    queryKey: ['industries'],
    queryFn: () => catalogApi.industries(),
  })

  const objectTypesQuery = useQuery({
    queryKey: ['object-types'],
    queryFn: () => catalogApi.objectTypes(),
  })

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: isEdit && !!id,
  })

  useEffect(() => {
    const p = projectQuery.data
    if (!p) return
    setName(p.name)
    setDescription(p.description || '')
    setIndustryId(p.industry_id != null ? String(p.industry_id) : '')
    setObjectTypeId(p.object_type_id != null ? String(p.object_type_id) : '')
    setRegion(p.region || '')
    setWorkMode(p.work_mode || '')
  }, [projectQuery.data])

  const filteredObjectTypes = useMemo(() => {
    const all = objectTypesQuery.data || []
    if (!industryId) return all
    const iid = Number(industryId)
    return all.filter((o) => o.industry_id == null || o.industry_id === iid)
  }, [objectTypesQuery.data, industryId])

  const applyApiError = (e: unknown) => {
    const fieldErrors = getFieldErrors(e)
    const mapped: Partial<Record<FieldKey, string>> = {}
    for (const [key, msg] of Object.entries(fieldErrors)) {
      const local = API_FIELD_MAP[key]
      if (local) mapped[local] = msg
    }
    if (Object.keys(mapped).length) {
      setErrors(mapped)
      focusFirstError(mapped)
    } else {
      toastError(getFriendlyError(e))
    }
  }

  const focusFirstError = (errs: Partial<Record<FieldKey, string>>) => {
    const first = FIELD_ORDER.find((k) => errs[k])
    if (first === 'name') nameRef.current?.focus()
  }

  const validate = (): Partial<Record<FieldKey, string>> => {
    const next: Partial<Record<FieldKey, string>> = {}
    const trimmed = name.trim()
    if (!trimmed) next.name = 'Укажите название проекта'
    else if (trimmed.length < 2) next.name = 'Минимум 2 символа'
    else if (trimmed.length > 120) next.name = 'Максимум 120 символов'

    if (!isEdit && !objectTypeId) {
      next.object_type_id = 'Выберите тип объекта для подбора'
    }
    return next
  }

  const createMut = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (p) => {
      toastSuccess('Проект создан')
      navigate(`/app/projects/${p.id}?step=params`)
    },
    onError: applyApiError,
  })

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof projectsApi.update>[1]) =>
      projectsApi.update(id!, payload),
    onSuccess: (p) => {
      toastSuccess('Проект обновлён')
      navigate(`/app/projects/${p.id}`)
    },
    onError: applyApiError,
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) {
      focusFirstError(next)
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      industry_id: industryId ? Number(industryId) : null,
      object_type_id: objectTypeId ? Number(objectTypeId) : null,
      region: region.trim() || undefined,
      work_mode: workMode || undefined,
    }
    if (isEdit) updateMut.mutate(payload)
    else createMut.mutate(payload)
  }

  const pending = createMut.isPending || updateMut.isPending

  const clearError = (key: FieldKey) => {
    if (!errors[key]) return
    setErrors((prev) => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={isEdit ? 'Редактирование проекта' : 'Создание проекта'}
        subtitle="Основная информация о проекте подбора"
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Мои проекты', to: '/app/projects' },
          { label: isEdit ? 'Изменение' : 'Создание' },
        ]}
      />

      <Card title="Основная информация">
        {!isEdit && (
          <p className="mb-4 text-sm text-steel-500">
            После создания откроется шаг параметров объекта.
          </p>
        )}
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Input
            ref={nameRef}
            label="Название проекта"
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              clearError('name')
            }}
            error={errors.name}
            placeholder="Например: Роботизация склада №3"
            aria-invalid={!!errors.name}
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-steel-700">Описание</span>
            <textarea
              name="description"
              className={`min-h-[100px] w-full rounded border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 ${
                errors.description ? 'border-red-400' : 'border-steel-300'
              }`}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                clearError('description')
              }}
              placeholder="Кратко опишите задачу и ограничения"
              aria-invalid={!!errors.description}
            />
            {errors.description ? (
              <span className="text-xs text-red-600">{errors.description}</span>
            ) : null}
          </label>
          <SearchableSelect
            label="Отрасль"
            value={industryId}
            onChange={(v) => {
              setIndustryId(v)
              setObjectTypeId('')
              clearError('industry_id')
              clearError('object_type_id')
            }}
            error={errors.industry_id}
            placeholder="Выберите отрасль"
            searchPlaceholder="Поиск отрасли…"
            options={(industriesQuery.data || []).map((i) => ({
              value: i.id,
              label: i.name_ru,
            }))}
          />
          <SearchableSelect
            label="Тип объекта"
            value={objectTypeId}
            onChange={(v) => {
              setObjectTypeId(v)
              clearError('object_type_id')
            }}
            error={errors.object_type_id}
            placeholder="Выберите тип объекта"
            searchPlaceholder="Поиск типа объекта…"
            options={filteredObjectTypes.map((o) => ({
              value: o.id,
              label: o.name_ru,
            }))}
          />
          <Input
            label="Регион"
            name="region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value)
              clearError('region')
            }}
            error={errors.region}
            placeholder="Например: Москва"
          />
          <Select
            label="Режим работы"
            name="work_mode"
            value={workMode}
            onChange={(e) => {
              setWorkMode(e.target.value)
              clearError('work_mode')
            }}
            error={errors.work_mode}
            placeholder="Выберите режим"
            options={[
              { value: '1shift', label: '1 смена' },
              { value: '2shift', label: '2 смены' },
              { value: '24x7', label: 'Круглосуточно' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/app/projects')}>
              Отмена
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? 'Сохранить' : 'Создать и продолжить'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
