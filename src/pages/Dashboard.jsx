import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { Wallet, ClipboardList, Undo2, AlertTriangle, ArrowUpRight, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card, PageHeader, Button } from '../components/ui/Primitives.jsx'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import DateRangePicker from '../components/ui/DateRangePicker.jsx'
import { formatLKR, formatDate } from '../utils/format.js'
import { supabase } from '../utils/supabaseClient.js'

const TODAY = new Date().toISOString().slice(0, 10)

// Get current month start and end dates
function getCurrentMonthRange() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  // Format dates as YYYY-MM-DD in local time to avoid UTC offset issues
  const formatDateLocal = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return {
    startDate: formatDateLocal(firstDay),
    endDate: formatDateLocal(lastDay)
  }
}

const REVENUE_TREND = [
  { month: 'Mar', revenue: 148000, expenses: 96000 },
  { month: 'Apr', revenue: 162000, expenses: 101000 },
  { month: 'May', revenue: 171500, expenses: 108500 },
  { month: 'Jun', revenue: 159000, expenses: 99000 },
  { month: 'Jul', revenue: 188000, expenses: 112000 },
  { month: 'Aug', revenue: 205500, expenses: 118400 },
]

const PIE_COLORS = ['#B8863B', '#1B2430', '#7A2E2E', '#4E6B4E', '#D9B27C']

