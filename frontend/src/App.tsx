import { useEffect, type ReactNode } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastHost } from './components/ui/ToastHost'
import { HomePage } from './pages/HomePage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectCreatePage } from './pages/ProjectCreatePage'
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage'
import { CatalogPage } from './pages/CatalogPage'
import { RobotDetailPage } from './pages/RobotDetailPage'
import { ComparePage } from './pages/ComparePage'
import { AdminPage } from './pages/AdminPage'
import { DemoPage } from './pages/DemoPage'
import { SettingsPage } from './pages/SettingsPage'
import { HelpPage } from './pages/HelpPage'
import { PublicSharePage } from './pages/PublicSharePage'

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

function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastHost />
    </>
  )
}

function PublicHome() {
  const token = useAuthStore((s) => s.token)
  if (token) return <Navigate to="/app" replace />
  return <LandingPage />
}

/** Data router — нужен для useBlocker (защита несохранённых параметров). */
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PublicHome />} />
      <Route path="/p/:token" element={<PublicSharePage />} />

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
          <Route path="demo" element={<DemoPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>,
  ),
)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </QueryClientProvider>
  )
}
