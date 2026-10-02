import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Eye, Trash2, ClipboardList, FileText, CheckCircle2, Shirt } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { PageHeader, Button, Card, Select, EmptyState, Modal, Input } from '../components/ui/Primitives.jsx'
import InvoiceModal from '../components/InvoiceModal.jsx'
import ReturnModal from '../components/ReturnModal.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatLKR, formatDate } from '../utils/format.js'
import { supabase } from '../utils/supabaseClient.js'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

const ITEMS_PER_PAGE = 10

export default function Orders() {
  const { orderStatuses, getStatusName, updateOrder, deleteOrder, fetchOrderWithDetails, businessProfile } = useApp()
  const confirm = useConfirm()

  const [paginatedOrders, setPaginatedOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [dbLoading, setDbLoading] = useState(true)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 500)
  const [statusFilter, setStatusFilter] = useState('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState(null)
  const [invoicing, setInvoicing] = useState(null)
  const [loadingInvoiceId, setLoadingInvoiceId] = useState(null)
  const [returningOrder, setReturningOrder] = useState(null)

  const returnedStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'returned')?.id

  const fetchOrders = useCallback(async (currentPage, searchQuery, statFilter, fromFilter, toFilter) => {
    setDbLoading(true)
    try {
      let query = supabase.from('orders').select('*', { count: 'exact' })

      if (searchQuery) {
        const queryTerm = searchQuery.trim()
        const { data: matchedCustomers } = await supabase.from('customers')
          .select('id')
          .or(`first_name.ilike.%${queryTerm}%,last_name.ilike.%${queryTerm}%,phone.ilike.%${queryTerm}%`)

        const { data: matchedItems } = await supabase.from('items')
          .select('id')
          .or(`coat_no.ilike.%${queryTerm}%,name.ilike.%${queryTerm}%`)

        const custIds = matchedCustomers?.map(c => c.id) || []
        const itemIds = matchedItems?.map(i => i.id) || []

        let orderIds = []
        if (itemIds.length > 0) {
          const itemsList = `(${itemIds.slice(0, 100).join(',')})`
          const { data: matchedDetails } = await supabase.from('order_details')
            .select('order_id')
            .or(`coat.in.${itemsList},trouser.in.${itemsList},west.in.${itemsList},national.in.${itemsList}`)

          if (matchedDetails) {
            orderIds = [...new Set(matchedDetails.map(d => d.order_id))]
          }
        }

        const orClauses = [`invoice_number.ilike.%${queryTerm}%`]
        if (custIds.length > 0) orClauses.push(`customer_id.in.(${custIds.slice(0, 250).join(',')})`)
        if (orderIds.length > 0) orClauses.push(`id.in.(${orderIds.slice(0, 300).join(',')})`)

        query = query.or(orClauses.join(','))
      }
      if (statFilter !== 'All') {
        query = query.eq('status', parseInt(statFilter))
      }
      if (fromFilter) query = query.gte('start_date', fromFilter)
      if (toFilter) query = query.lte('start_date', toFilter)

      query = query.order('id', { ascending: false })

      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, count, error } = await query
      if (error) throw error

      const customerIds = [...new Set(data.map(o => o.customer_id).filter(Boolean))]
      let customersMap = {}
      if (customerIds.length > 0) {
        const { data: cData } = await supabase.from('customers').select('*').in('id', customerIds)
        if (cData) {
          cData.forEach(c => {
            customersMap[c.id] = {
              firstName: c.first_name,
              lastName: c.last_name,
              nic: c.nic,
              phone: c.phone,
              phone2: c.phone1,
              address: c.address
            }
          })
        }
      }

      setPaginatedOrders(data.map(o => ({
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
        isDryclean: Boolean(o.is_dryclean || o.dryclean_status),
        drycleanStatus: Boolean(o.dryclean_status || o.is_dryclean),
        dryclean_status: Boolean(o.dryclean_status || o.is_dryclean),
        remark: o.remark,
        createdAt: o.created_at,
        customerData: customersMap[o.customer_id] || null,
        orderDetails: []
      })))
      if (count !== null) setTotalCount(count)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setDbLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders(page, debouncedSearch, statusFilter, fromDate, toDate)
  }, [page, debouncedSearch, statusFilter, fromDate, toDate, fetchOrders])

  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, fromDate, toDate])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1

  async function handleDryCleanToggle(order) {
    const ok = await confirm({
      title: 'Update dry cleaning status?',
      message: `Mark invoice ${order.invoiceNumber || order.id} as ${order.isDryclean ? 'not requiring' : 'requiring'} dry cleaning.`,
      confirmLabel: 'Update',
      tone: 'default',
    })
    if (ok) {
      try {
        await updateOrder(order.id, { isDryclean: !order.isDryclean })
        fetchOrders(page, debouncedSearch, statusFilter, fromDate, toDate)
      } catch (err) {
        alert(`Failed to update dry cleaning status: ${err.message}`)
      }
    }
  }

  async function handleStatusChange(order, newStatusId) {
    const newId = Number(newStatusId)
    if (newId === order.status) return
    const newStatusName = getStatusName(newId)
    const isReturned = newStatusName?.toLowerCase() === 'returned'
    if (isReturned && order.remainingPayment > 0) {
      // Need full order with details for payment calculation
      const fullOrder = await fetchOrderWithDetails(order.id)
      setReturningOrder(fullOrder)
      return
    }
    const ok = await confirm({
      title: 'Change order status?',
      message: `Change invoice ${order.invoiceNumber || order.id} status to "${newStatusName}"?`,
      confirmLabel: 'Change Status',
      tone: 'default',
    })
    if (ok) {
      try {
        await updateOrder(order.id, { status: newId })
        fetchOrders(page, debouncedSearch, statusFilter, fromDate, toDate)
      } catch (err) {
        alert(`Failed to change order status: ${err.message}`)
      }
    }
  }

  async function handleDelete(order) {
    const ok = await confirm({
      title: 'Delete this order?',
      message: `Invoice ${order.invoiceNumber || order.id} and its rental record will be permanently removed.`,
      confirmLabel: 'Delete Order',
      tone: 'danger',
    })
    if (ok) {
      try {
        await deleteOrder(order.id)
        if (paginatedOrders.length === 1 && page > 1) {
          setPage(page - 1)
        } else {
          fetchOrders(page, debouncedSearch, statusFilter, fromDate, toDate)
        }
      } catch (err) {
        alert(`Failed to delete order: ${err.message}`)
      }
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Rentals"
        title="All Orders"
        description="Track rental orders from booking to return."
        actions={<Link to="/orders/new"><Button variant="brass" icon={Plus}>Add New Order</Button></Link>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
          <Search size={15} className="text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, customer, phone, item…" className="w-full bg-transparent text-sm focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36" />
          <span className="text-xs text-muted">to</span>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36" />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate('') }} className="text-xs text-muted hover:text-burgundy">Clear</button>
          )}
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sm:w-44">
          <option value="All">All Statuses</option>
          {orderStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {dbLoading ? (
          <div className="py-12 text-center text-muted">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent"></div>
            <p className="mt-3 text-sm">Loading orders…</p>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No orders found" description="Try adjusting your filters or create a new order." />
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Sub Total</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Dry Clean</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map(o => {
                    const c = o.customerData
                    return (
                      <tr key={o.id} className="border-t border-line/60 hover:bg-paper/50">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-mono text-xs font-medium text-ink">{o.invoiceNumber || `#${o.id}`}</span>
                            {o.drycleanStatus && (
                              <span className="flex w-fit items-center gap-1 rounded bg-brass/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brass-dark shadow-sm">
                                <Shirt size={10} /> Dry-Clean
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : '—'}</p>
                          <p className="text-xs text-muted">{c?.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDate(o.startDate)}</td>
                        <td className="px-4 py-3 font-medium text-ink">{formatLKR(o.subTotal)}</td>
                        <td className="px-4 py-3">{o.remainingPayment > 0 ? <span className="text-burgundy font-medium">{formatLKR(o.remainingPayment)}</span> : <span className="text-sage">Paid</span>}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDryCleanToggle(o)}
                            className={`h-5 w-9 rounded-full transition-colors ${o.isDryclean ? 'bg-brass' : 'bg-line'}`}
                          >
                            <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${o.isDryclean ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={o.status || ''}
                            onChange={e => handleStatusChange(o, e.target.value)}
                            className="rounded-full border border-line bg-white px-2 py-1 text-xs focus:border-brass focus:outline-none"
                          >
                            {orderStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {o.status !== returnedStatusId && returnedStatusId && (
                              <button onClick={() => handleStatusChange(o, returnedStatusId)} title="Mark as Returned" className="rounded-lg p-1.5 text-muted hover:bg-sage-50 hover:text-sage"><CheckCircle2 size={14} /></button>
                            )}
                            <button
                              onClick={async () => {
                                setLoadingInvoiceId(o.id)
                                try {
                                  const details = await fetchOrderWithDetails(o.id)
                                  if (details) {
                                    if (window.require) {
                                      const { ipcRenderer } = window.require('electron')
                                      const c = details.customerData
                                      const safeCustomer = c ? { ...c, lastName: c.lastName || '' } : null
                                      await ipcRenderer.invoke('print-escpos-receipt', {
                                        data: {
                                          order: details,
                                          customer: safeCustomer,
                                          orderItems: details.orderDetails || [],
                                          businessProfile
                                        },
                                        printerName: 'Xprinter XP-80'
                                      })
                                    } else {
                                      setInvoicing(details)
                                    }
                                  }
                                } catch (err) {
                                  console.error('Print failed:', err)
                                } finally {
                                  setLoadingInvoiceId(null)
                                }
                              }}
                              disabled={loadingInvoiceId === o.id}
                              title="View / print invoice"
                              className="rounded-lg p-1.5 text-muted hover:bg-brass-50 hover:text-brass-dark disabled:opacity-50"
                            >
                              {loadingInvoiceId === o.id ? (
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border border-brass border-t-transparent" />
                              ) : (
                                <FileText size={14} />
                              )}
                            </button>
                            <button onClick={async () => setViewing(await fetchOrderWithDetails(o.id))} title="View order details" className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink"><Eye size={14} /></button>
                            <button onClick={() => handleDelete(o)} title="Delete order" className="rounded-lg p-1.5 text-muted hover:bg-burgundy-50 hover:text-burgundy"><Trash2 size={14} /></button>
                          </div>
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

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Order ${viewing.invoiceNumber || `#${viewing.id}`}` : ''} width="max-w-xl">
        {viewing && (() => {
          const c = viewing.customerData
          return (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">{c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : '—'}</p>
                  <p className="text-xs text-muted">{c?.phone} · {c?.address}</p>
                </div>
                <Badge>{getStatusName(viewing.status)}</Badge>
              </div>
              {viewing.orderDetails && viewing.orderDetails.length > 0 && (
                <div className="rounded-lg border border-line divide-y divide-line">
                  {viewing.orderDetails.map(d => (
                    <div key={d.id} className="px-3 py-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-ink">
                          {[d.coat && `Coat: ${d.coat}`, d.trouser && `Trouser: ${d.trouser}`, d.west && `Vest: ${d.west}`, d.national && `National: ${d.national}`].filter(Boolean).join(' · ')}
                        </span>
                        <span className="text-muted">{formatLKR(d.rentOrSalePrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewing.isDryclean && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brass/10 text-brass-dark"><Shirt size={16} /></div>
                    <div>
                      <p className="font-medium text-ink">Dry Cleaning</p>
                      <p className="text-xs text-muted">Status of outsourced cleaning</p>
                    </div>
                  </div>
                  <Badge variant="warning">
                    Required
                  </Badge>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted">Rental Period</p><p className="font-medium text-ink">{formatDate(viewing.startDate)} – {formatDate(viewing.endDate)}</p></div>
                <div><p className="text-xs text-muted">Payment Method</p><p className="font-medium text-ink">{viewing.paymentMethod}</p></div>
                <div><p className="text-xs text-muted">Sub Total</p><p className="font-medium text-ink">{formatLKR(viewing.subTotal)}</p></div>
                <div><p className="text-xs text-muted">Balance Due</p><p className="font-medium text-burgundy">{formatLKR(viewing.remainingPayment)}</p></div>
              </div>
              {viewing.remark && <p className="mt-4 rounded-lg bg-paper px-3 py-2 text-xs text-muted">{viewing.remark}</p>}
              <div className="mt-5 flex justify-end">
                <Button variant="outline" icon={FileText} onClick={async () => { 
                    setViewing(null);
                    setLoadingInvoiceId(viewing.id);
                    try {
                      if (window.require) {
                        const { ipcRenderer } = window.require('electron')
                        const c = viewing.customerData
                        const safeCustomer = c ? { ...c, lastName: c.lastName || '' } : null
                        await ipcRenderer.invoke('print-escpos-receipt', {
                          data: {
                            order: viewing,
                            customer: safeCustomer,
                            orderItems: viewing.orderDetails || [],
                            businessProfile
                          },
                          printerName: 'Xprinter XP-80'
                        })
                      } else {
                        setInvoicing(viewing)
                      }
                    } finally {
                      setLoadingInvoiceId(null);
                    }
                }}>
                  Instant Print Receipt
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      <InvoiceModal open={!!invoicing} order={invoicing} onClose={() => setInvoicing(null)} />

      <ReturnModal
        open={!!returningOrder}
        order={returningOrder}
        onClose={() => setReturningOrder(null)}
        onConfirm={async (id, patch) => {
          await updateOrder(id, patch)
          fetchOrders(page, debouncedSearch, statusFilter, fromDate, toDate)
        }}
      />
    </div>
  )
}
