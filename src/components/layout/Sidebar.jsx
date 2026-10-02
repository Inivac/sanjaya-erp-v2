import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, Shirt, Users, ClipboardList, Undo2,
  Wallet, BarChart3, Building2, Settings,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import logo from '../../assests/logo/logox.png'

const NAV = [
  {
    section: 'Overview', roles: ['Admin'], links: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ]
  },
  {
    section: 'Inventory', roles: ['Admin', 'user'], links: [
      { to: '/items', label: 'Items', icon: Shirt },
    ]
  },
  {
    section: 'Rentals', roles: ['Admin', 'user'], links: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/orders', label: 'Orders', icon: ClipboardList },
      { to: '/returns', label: 'Due Returns', icon: Undo2 },
    ]
  },
  {
    section: 'Finance', roles: ['Admin'], links: [
      { to: '/accounting', label: 'Accounting', icon: Wallet },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ]
  },
  {
    section: 'Laundry', roles: ['Admin', 'user', 'Laundry'], links: [
      { to: '/laundry', label: 'Dry Cleaning', icon: Shirt },
    ]
  },
  {
    section: 'Workspace', roles: ['Admin'], links: [
      { to: '/organization', label: 'Organization', icon: Building2 },
      { to: '/settings', label: 'Settings', icon: Settings },
    ]
  },
]

export default function Sidebar({ open, onClose, collapsed }) {
  const { businessProfile } = useApp()
  const { currentUser } = useAuth()
  
  const role = currentUser?.role || 'user'
  
  const visibleNav = NAV.filter(group => !group.roles || group.roles.includes(role))
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink/50 lg:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-ink text-white transition-all duration-300 ease-in-out lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'w-20' : 'w-64'
      )}>
        <div className={clsx("flex items-center border-b border-white/10 px-5 py-5", collapsed && 'justify-center px-0')}>
          <img src={logo} alt="Logo" className={clsx("h-12 w-auto transition-transform", collapsed && 'scale-75')} />
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((group) => (
            <div key={group.section} className="mb-5">
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.links.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) => clsx(
                      'flex items-center rounded-lg py-2 transition-colors',
                      collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                      isActive
                        ? 'bg-brass/15 text-brass-light font-medium'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="border-t border-white/10 px-4 py-4">
            <p className="text-[11px] leading-relaxed text-white/40">
              Software Powered by <a href="https://www.inivac.com" target="_blank" rel="noopener noreferrer">Inivac</a>
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
