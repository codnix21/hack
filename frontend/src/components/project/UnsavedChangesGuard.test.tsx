import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createMemoryRouter,
  Link,
  Outlet,
  useNavigate,
} from 'react-router-dom'
import { UnsavedChangesGuard } from './UnsavedChangesGuard'

function Workspace({ dirty, onSave }: { dirty: boolean; onSave: () => Promise<void> }) {
  const navigate = useNavigate()
  return (
    <div>
      <h1>Workspace</h1>
      <UnsavedChangesGuard when={dirty} onSaveAndLeave={onSave} />
      <Link to="/projects">К проектам</Link>
      <button type="button" onClick={() => navigate('/catalog')}>
        В каталог
      </button>
      <Outlet />
    </div>
  )
}

function renderGuard(opts: {
  dirty: boolean
  onSave?: () => Promise<void>
  initial?: string
}) {
  const onSave = opts.onSave ?? (async () => undefined)
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Outlet />,
        children: [
          {
            path: 'workspace',
            element: <Workspace dirty={opts.dirty} onSave={onSave} />,
            children: [{ path: 'extra', element: <p>Extra step</p> }],
          },
          { path: 'projects', element: <h1>Projects</h1> },
          { path: 'catalog', element: <h1>Catalog</h1> },
        ],
      },
    ],
    { initialEntries: [opts.initial ?? '/workspace'] },
  )
  return { router, ...render(<RouterProvider router={router} />) }
}

describe('UnsavedChangesGuard', () => {
  it('does not block when clean', async () => {
    const user = userEvent.setup()
    renderGuard({ dirty: false })
    await user.click(screen.getByRole('link', { name: /К проектам/i }))
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
    expect(screen.queryByTestId('unsaved-guard-dialog')).not.toBeInTheDocument()
  })

  it('blocks SPA link and offers stay', async () => {
    const user = userEvent.setup()
    renderGuard({ dirty: true })
    await user.click(screen.getByRole('link', { name: /К проектам/i }))
    expect(await screen.findByTestId('unsaved-guard-dialog')).toBeInTheDocument()
    await user.click(screen.getByTestId('unsaved-stay'))
    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-guard-dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument()
  })

  it('discards and navigates', async () => {
    const user = userEvent.setup()
    renderGuard({ dirty: true })
    await user.click(screen.getByRole('button', { name: /В каталог/i }))
    expect(await screen.findByTestId('unsaved-guard-dialog')).toBeInTheDocument()
    await user.click(screen.getByTestId('unsaved-discard'))
    expect(await screen.findByRole('heading', { name: 'Catalog' })).toBeInTheDocument()
  })

  it('saves then navigates on success', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async () => undefined)
    renderGuard({ dirty: true, onSave })
    await user.click(screen.getByRole('link', { name: /К проектам/i }))
    await user.click(await screen.findByTestId('unsaved-save'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('keeps dialog path when save fails', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async () => {
      throw new Error('fail')
    })
    renderGuard({ dirty: true, onSave })
    await user.click(screen.getByRole('link', { name: /К проектам/i }))
    await user.click(await screen.findByTestId('unsaved-save'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Projects' })).not.toBeInTheDocument()
  })
})
