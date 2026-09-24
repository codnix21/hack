import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Skeleton } from './ui/Skeleton'

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { token, user, hydrated, isGuest } = useAuthStore()
  const location = useLocation()

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-steel-50 p-8">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  if (adminOnly && isGuest) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
