import { useState, useEffect, useCallback } from 'react'
import { Undo2, CheckCircle2, Search } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, Card, Button, Input, EmptyState } from '../components/ui/Primitives.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatLKR, formatDate, daysBetween } from '../utils/format.js'
import ReturnModal from '../components/ReturnModal.jsx'
import { supabase } from '../utils/supabaseClient.js'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

const TODAY = new Date().toISOString().slice(0, 10)
const ITEMS_PER_PAGE = 10

export default function DueReturns() {
  const { orderStatuses, getStatusName, updateOrder, businessProfile, fetchOrderWithDetails } = useApp()
  
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(TODAY)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 500)
  
  const [paginatedResults, setPaginatedResults] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [dbLoading, setDbLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [returningOrder, setReturningOrder] = useState(null)

  const returnedStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'returned')?.id

  const fetchDueOrders = useCallback(async (currentPage, searchQuery, fromFilter, toFilter) => {
    if (returnedStatusId === undefined) return
    setDbLoading(true)
    try {
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .neq('status', returnedStatusId)

      if (fromFilter) query = query.gte('end_date', fromFilter)
      if (toFilter) query = query.lte('end_date', toFilter)

      if (searchQuery) {
        query = query.or(`invoice_number.ilike.%${searchQuery}%`)
      }

      query = query.order('created_at', { ascending: false })

      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, count, error } = await query
      if (error) throw error

      const orderIds = data.map(o => o.id)
      const customerIds = [...new Set(data.map(o => o.customer_id).filter(Boolean))]
      
      let customersMap = {}
      let detailsMap = {}
      let itemCoatMap = {}  // item id -> coat_no

      if (data.length > 0) {
        const [{ data: cData }, { data: dData }] = await Promise.all([
          customerIds.length > 0 ? supabase.from('customers').select('*').in('id', customerIds) : { data: [] },
          supabase.from('order_details').select('*').in('order_id', orderIds)
        ])
        
        if (cData) cData.forEach(c => customersMap[c.id] = { firstName: c.first_name, lastName: c.last_name, phone: c.phone, address: c.address })
        if (dData) {
          dData.forEach(d => {
            if (!detailsMap[d.order_id]) detailsMap[d.order_id] = []
            detailsMap[d.order_id].push(d)
          })
          // Collect all item IDs referenced in order_details
          const allItemIds = [...new Set(
            dData.flatMap(d => [d.coat, d.trouser, d.west, d.national].filter(id => id != null && id !== ''))
          )]
          if (allItemIds.length > 0) {
            const { data: iData } = await supabase.from('items').select('id, coat_no').in('id', allItemIds)
            if (iData) iData.forEach(i => { itemCoatMap[i.id] = i.coat_no || String(i.id) })
          }
        }
      }

      setPaginatedResults(data.map(o => ({
        id: o.id,
        invoiceNumber: o.invoice_number,
        customerId: o.customer_id,
        startDate: o.start_date,
        endDate: o.end_date,
        subTotal: o.sub_total || 0,
        paymentReceived: o.payment_received || 0,
        remainingPayment: o.remaining_payment || 0,
        paymentMethod: o.payment_method,
        status: o.status,
        isDryclean: o.is_dryclean,
        remark: o.remark,
        createdAt: o.created_at,
        customerData: customersMap[o.customer_id] || null,
        orderDetails: detailsMap[o.id] || [],
        itemCoatMap
      })))
      if (count !== null) setTotalCount(count)
    } catch (err) {
      console.error('Failed to fetch due returns:', err)
    } finally {
      setDbLoading(false)
    }
  }, [returnedStatusId])

  useEffect(() => {
    fetchDueOrders(page, debouncedSearch, fromDate, toDate)
  }, [page, debouncedSearch, fromDate, toDate, fetchDueOrders])

  useEffect(() => { setPage(1) }, [fromDate, toDate, debouncedSearch])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1

  async function markReturned(order) {
    if (order.remainingPayment > 0) {
      // Must have full order detail for return modal
      const fullOrder = await fetchOrderWithDetails(order.id)
      setReturningOrder(fullOrder)
    } else {
      try {
        await updateOrder(order.id, { status: returnedStatusId })
        fetchDueOrders(page, search, fromDate, toDate)
      } catch (err) {
        alert(`Failed to update order status: ${err.message}`)
      }
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Rentals"
        title="Due Returns Report"
        description="Garments due to be returned on or before the selected date."
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Return Date (From)</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="w-40">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">To</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
            <Search size={15} className="text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice…" className="w-full bg-transparent text-sm focus:outline-none" />
          </div>
          <div className="rounded-lg bg-paper px-4 py-2 text-sm">
            <span className="text-muted">Total Orders Due: </span>
            <span className="font-display text-base font-semibold text-brass-dark">{totalCount}</span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {dbLoading ? (
           <div className="py-12 text-center text-muted">
             <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent"></div>
             <p className="mt-3 text-sm">Loading due returns…</p>
          </div>
        ) : paginatedResults.length === 0 ? (
          <EmptyState icon={Undo2} title="No returns due" description="Nothing is due back on or before this date." />
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice #</th>
                    <th className="px-4 py-3 font-medium">Customer Details</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Rental Period</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map(o => {
                    const c = o.customerData
                    const overdueDays = daysBetween(o.endDate, TODAY)
                    const isLate = overdueDays > 0
                    const cm = o.itemCoatMap || {}
                    const coatNos = (o.orderDetails || []).flatMap(d =>
                      [d.coat, d.trouser, d.west, d.national]
                        .filter(id => id != null && id !== '')
                        .map(id => cm[id] || String(id))
                    )
                    return (
                      <tr key={o.id} className="border-t border-line/60 align-top hover:bg-paper/50">
                        <td className="px-4 py-3 font-mono text-xs text-ink">{o.invoiceNumber || `#${o.id}`}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{c ? `${c.firstName} ${c.lastName}` : '—'}</p>
                          <p className="text-xs text-muted">Phone: {c?.phone}</p>
                          <p className="text-xs text-muted">{c?.address}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted max-w-[180px]">
                          {coatNos.length === 0 ? '—' : coatNos.map((no, i) => (
                            <div key={i} className="font-mono">{no}</div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDate(o.startDate)} – {formatDate(o.endDate)}
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{formatLKR(o.subTotal)}</td>
                        <td className="px-4 py-3"><Badge tone={isLate ? 'burgundy' : 'brass'}>{isLate ? 'Overdue' : getStatusName(o.status)}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="subtle" icon={CheckCircle2} onClick={() => markReturned(o)}>
                            Mark Returned
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-line px-4 py-3">
                <p className="text-sm text-muted">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} orders
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <ReturnModal
        open={!!returningOrder}
        order={returningOrder}
        onClose={() => setReturningOrder(null)}
        onConfirm={async (id, patch) => {
          await updateOrder(id, patch)
          fetchDueOrders(page, search, fromDate, toDate)
        }}
      />
    </div>
  )
}