export default function Dashboard() {
  const { itemCategories, getStatusName, orderStatuses } = useApp()

  // Date range state - defaults to current month
  const [dateRange, setDateRange] = useState(getCurrentMonthRange())

  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    activeRentals: 0,
    overdue: [],
    dueToday: [],
    revenueMTD: 0,
    outstanding: 0,
    unpaidInvoices: 0,
    recentOrders: [],
    categoryData: [],
    totalItems: 0,
    revenueTrend: [],
  })

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true)
        
        const { data: result, error } = await supabase.rpc('get_dashboard_data', {
          p_start_date: dateRange.startDate,
          p_end_date: dateRange.endDate,
          p_limit_orders: 5,
          p_limit_due_today: 5
        })
        
        if (error) throw error
        
        const dashboardData = typeof result === 'string' ? JSON.parse(result) : result
        const kpis = dashboardData.kpis || {}
        const recentOrders = (dashboardData.recent_orders || []).map(o => ({
          id: o.id,
          invoiceNumber: o.invoice_number,
          customerData: o.customer_id ? {
            id: o.customer_id,
            first_name: o.customer_first_name,
            last_name: o.customer_last_name,
            phone: o.customer_phone
          } : null,
          startDate: o.start_date,
          endDate: o.end_date,
          subTotal: o.sub_total,
          status: o.status
        }))
        const dueToday = (dashboardData.due_back_today || []).map(o => ({
          id: o.id,
          invoice_number: o.invoice_number,
          customers: {
            first_name: o.customer_first_name,
            last_name: o.customer_last_name
          },
          order_details: Array(o.item_count || 0).fill({})
        }))
        const categoryData = (dashboardData.orders_by_status || []).map(c => ({
          name: c.status,
          value: c.count
        }))
        const revenueTrend = (dashboardData.revenue_vs_expenses || []).map(d => ({
          month: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: d.revenue,
          expenses: d.expenses,
          fullDate: d.day
        }))

        setDashboardData({
          activeRentals: kpis.active_rentals || 0,
          overdue: Array(kpis.overdue_returns || 0).fill({}),
          dueToday,
          revenueMTD: kpis.revenue_total || 0,
          outstanding: kpis.outstanding_payments || 0,
          unpaidInvoices: kpis.outstanding_invoices_count || 0,
          recentOrders,
          categoryData,
          totalItems: categoryData.reduce((sum, c) => sum + c.value, 0),
          revenueTrend,
          revenueMtdChangePct: kpis.revenue_change_pct
        })
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        setLoading(false)
      }
    }
    if (orderStatuses.length > 0) {
      loadDashboardData()
    }
  }, [orderStatuses, itemCategories, dateRange])

  if (loading) {
     return (
       <div>
         <PageHeader eyebrow="Overview" title="Good day, welcome back" description={`Here's what's happening at the shop — ${formatDate(TODAY)}`} />
         <div className="py-20 text-center text-muted">
           <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent mb-3"></div>
           <p className="text-sm">Loading dashboard metrics…</p>
         </div>
       </div>
     )
  }

  const { activeRentals, overdue, dueToday, revenueMTD, outstanding, unpaidInvoices, recentOrders, categoryData, totalItems, revenueTrend, revenueMtdChangePct } = dashboardData

  const revenueDelta = revenueMtdChangePct !== null 
    ? `${revenueMtdChangePct >= 0 ? '↑' : '↓'} ${Math.abs(revenueMtdChangePct)}% vs last month`
    : 'No data for comparison'

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Good day, welcome back"
        description={`Here's what's happening at the shop — ${formatDate(TODAY)}`}
        actions={
          <div className="flex items-center gap-2">
            <DateRangePicker 
              value={dateRange} 
              onChange={setDateRange}
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDateRange(getCurrentMonthRange())}
            >
              Reset
            </Button>
            <Link to="/orders/new"><Button variant="brass" icon={Plus}>New Order</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatLKR(revenueMTD)} icon={Wallet} accent="sage" delta={revenueDelta} deltaTone={revenueMtdChangePct >= 0 ? 'sage' : 'burgundy'} />
        <StatCard label="Active Rentals" value={activeRentals} icon={ClipboardList} accent="brass" delta={`${dueToday.length} due back today`} deltaTone={dueToday.length ? 'burgundy' : 'sage'} />
        <StatCard label="Outstanding Payments" value={formatLKR(outstanding)} icon={Undo2} accent="burgundy" delta={`${unpaidInvoices} unpaid invoices`} deltaTone="burgundy" />
        <StatCard label="Overdue Returns" value={overdue.length} icon={AlertTriangle} accent="burgundy" delta={overdue.length ? 'Needs follow-up' : 'All clear'} deltaTone={overdue.length ? 'burgundy' : 'sage'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">Revenue vs Expenses</h3>
              <p className="text-xs text-muted">Selected date range, in LKR</p>
            </div>
            <Badge tone="sage" dot={false}>Net {formatLKR(revenueTrend.reduce((s, m) => s + m.revenue - m.expenses, 0))}</Badge>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueTrend.length > 0 ? revenueTrend : REVENUE_TREND} margin={{ left: -18, right: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B8863B" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#B8863B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7A2E2E" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7A2E2E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4DDCC" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6255' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B6255' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #E4DDCC', fontSize: 12 }}
                formatter={(v) => formatLKR(v)}
              />
              <Area type="monotone" dataKey="revenue" stroke="#B8863B" fill="url(#rev)" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke="#7A2E2E" fill="url(#exp)" strokeWidth={2} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink">Orders by Status</h3>
          <p className="mb-2 text-xs text-muted">{totalItems} orders across {categoryData.length} statuses</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4DDCC', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {categoryData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {c.name} <span className="font-medium text-ink">{c.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">Recent Orders</h3>
            <Link to="/orders" className="flex items-center gap-1 text-xs font-medium text-brass-dark hover:underline">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Rental Period</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => {
                  const c = o.customerData
                  return (
                    <tr key={o.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 font-mono text-xs text-ink">{o.invoiceNumber || `#${o.id}`}</td>
                      <td className="py-2.5 text-ink">{c ? `${c.first_name} ${c.last_name}` : '—'}</td>
                      <td className="py-2.5 text-muted">{formatDate(o.startDate)} – {formatDate(o.endDate)}</td>
                      <td className="py-2.5 font-medium text-ink">{formatLKR(o.subTotal)}</td>
                      <td className="py-2.5"><Badge>{getStatusName(o.status)}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-ink">Due Back Today</h3>
          {dueToday.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No returns due today. 🎉</p>
          ) : (
            <div className="space-y-3">
              {dueToday.map(o => {
                const c = o.customers
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink">{c ? `${c.first_name} ${c.last_name}` : '—'}</p>
                      <p className="font-mono text-xs text-muted">{o.invoice_number || `#${o.id}`}</p>
                    </div>
                    <Badge tone="burgundy">{o.order_details?.length || 0} items</Badge>
                  </div>
                )
              })}
            </div>
          )}
          <Link to="/returns">
            <Button variant="outline" className="mt-4 w-full">Open Due Returns Report</Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
