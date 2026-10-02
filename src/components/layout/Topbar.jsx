import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, LogOut, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { initials } from '../../utils/format.js'
import { supabase } from '../../utils/supabaseClient.js'

export default function Topbar({ onMenu, collapsed, onToggleCollapse }) {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  function handleLogout() {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  if (!currentUser) return null

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-lg p-2 text-ink hover:bg-ink/5 lg:hidden">
          <Menu size={20} />
        </button>
        <button onClick={onToggleCollapse} className="hidden rounded-lg p-2 text-ink hover:bg-ink/5 lg:block">
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <div className="hidden items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 sm:flex">
          <Search size={15} className="text-muted" />
          <input
            placeholder="Search invoices, customers, items…"
            className="w-64 bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p className="hidden text-xs text-muted sm:block font-mono">
          {now.toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' })} · {now.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}
        </p>

        <div className="relative border-l border-line pl-4">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-ink/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
              {initials(currentUser.name)}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium text-ink">{currentUser.name}</p>
              <p className="text-xs text-muted">{currentUser.role}</p>
            </div>
            <ChevronDown size={14} className="hidden text-muted sm:block" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-40 mt-2 w-52 rounded-card border border-line bg-white py-1.5 shadow-pop">
                <div className="border-b border-line px-3 py-2">
                  <p className="text-sm font-medium text-ink">{currentUser.name}</p>
                  <p className="truncate text-xs text-muted">{currentUser.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-burgundy hover:bg-burgundy-50"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
