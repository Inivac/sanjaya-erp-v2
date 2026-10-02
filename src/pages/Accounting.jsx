import { useMemo, useState, useEffect, useCallback } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, Search } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { PageHeader, Button, Card, Modal, Field, Input, Select, Textarea, EmptyState } from '../components/ui/Primitives.jsx'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatLKR, formatDate } from '../utils/format.js'
import { supabase } from '../utils/supabaseClient.js'

const DEFAULT_PAID_BY = 'Cash'

export default function Accounting() {
  const { addExpense, deleteExpense } = useApp()
  const confirm = useConfirm()
  const [tab, setTab] = useState('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({})
  
  const [expCats, setExpCats] = useState([])

  const [stats, setStats] = useState({ totalIncome: 0, totalExpenses: 0, outstanding: 0, expenseByCategory: [] })
  const [paginatedExpenses, setPaginatedExpenses] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [paidByFilter, setPaidByFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const fetchStatsAndExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: allOrders },
        { data: allExp }
      ] = await Promise.all([
        supabase.from('orders').select('payment_received, remaining_payment'),
        supabase.from('expenses').select('*').order('date', { ascending: false })
      ])
      
      const totalIncome = (allOrders || []).reduce((acc, o) => acc + (Number(o.payment_received) || 0), 0)
      const outstanding = (allOrders || []).reduce((acc, o) => acc + (Number(o.remaining_payment) || 0), 0)
      
      const expenses = allExp || []
      const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
      
      const expByCatObj = {}
      expenses.forEach(e => {
        if (!expByCatObj[e.category]) expByCatObj[e.category] = 0
        expByCatObj[e.category] += Number(e.amount) || 0
      })
      const expenseByCategory = Object.keys(expByCatObj).map(k => ({
        category: k,
        amount: expByCatObj[k]
      }))
      
      const recentExpenses = expenses.map(e => ({
        id: e.id,
        date: e.date,
        category: e.category,
        amount: e.amount,
        paidBy: e.paid_by,
        note: e.note
      }))
      
      setStats({
        totalIncome,
        totalExpenses,
        outstanding,
        expenseByCategory
      })
      setPaginatedExpenses(recentExpenses)
      setTotalCount(recentExpenses.length)
        
    } catch (err) {
      console.error('Failed to load accounting data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatsAndExpenses()
    
    // Load expense categories
    async function loadCats() {
      const { data } = await supabase.from('expense_categories').select('name').order('name')
      if (data) setExpCats(data.map(d => d.name))
    }
    loadCats()
  }, [fetchStatsAndExpenses])

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return paginatedExpenses.filter((e) => {
      const matchesSearch = !q || [e.id, e.category, e.paidBy, e.note, e.date]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))

      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter
      const matchesPaidBy = paidByFilter === 'all' || e.paidBy === paidByFilter
      const matchesFrom = !fromDate || e.date >= fromDate
      const matchesTo = !toDate || e.date <= toDate

      return matchesSearch && matchesCategory && matchesPaidBy && matchesFrom && matchesTo
    })
  }, [paginatedExpenses, search, categoryFilter, paidByFilter, fromDate, toDate])

  const netProfit = stats.totalIncome - stats.totalExpenses

  async function submit(e) {
    e.preventDefault()
    try {
      await addExpense({ ...form, amount: Number(form.amount) || 0 })
      setModalOpen(false)
      setForm({ date: new Date().toISOString().slice(0, 10), category: expCats[0] || '', amount: '', paidBy: DEFAULT_PAID_BY, note: '' })
      fetchStatsAndExpenses()
    } catch (err) {
      alert(`Failed to add expense: ${err.message}`)
    }
  }

  async function handleDelete(expense) {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: `"${expense.category}" — ${formatLKR(expense.amount)} on ${formatDate(expense.date)} will be permanently removed.`,
      confirmLabel: 'Delete Expense',
      tone: 'danger',
    })
    if (ok) {
      try {
        await deleteExpense(expense.id)
        fetchStatsAndExpenses()
      } catch (err) {
        alert(`Failed to delete expense: ${err.message}`)
      }
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Accounting"
        description="Income, expenses and profit &amp; loss for your business."
        actions={
          <Button variant="brass" icon={Plus} onClick={() => {
            setForm({ date: new Date().toISOString().slice(0, 10), category: expCats[0] || '', amount: '', paidBy: DEFAULT_PAID_BY, note: '' })
            setModalOpen(true)
          }}>Add Expense</Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Income" value={formatLKR(stats.totalIncome)} icon={TrendingUp} accent="sage" />
        <StatCard label="Total Expenses" value={formatLKR(stats.totalExpenses)} icon={TrendingDown} accent="burgundy" />
        <StatCard label="Net Profit" value={formatLKR(netProfit)} icon={Wallet} accent={netProfit >= 0 ? 'sage' : 'burgundy'} />
        <StatCard label="Outstanding from Customers" value={formatLKR(stats.outstanding)} icon={Wallet} accent="brass" />
      </div>

      <div className="mt-6 mb-4 flex gap-1.5 border-b border-line">
        {[{ id: 'overview', label: 'Overview' }, { id: 'expenses', label: 'Expenses Ledger' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'border-brass text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <Card className="p-5">
          <h3 className="mb-4 font-display text-base font-semibold text-ink">Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.expenseByCategory} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4DDCC" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#6B6255' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: '#6B6255' }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4DDCC', fontSize: 12 }} formatter={v => formatLKR(v)} />
              <Bar dataKey="amount" fill="#B8863B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line bg-paper/40 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="md:col-span-2 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
                <Search size={15} className="text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by ref, note, category..."
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
              <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {[...new Set(paginatedExpenses.map(e => e.category).filter(Boolean))].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select value={paidByFilter} onChange={e => setPaidByFilter(e.target.value)}>
                <option value="all">All Payment Methods</option>
                {[...new Set(paginatedExpenses.map(e => e.paidBy).filter(Boolean))].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>
          </div>
          {loading ? (
             <div className="py-12 text-center text-muted">
               <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent"></div>
               <p className="mt-3 text-sm">Loading expenses…</p>
             </div>
          ) : paginatedExpenses.length === 0 ? (
            <EmptyState icon={Wallet} title="No expenses recorded" description="Add your first business expense to start tracking." />
          ) : filteredExpenses.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted">No expenses matched your filters.</div>
          ) : (
            <>
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Ref</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Paid By</th>
                      <th className="px-4 py-3 font-medium">Note</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(e => (
                      <tr key={e.id} className="border-t border-line/60 hover:bg-paper/50">
                        <td className="px-4 py-3 font-mono text-xs text-ink">{e.id}</td>
                        <td className="px-4 py-3 text-muted">{formatDate(e.date)}</td>
                        <td className="px-4 py-3"><Badge tone="neutral">{e.category}</Badge></td>
                        <td className="px-4 py-3 text-muted">{e.paidBy}</td>
                        <td className="px-4 py-3 text-muted">{e.note}</td>
                        <td className="px-4 py-3 font-medium text-burgundy">-{formatLKR(e.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(e)} className="rounded-lg p-1.5 text-muted hover:bg-burgundy-50 hover:text-burgundy"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 border-t border-line px-4 py-3">
                <p className="text-sm text-muted">
                  Showing {filteredExpenses.length} of {totalCount} expenses (latest 10 loaded)
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Expense">
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <Input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Category" required>
            <Select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
              {expCats.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Amount (LKR)" required>
            <Input type="number" min="0" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </Field>
          <Field label="Paid By">
            <Select value={form.paidBy} onChange={e => setForm({ ...form, paidBy: e.target.value })}>
              {['Cash', 'Business Account', 'Card'].map(m => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="What was this expense for?" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">Add Expense</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
