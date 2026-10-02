import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar.jsx'
import Topbar from './components/layout/Topbar.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Items from './pages/Items.jsx'
import Customers from './pages/Customers.jsx'
import Orders from './pages/Orders.jsx'
import AddOrder from './pages/AddOrder.jsx'
import DueReturns from './pages/DueReturns.jsx'
import Accounting from './pages/Accounting.jsx'
import Reports from './pages/Reports.jsx'
import Organization from './pages/Organization.jsx'
import Settings from './pages/Settings.jsx'
import Laundry from './pages/Laundry.jsx'

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar 
          onMenu={() => setSidebarOpen(true)} 
          collapsed={sidebarCollapsed} 
          onToggleCollapse={() => setSidebarCollapsed(c => !c)} 
        />
        <main className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl animate-in">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/items" element={<Items />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/new" element={<AddOrder />} />
              <Route path="/returns" element={<DueReturns />} />
              <Route path="/laundry" element={<Laundry />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/organization" element={<Organization />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  )
}
