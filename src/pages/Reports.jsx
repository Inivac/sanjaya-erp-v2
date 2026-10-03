import { useState, useEffect, useCallback } from 'react'
import { Download, BarChart3, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, Card, Button, EmptyState, Input } from '../components/ui/Primitives.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatLKR, formatDate } from '../utils/format.js'
import { supabase } from '../utils/supabaseClient.js'
import logoImg from '../assests/logo/yellow_logo.jpg'

const REPORT_TABS = [
  { id: 'payments', label: 'Payments' },
]

const TODAY = new Date().toISOString().slice(0, 10)
const SIX_MONTHS_AGO = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() - 5, 1)
  return d.toISOString().slice(0, 10)
})()

function toCsv(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n')
}

function downloadCsv(filename, rows) {
  const csv = toCsv(rows)
  if (!csv) return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.setAttribute('download', filename)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { orderStatuses, getCategoryName, businessProfile } = useApp()
  const [tab, setTab] = useState('payments')
  const [fromDate, setFromDate] = useState(TODAY)
  const [toDate, setToDate] = useState(TODAY)
  const [search, setSearch] = useState('')
  const [salePage, setSalePage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    revenue: [],
    topCustomers: [],
    overdueOrders: []
  })

  const fetchReportsData = useCallback(async () => {
    try {
      setLoading(true)

      const overdueStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'overdue')?.id
      const returnedStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'returned')?.id
      const cancelledStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'cancelled')?.id



      let ordersQuery = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
      if (fromDate) ordersQuery = ordersQuery.gte('created_at', fromDate)
      if (toDate) ordersQuery = ordersQuery.lte('created_at', toDate)
      const { data: dbOrdersRaw } = await ordersQuery

      const customerIds = [...new Set((dbOrdersRaw || []).map(o => o.customer_id).filter(Boolean))]
      let cMap = {}
      if (customerIds.length > 0) {
        const { data: cData } = await supabase.from('customers').select('*').in('id', customerIds)
        if (cData) cData.forEach(c => { cMap[c.id] = c })
      }

      const q = search.trim().toLowerCase()
      const orders = (dbOrdersRaw || []).map(o => ({ ...o, customers: cMap[o.customer_id] || null }))
      const filteredOrders = !q ? orders : orders.filter(o => {
        const fullName = `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.trim().toLowerCase()
        return [o.invoice_number, fullName, o.customer_id, o.remark]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      })

      if (tab === 'payments') {
        let pQuery = supabase.from('payments').select('*').order('payment_date', { ascending: false })
        if (fromDate) pQuery = pQuery.gte('payment_date', fromDate)
        if (toDate) pQuery = pQuery.lte('payment_date', toDate)

        const { data: dbPayments, error: payErr } = await pQuery

        const orderIds = [...new Set((dbPayments || []).map(p => p.order_id).filter(Boolean))]
        let oMap = {}
        if (orderIds.length > 0) {
          const { data: oData } = await supabase.from('orders').select('id, invoice_number, customer_id, sub_total').in('id', orderIds)
          if (oData) oData.forEach(o => { oMap[o.id] = o })
        }

        const customerIds = [...new Set(Object.values(oMap).map(o => o.customer_id).filter(Boolean))]
        let cMap = {}
        if (customerIds.length > 0) {
          const { data: cData } = await supabase.from('customers').select('*').in('id', customerIds)
          if (cData) cData.forEach(c => { cMap[c.id] = c })
        }

        const q = search.trim().toLowerCase()
        const sales = (dbPayments || [])
          .map(p => {
            const ord = oMap[p.order_id]
            const cust = ord ? cMap[ord.customer_id] : null
            return {
              id: p.id,
              invoiceNumber: ord?.invoice_number || p.order_id,
              customerData: cust,
              date: p.payment_date,
              type: p.payment_type || 'Payment',
              paymentMethod: p.payment_method || 'Cash',
              totalAmount: ord?.sub_total || 0,
              paymentReceived: p.amount
            }
          })
          .filter(r => !q || [
            r.invoiceNumber,
            `${r.customerData?.first_name || ''} ${r.customerData?.last_name || ''}`.trim()
          ].filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
          .sort((a, b) => new Date(b.date) - new Date(a.date))

        setData(prev => ({ ...prev, revenue: sales }))
        setSalePage(1)

      } else if (tab === 'customers') {
        const customerMap = {}
        filteredOrders.forEach(o => {
          const cId = o.customer_id
          if (!cId) return
          if (!customerMap[cId]) customerMap[cId] = { total: 0, count: 0, customer: o.customers }
          customerMap[cId].total += Number(o.sub_total || 0)
          customerMap[cId].count += 1
        })
        const topCustomers = Object.values(customerMap)
          .filter(x => x.customer)
          .sort((a, b) => b.total - a.total)
          .slice(0, 30)
        setData(prev => ({ ...prev, topCustomers }))
      } else if (tab === 'overdue') {
        const overdueOrders = filteredOrders
          .filter((o) => {
            const isHistoricalOverdue = o.end_date && o.end_date < TODAY && Number(o.remaining_payment || 0) > 0
            const isMarkedOverdue = overdueStatusId !== undefined && o.status === overdueStatusId
            const isReturned = returnedStatusId !== undefined && o.status === returnedStatusId
            const isCancelled = cancelledStatusId !== undefined && o.status === cancelledStatusId
            return (isMarkedOverdue || isHistoricalOverdue) && !isReturned && !isCancelled
          })
          .map(o => ({
            id: o.id,
            invoiceNumber: o.invoice_number,
            customerData: o.customers,
            endDate: o.end_date,
            remainingPayment: o.remaining_payment
          }))
        setData(prev => ({ ...prev, overdueOrders }))
      }
    } catch (err) {
      console.error('Failed to load reports data', err)
    } finally {
      setLoading(false)
    }
  }, [orderStatuses, tab, fromDate, toDate, search])

  useEffect(() => {
    if (orderStatuses.length > 0) {
      fetchReportsData()
    }
  }, [orderStatuses, fetchReportsData])

  function handleExport() {
    const dateSuffix = `${fromDate || 'all'}_to_${toDate || 'all'}`

    if (tab === 'payments') {
      const rows = data.revenue.map(r => ({
        Invoice: r.invoiceNumber || `#${r.id}`,
        Customer: r.customerData ? [r.customerData.first_name, r.customerData.last_name].filter(Boolean).join(' ') : '—',
        Type: r.type,
        Date: r.date,
        Total_Amount_LKR: r.totalAmount,
        Paid_Amount_LKR: r.paymentReceived,
      }))
      downloadCsv(`${tab}_report_${dateSuffix}.csv`, rows)
      return
    }


    if (tab === 'customers') {
      const rows = data.topCustomers.map(({ customer, total, count }) => ({
        Customer_ID: customer.id,
        Customer: [customer.first_name, customer.last_name].filter(Boolean).join(' '),
        Orders: count,
        Total_Spend_LKR: total,
      }))
      downloadCsv(`top_customers_${dateSuffix}.csv`, rows)
      return
    }

    const rows = data.overdueOrders.map(o => ({
      Invoice: o.invoiceNumber || `#${o.id}`,
      Customer: o.customerData ? [o.customerData.first_name, o.customerData.last_name].filter(Boolean).join(' ') : '—',
      Due_Date: o.endDate,
      Outstanding_LKR: o.remainingPayment,
    }))
    downloadCsv(`overdue_orders_${dateSuffix}.csv`, rows)
  }

  async function handlePdfExport() {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width

    // 1. Header Section
    // Logo
    const img = new Image()
    img.src = logoImg
    await new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
    })

    if (img.complete && img.naturalWidth > 0) {
      doc.addImage(img, 'PNG', 14, 12, 28, 14)
    }

    // Company Information (Right aligned)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(27, 36, 48)
    doc.text(businessProfile?.name || 'Sanjaya Professional Tailors', pageWidth - 14, 18, { align: 'right' })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(107, 98, 85)
    doc.text(businessProfile?.address || '', pageWidth - 14, 24, { align: 'right' })

    const contactInfo = [
      businessProfile?.phone ? `Tel: ${businessProfile.phone}` : '',
      businessProfile?.email ? `Email: ${businessProfile.email}` : ''
    ].filter(Boolean).join(' | ')
    doc.text(contactInfo, pageWidth - 14, 29, { align: 'right' })

    // Divider Line
    doc.setDrawColor(228, 221, 204)
    doc.setLineWidth(0.5)
    doc.line(14, 35, pageWidth - 14, 35)

    // 2. Report Details
    const dateSuffix = `${fromDate || 'all'}_to_${toDate || 'all'}`
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(27, 36, 48)
    const tabLabel = 'Payments Report'
    doc.text(tabLabel, 14, 45)

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 98, 85)
    const dateRangeStr = (fromDate && toDate) ? `${formatDate(fromDate)}  —  ${formatDate(toDate)}` : 'All Time'
    doc.text(`Period: ${dateRangeStr}`, 14, 51)
    doc.text(`Generated: ${formatDate(TODAY)}`, 14, 56)

    // 3. Table Data
    const tableColumn = ["Invoice", "Customer", "Date", "Description", "Order Subtotal", "Paid Amount"]
    const tableRows = []

    data.revenue.forEach(r => {
      const rowData = [
        r.invoiceNumber || `#${r.id}`,
        r.customerData ? [r.customerData.first_name, r.customerData.last_name].filter(Boolean).join(' ') : '—',
        formatDate(r.date),
        r.type || 'Payment',
        formatLKR(r.totalAmount),
        formatLKR(r.paymentReceived),
      ]
      tableRows.push(rowData)
    })

    const totalInvoices = data.revenue.length
    const totalSum = data.revenue.reduce((acc, r) => acc + Number(r.totalAmount || 0), 0)
    const paidSum = data.revenue.reduce((acc, r) => acc + Number(r.paymentReceived || 0), 0)

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [[
        { content: `${totalInvoices} Records`, colSpan: 4, styles: { halign: 'left' } },
        { content: formatLKR(totalSum), styles: { textColor: [66, 115, 87], halign: 'right' } },
        { content: formatLKR(paidSum), styles: { textColor: [66, 115, 87], halign: 'right' } },
      ]],
      startY: 62,
      theme: 'grid',
      styles: {
        fontSize: 9,
        font: 'helvetica',
        cellPadding: 4,
        lineColor: [228, 221, 204],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [235, 235, 235],
        textColor: [27, 36, 48],
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [228, 221, 204],
      },
      footStyles: {
        fillColor: [250, 249, 245],
        textColor: [27, 36, 48],
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [228, 221, 204],
      },
      alternateRowStyles: {
        fillColor: [252, 251, 249]
      },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right', textColor: [66, 115, 87], fontStyle: 'bold' }
      }
    })

    // 5. Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(160, 160, 160)
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.height - 10, { align: 'right' })
    }

    doc.save(`sales_report_${dateSuffix}.pdf`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Reports"
        description="Business performance across revenue, inventory and customers."
      />

      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-line">
        {REPORT_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'border-brass text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          <div className="md:col-span-2 flex gap-2">
            <div className="flex-1">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search invoice, customer, note…"
              />
            </div>
            {tab === 'payments' && (
              <Button variant="outline" icon={FileText} onClick={handlePdfExport}>
                Export PDF
              </Button>
            )}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="py-20 text-center text-muted">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent mb-3"></div>
          <p className="text-sm">Generating reports…</p>
        </div>
      ) : (
        <>
          {tab === 'payments' && (
            <Card className="overflow-hidden">
              {data.revenue.length === 0 ? <EmptyState icon={BarChart3} title="No data found for this period" /> : (
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Invoice</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Order Subtotal</th>
                        <th className="px-4 py-3 font-medium text-right">Payment Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenue.slice((salePage - 1) * 10, salePage * 10).map(s => (
                        <tr key={s.id} className="border-t border-line/60">
                          <td className="px-4 py-3 font-mono text-xs text-ink">{s.invoiceNumber || `#${s.id}`}</td>
                          <td className="px-4 py-3 text-ink">{s.customerData ? [s.customerData.first_name, s.customerData.last_name].filter(Boolean).join(' ') : '—'}</td>
                          <td className="px-4 py-3 text-muted">{formatDate(s.date)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${s.type === 'Settlement' ? 'bg-sage-50 text-sage' : 'bg-brass-50 text-brass-dark'}`}>
                              {s.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{formatLKR(s.totalAmount)}</td>
                          <td className="px-4 py-3 font-medium text-sage text-right">{formatLKR(s.paymentReceived)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.revenue.length > 10 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-3">
                  <p className="text-xs text-muted">
                    Showing {(salePage - 1) * 10 + 1} to {Math.min(salePage * 10, data.revenue.length)} of {data.revenue.length} results
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSalePage(p => Math.max(1, p - 1))} disabled={salePage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setSalePage(p => Math.min(Math.ceil(data.revenue.length / 10), p + 1))} disabled={salePage >= Math.ceil(data.revenue.length / 10)}>Next</Button>
                  </div>
                </div>
              )}
            </Card>
          )}


          {tab === 'customers' && (
            <Card className="overflow-hidden">
              {data.topCustomers.length === 0 ? <EmptyState icon={BarChart3} title="No customer activity yet" /> : (
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Orders</th>
                        <th className="px-4 py-3 font-medium">Total Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCustomers.map(({ customer, total, count }) => (
                        <tr key={customer.id} className="border-t border-line/60">
                          <td className="px-4 py-3 font-medium text-ink">{[customer.first_name, customer.last_name].filter(Boolean).join(' ')}</td>
                          <td className="px-4 py-3 text-muted">{count}</td>
                          <td className="px-4 py-3 font-medium text-ink">{formatLKR(total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'overdue' && (
            <Card className="overflow-hidden">
              {data.overdueOrders.length === 0 ? <EmptyState icon={BarChart3} title="No overdue orders" description="Great — everything is on schedule." /> : (
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Invoice</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Due Date</th>
                        <th className="px-4 py-3 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.overdueOrders.map(o => {
                        const c = o.customerData
                        return (
                          <tr key={o.id} className="border-t border-line/60">
                            <td className="px-4 py-3 font-mono text-xs text-ink">{o.invoiceNumber || `#${o.id}`}</td>
                            <td className="px-4 py-3 text-ink">{c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '—'}</td>
                            <td className="px-4 py-3 text-muted">{formatDate(o.endDate)}</td>
                            <td className="px-4 py-3 font-medium text-burgundy">{formatLKR(o.remainingPayment)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
