import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastHost } from './components/ui/ToastHost'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectCreatePage } from './pages/ProjectCreatePage'
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage'
import { CatalogPage } from './pages/CatalogPage'
import { RobotDetailPage } from './pages/RobotDetailPage'
import { ComparePage } from './pages/ComparePage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AdminPage } from './pages/AdminPage'
import { DemoPage } from './pages/DemoPage'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

function AuthBootstrap({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PublicHome />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/new" element={<ProjectCreatePage />} />
                <Route path="projects/:id" element={<ProjectWorkspacePage />} />
                <Route path="projects/:id/edit" element={<ProjectCreatePage />} />
                <Route path="catalog" element={<CatalogPage />} />
                <Route path="catalog/:id" element={<RobotDetailPage />} />
                <Route path="compare" element={<ComparePage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="demo" element={<DemoPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route element={<ProtectedRoute adminOnly />}>
                  <Route path="admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastHost />
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function PublicHome() {
  const token = useAuthStore((s) => s.token)
  if (token) return <Navigate to="/app" replace />
  return (
    <div className="min-h-screen bg-steel-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex justify-end">
          <a
            href="/login"
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Войти
          </a>
        </div>
        <HomePage />
      </div>
    </div>
  )
}
