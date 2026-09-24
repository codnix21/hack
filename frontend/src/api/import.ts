import { apiClient } from './client'
import { toId } from './ids'
import type {
  CatalogImportResult,
  ImportBatch,
  ImportConfirmResponse,
  ImportPreview,
  ImportValidateResponse,
} from '../types'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const importApi = {
  downloadParamsTemplate: async (projectId: string | number) => {
    const res = await apiClient.get<Blob>(
      `/projects/${toId(projectId)}/params/import/template`,
      { responseType: 'blob' },
    )
    const disposition = res.headers['content-disposition'] as string | undefined
    let filename = 'shablon_parametrov.xlsx'
    if (disposition) {
      const m = /filename="?([^";]+)"?/i.exec(disposition)
      if (m?.[1]) filename = decodeURIComponent(m[1])
    }
    downloadBlob(res.data, filename)
  },

  preview: (projectId: string | number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<ImportPreview>(`/projects/${toId(projectId)}/params/import/preview`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  validate: (projectId: string | number, mapping: Record<string, string>, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<ImportValidateResponse>(
        `/projects/${toId(projectId)}/params/import/validate`,
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          params: { mapping_json: JSON.stringify(mapping) },
        },
      )
      .then((r) => r.data)
  },

  confirm: (projectId: string | number, mapping: Record<string, string>, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<ImportConfirmResponse>(
        `/projects/${toId(projectId)}/params/import/confirm`,
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          params: { mapping_json: JSON.stringify(mapping) },
        },
      )
      .then((r) => r.data)
  },

  catalogPreview: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<ImportPreview>('/admin/import/catalog/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  catalogConfirm: (file: File, mapping: Record<string, string>) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<CatalogImportResult>('/admin/import/catalog/confirm', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { mapping_json: JSON.stringify(mapping) },
      })
      .then((r) => r.data)
  },

  sourceCatalog: (file?: File, path?: string) => {
    const form = new FormData()
    if (file) form.append('file', file)
    return apiClient
      .post<CatalogImportResult>('/admin/import/source-catalog', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: path ? { path } : undefined,
      })
      .then((r) => r.data)
  },

  sourceDatasets: (file?: File, path?: string) => {
    const form = new FormData()
    if (file) form.append('file', file)
    return apiClient
      .post<CatalogImportResult>('/admin/import/source-datasets', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: path ? { path } : undefined,
      })
      .then((r) => r.data)
  },

  docxExamples: (path?: string) =>
    apiClient
      .post<CatalogImportResult>('/admin/import/docx-examples', null, {
        params: path ? { path } : undefined,
      })
      .then((r) => r.data),

  importBatches: () =>
    apiClient.get<ImportBatch[]>('/admin/import/batches').then((r) => r.data),
}
