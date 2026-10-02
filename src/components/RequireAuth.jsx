import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/AppContext.jsx'

export default function RequireAuth({ children }) {
  const { isAuthenticated, authLoading, currentUser } = useAuth()
  const { loading: appLoading } = useApp()
  const location = useLocation()

  if (authLoading || appLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brass border-t-transparent mx-auto"></div>
          <p className="mt-2 text-sm text-muted font-medium">Loading workspace…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  // Restrict Laundry role to ONLY /laundry page

  if (currentUser?.role === 'Laundry' && location.pathname !== '/laundry') {
    return <Navigate to="/laundry" replace />
  }

  // Automatically redirect admins from root or unexpected paths? (Dashboard is standard)
  if (location.pathname === '/' && isAuthenticated) {
    return <Navigate to={currentUser?.role === 'Laundry' ? '/laundry' : '/dashboard'} replace />
  }

  return children
}
