import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, UserPlus, Clock, X } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, Button, Card, Modal, Field, Input, Select, Textarea } from '../components/ui/Primitives.jsx'
import Autocomplete from '../components/ui/Autocomplete.jsx'
import { formatLKR } from '../utils/format.js'
import { supabase } from '../utils/supabaseClient.js'

// Category names as they exist in item_categories.name.
// Adjust these strings if your seeded category names differ in casing/spelling.
const CATEGORY_MATCH = {
  coat: ['coat'],
  trouser: ['trouser'],
  west: ['west', 'vest'],
  national: ['national'],
}

export default function AddOrder() {
  const { orderStatuses, nextInvoiceNumber, addOrder, itemCategories, getCategoryName, businessProfile } = useApp()
  const navigate = useNavigate()

  const [dbCustomers, setDbCustomers] = useState([])
  const [dbItems, setDbItems] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  async function fetchCustomers(searchQuery = null) {
    let query = supabase
      .from('customers')
      .select('id, first_name, last_name, phone')
      .order('id', { ascending: false })
    
    if (searchQuery) {
      query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
    } else {
      query = query.limit(10)
    }
    
    const { data, error } = await query
    if (!error && data) {
      const customers = data.map(c => ({ id: c.id, firstName: c.first_name, lastName: c.last_name, phone: c.phone }))
      if (searchQuery) {
        setDbCustomers(customers)
      } else {
        setDbCustomers(customers)
      }
    }
  }

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('id, name, material, color, size, cost, item_category_id, coat_no, status')
      .eq('status', true)
      .order('name')
    if (!error && data) setDbItems(data)
  }

  useEffect(() => {
    async function fetchData() {
      setLoadingData(true)
      await Promise.all([fetchCustomers(), fetchItems()])
      setLoadingData(false)
    }
    fetchData()
  }, [])

  const handleCustomerSearch = useCallback((searchTerm) => {
    if (searchTerm.length >= 2) {
      setSearchingCustomers(true)
      fetchCustomers(searchTerm).finally(() => setSearchingCustomers(false))
    } else if (searchTerm.length === 0) {
      fetchCustomers()
    }
  }, [])



  // ---- Core order fields --------------------------------------------------
  const [customerId, setCustomerId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentReceived, setPaymentReceived] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [statusId, setStatusId] = useState('')
  const [isDryclean, setIsDryclean] = useState(false)
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (orderStatuses.length > 0 && !statusId) {
      setStatusId(String(orderStatuses[0].id))
    }
  }, [orderStatuses, statusId])

  // ---- Garment combo builder (Coat + Trouser + West + National -> one order line) ----
  const [draftCoatId, setDraftCoatId] = useState('')
  const [draftTrouserId, setDraftTrouserId] = useState('')
  const [draftWestId, setDraftWestId] = useState('')
  const [draftNationalId, setDraftNationalId] = useState('')
  const [draftPrice, setDraftPrice] = useState('')
  const [orderLines, setOrderLines] = useState([])

  const [unavailableItemIds, setUnavailableItemIds] = useState(new Set())
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  useEffect(() => {
    async function updateAvailability() {
      if (!startDate || !endDate) {
        setUnavailableItemIds(new Set())
        return
      }
      setCheckingAvailability(true)
      try {
        const cancelledStatusIds = orderStatuses.filter(s => /cancel/i.test(s.name)).map(s => s.id)
        
        const { data: overlappingOrders } = await supabase
          .from('orders')
          .select('id, status')
          .lte('start_date', endDate)
          .gte('end_date', startDate)
          
        const activeOrderIds = (overlappingOrders || [])
          .filter(o => !cancelledStatusIds.includes(o.status))
          .map(o => o.id)
          
        if (activeOrderIds.length === 0) {
          setUnavailableItemIds(new Set())
          return
        }
        
        const { data: conflicts } = await supabase
          .from('order_details')
          .select('coat, trouser, west, national')
          .in('order_id', activeOrderIds)
          
        const badIds = new Set()
        if (conflicts) {
          conflicts.forEach(d => {
            if (d.coat) badIds.add(String(d.coat))
            if (d.trouser) badIds.add(String(d.trouser))
            if (d.west) badIds.add(String(d.west))
            if (d.national) badIds.add(String(d.national))
          })
        }
        setUnavailableItemIds(badIds)
        
        setDraftCoatId(prev => badIds.has(String(prev)) ? '' : prev)
        setDraftTrouserId(prev => badIds.has(String(prev)) ? '' : prev)
        setDraftWestId(prev => badIds.has(String(prev)) ? '' : prev)
        setDraftNationalId(prev => badIds.has(String(prev)) ? '' : prev)
      } catch (err) {
        console.error('Failed to update availability', err)
      } finally {
        setCheckingAvailability(false)
      }
    }
    updateAvailability()
  }, [startDate, endDate, orderStatuses])

  const availableDbItems = useMemo(() => {
    return dbItems.filter(i => !unavailableItemIds.has(String(i.id)))
  }, [dbItems, unavailableItemIds])

  function categoryNameFor(item) {
    return (getCategoryName ? getCategoryName(item.item_category_id) : '') || ''
  }

  function itemsForCategory(key) {
    const aliases = CATEGORY_MATCH[key]
    return availableDbItems.filter(i => aliases.includes((categoryNameFor(i) || '').toLowerCase()))
  }

  const coatItems = useMemo(() => itemsForCategory('coat'), [availableDbItems, itemCategories])
  const trouserItems = useMemo(() => itemsForCategory('trouser'), [availableDbItems, itemCategories])
  const westItems = useMemo(() => itemsForCategory('west'), [availableDbItems, itemCategories])
  const nationalItems = useMemo(() => itemsForCategory('national'), [availableDbItems, itemCategories])

  const findItem = (id, list) => list.find(i => String(i.id) === String(id)) || null

  const draftAutoTotal = useMemo(() => {
    const items = [
      findItem(draftCoatId, coatItems),
      findItem(draftTrouserId, trouserItems),
      findItem(draftWestId, westItems),
      findItem(draftNationalId, nationalItems),
    ].filter(Boolean)
    return items.reduce((sum, i) => sum + (Number(i.rentPrice) || 0), 0)
  }, [draftCoatId, draftTrouserId, draftWestId, draftNationalId, coatItems, trouserItems, westItems, nationalItems])

  // Keep the price field in sync with selections unless the user has typed a custom value
  const [priceTouched, setPriceTouched] = useState(false)
  useEffect(() => {
    if (!priceTouched) setDraftPrice(draftAutoTotal ? String(draftAutoTotal) : '')
  }, [draftAutoTotal, priceTouched])

  function resetDraft() {
    setDraftCoatId('')
    setDraftTrouserId('')
    setDraftWestId('')
    setDraftNationalId('')
    setDraftPrice('')
    setPriceTouched(false)
  }

  function addOrderLine() {
    const coat = findItem(draftCoatId, coatItems)
    const trouser = findItem(draftTrouserId, trouserItems)
    const west = findItem(draftWestId, westItems)
    const national = findItem(draftNationalId, nationalItems)

    if (!coat && !trouser && !west && !national) return

    setOrderLines(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        coat,
        trouser,
        west,
        national,
        price: Number(draftPrice) || 0,
      },
    ])
    resetDraft()
  }

  function removeOrderLine(id) {
    setOrderLines(prev => prev.filter(l => l.id !== id))
  }

  const totalPrice = orderLines.reduce((sum, l) => sum + (l.price || 0), 0)
  const received = Number(paymentReceived) || 0
  const remaining = Math.max(totalPrice - received, 0)

  // ---- Check availability -------------------------------------------------
  const [availItemId, setAvailItemId] = useState('')
  const [availLoading, setAvailLoading] = useState(false)
  const [availResult, setAvailResult] = useState(null)

  const allItemsSorted = useMemo(
    () => [...dbItems].sort((a, b) => a.name.localeCompare(b.name)),
    [dbItems]
  )

  async function checkAvailability() {
    if (!availItemId || !startDate || !endDate) return
    setAvailLoading(true)
    setAvailResult(null)
    try {
      const item = dbItems.find(i => String(i.id) === String(availItemId))
      if (!item) return

      // Exclude cancelled orders from the conflict check, if such a status exists.
      const cancelledStatusIds = orderStatuses
        .filter(s => /cancel/i.test(s.name))
        .map(s => s.id)

      // order_details has no dates of its own — dates live on orders,
      // so first find orders whose date range overlaps the requested range.
      const { data: overlappingOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, status')
        .lte('start_date', endDate)
        .gte('end_date', startDate)

      if (ordersErr) throw ordersErr

      const activeOrderIds = (overlappingOrders || [])
        .filter(o => !cancelledStatusIds.includes(o.status))
        .map(o => o.id)

      if (activeOrderIds.length === 0) {
        setAvailResult({ available: true })
        return
      }

      const { data: conflicts, error: detailsErr } = await supabase
        .from('order_details')
        .select('order_id, coat, trouser, west, national')
        .in('order_id', activeOrderIds)
        .or(`coat.eq.${item.name},trouser.eq.${item.name},west.eq.${item.name},national.eq.${item.name}`)

      if (detailsErr) throw detailsErr

      setAvailResult({
        available: !conflicts || conflicts.length === 0,
        conflicts: conflicts || [],
        itemName: item.name,
      })
    } catch (err) {
      setAvailResult({ error: err.message })
    } finally {
      setAvailLoading(false)
    }
  }

  // ---- Add customer modal --------------------------------------------------
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    nic: '',
    phone: '',
    phone2: '',
    email: '',
    address: '',
  })

  async function handleAddCustomer(e) {
    e.preventDefault()
    if (!newCustomer.firstName || !newCustomer.phone) return
    setSavingCustomer(true)
    try {
      const { data: existing } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1)
      const nextId = existing?.[0]?.id ? Number(existing[0].id) + 1 : 1

      const { data, error } = await supabase
        .from('customers')
        .insert({
          id: nextId,
          first_name: newCustomer.firstName,
          last_name: newCustomer.lastName || null,
          nic: newCustomer.nic || null,
          phone: newCustomer.phone,
          phone1: newCustomer.phone2 || null,
          email: newCustomer.email || null,
          address: newCustomer.address || null,
        })
        .select('id, first_name, last_name, phone')
        .single()
      if (error) throw error

      setDbCustomers(prev => [
        { id: data.id, firstName: data.first_name, lastName: data.last_name, phone: data.phone },
        ...prev,
      ])
      setCustomerId(String(data.id))
      setShowAddCustomer(false)
      setNewCustomer({ firstName: '', lastName: '', nic: '', phone: '', phone2: '', email: '', address: '' })
    } catch (err) {
      alert(`Failed to add customer: ${err.message}`)
    } finally {
      setSavingCustomer(false)
    }
  }

  const [submitting, setSubmitting] = useState(false)

  // ---- Submit order --------------------------------------------------------
  async function submit(e) {
    e.preventDefault()
    if (!customerId || !startDate || !endDate || orderLines.length === 0) return
    setSubmitting(true)
    try {
      const orderDetails = orderLines.map(line => ({
        coat: line.coat?.id || null,
        trouser: line.trouser?.id || null,
        west: line.west?.id || null,
        national: line.national?.id || null,
        rentOrSalePrice: line.price || 0,
      }))
      const newOrder = await addOrder({
        customerId,
        startDate,
        endDate,
        subTotal: totalPrice,
        paymentReceived: received,
        remainingPayment: remaining,
        paymentMethod,
        status: Number(statusId),
        isDryclean,
        remark,
        orderDetails,
      })
      
      // Auto-print thermal POS receipt instantly
      if (window.require) {
        const { ipcRenderer } = window.require('electron')
        const safeCustomer = newOrder.customerData 
          ? { ...newOrder.customerData, lastName: newOrder.customerData.lastName || '' } 
          : null
          
        try {
          await ipcRenderer.invoke('print-escpos-receipt', { 
            data: { 
              order: newOrder, 
              customer: safeCustomer, 
              orderItems: newOrder.orderDetails || [], 
              businessProfile 
            },
            printerName: localStorage.getItem('erp_pos_printer') || 'Xprinter XP-80'
          })
        } catch (err) {
          console.error('Auto-print error:', err)
        }
      }

      // Navigate straight to orders page, skipping preview
      navigate('/orders')
    } catch (err) {
      alert(`Failed to submit order: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Rentals"
        title="Add New Order"
        description="Record a new rental or sale order for a customer."
        actions={<Link to="/orders"><Button variant="outline" icon={ArrowLeft}>Back to Orders</Button></Link>}
      />



      <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Customer & Dates */}
          <Card className="p-5">
            <h3 className="mb-4 font-display text-base font-semibold text-ink">Customer &amp; Rental Period</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
              <Field label="Select Customer" required className="sm:col-span-3">
                <div className="flex items-center gap-2">
                  <Autocomplete
                    required
                    value={customerId}
                    onChange={setCustomerId}
                    options={dbCustomers}
                    placeholder="Search customer by name or phone…"
                    displayKey={(c) => `${[c.firstName, c.lastName].filter(Boolean).join(' ')} ${c.phone ? `— ${c.phone}` : ''}`.trim()}
                    loading={searchingCustomers}
                    onSearch={handleCustomerSearch}
                    debounceMs={300}
                  />
                  <Button type="button" variant="brass" icon={UserPlus} onClick={() => setShowAddCustomer(true)}>
                    Add
                  </Button>
                </div>
              </Field>
              <Field label="Start Date" required>
                <Input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
              </Field>
              <Field label="End Date" required>
                <Input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} />
              </Field>
            </div>
          </Card>

          {/* Garment combo builder */}
          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-ink">Build Garment Line</h3>
            <p className="mb-4 text-xs text-muted">Pick a coat, trouser, west and/or national item, set the price, then add it as one order line.</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
              <Field label="Select Coat">
                <Autocomplete
                  disabled={!customerId || !startDate || !endDate}
                  loading={checkingAvailability}
                  value={draftCoatId}
                  onChange={setDraftCoatId}
                  options={coatItems}
                  placeholder="Search Coat…"
                  displayKey={i => i.coat_no || i.name}
                />
              </Field>
              <Field label="Select Trouser">
                <Autocomplete
                  disabled={!customerId || !startDate || !endDate}
                  loading={checkingAvailability}
                  value={draftTrouserId}
                  onChange={setDraftTrouserId}
                  options={trouserItems}
                  placeholder="Search Trouser…"
                  displayKey={i => i.coat_no || i.name}
                />
              </Field>
              <Field label="Select West">
                <Autocomplete
                  disabled={!customerId || !startDate || !endDate}
                  loading={checkingAvailability}
                  value={draftWestId}
                  onChange={setDraftWestId}
                  options={westItems}
                  placeholder="Search West…"
                  displayKey={i => i.coat_no || i.name}
                />
              </Field>
              <Field label="Select National">
                <Autocomplete
                  disabled={!customerId || !startDate || !endDate}
                  loading={checkingAvailability}
                  value={draftNationalId}
                  onChange={setDraftNationalId}
                  options={nationalItems}
                  placeholder="Search National…"
                  displayKey={i => i.coat_no || i.name}
                />
              </Field>
              <Field label="Sale/Rent Price">
                <Input
                  disabled={!customerId || !startDate || !endDate}
                  type="number"
                  min="0"
                  value={draftPrice}
                  onChange={e => { setDraftPrice(e.target.value); setPriceTouched(true) }}
                  placeholder="0.00"
                />
              </Field>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              icon={Plus} 
              className="mt-4" 
              onClick={addOrderLine}
              disabled={!customerId || !startDate || !endDate || !draftPrice || (!draftCoatId && !draftTrouserId && !draftWestId && !draftNationalId)}
            >
              Add
            </Button>

            {orderLines.length > 0 && (
              <div className="mt-5 space-y-2">
                <h4 className="text-sm font-medium text-ink">Order Lines ({orderLines.length})</h4>
                {orderLines.map(line => (
                  <div key={line.id} className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">
                        {[line.coat?.coat_no || line.coat?.name, line.trouser?.coat_no || line.trouser?.name, line.west?.coat_no || line.west?.name, line.national?.coat_no || line.national?.name].filter(Boolean).join(' + ')}
                      </p>
                      <p className="text-xs text-muted">
                        {[
                          line.coat && `Coat: ${line.coat.coat_no || line.coat.name}`,
                          line.trouser && `Trouser: ${line.trouser.coat_no || line.trouser.name}`,
                          line.west && `West: ${line.west.coat_no || line.west.name}`,
                          line.national && `National: ${line.national.coat_no || line.national.name}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-ink">{formatLKR(line.price)}</span>
                      <button
                        type="button"
                        onClick={() => removeOrderLine(line.id)}
                        className="rounded p-1 text-muted hover:bg-burgundy-50 hover:text-burgundy"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingData && dbItems.length === 0 && (
              <p className="mt-3 text-sm text-muted">No items available in inventory.</p>
            )}
          </Card>
        </div>

        {/* Right Panel */}
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-4 font-display text-base font-semibold text-ink">Payment</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span className="text-muted">Total Price ({orderLines.length} line{orderLines.length === 1 ? '' : 's'})</span>
                <span className="font-medium text-ink">{formatLKR(totalPrice)}</span>
              </div>
              <Field label="Payment Received (LKR)">
                <Input type="number" min="0" value={paymentReceived} onChange={e => setPaymentReceived(e.target.value)} placeholder="0.00" />
              </Field>
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span className="text-muted">Remaining Payment</span>
                <span className={remaining > 0 ? 'font-medium text-burgundy' : 'font-medium text-sage'}>{formatLKR(remaining)}</span>
              </div>
              <Field label="Payment Method">
                <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  {['Cash', 'Card', 'Bank Transfer', 'Online'].map(m => <option key={m}>{m}</option>)}
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-4 font-display text-base font-semibold text-ink">Order Details</h3>
            <div className="space-y-4">
              <Field label="Order Status">
                <Select value={statusId} onChange={e => setStatusId(e.target.value)}>
                  {orderStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={isDryclean} onChange={e => setIsDryclean(e.target.checked)} className="h-4 w-4 rounded border-line accent-brass" />
                Requires dry cleaning before handover
              </label>
              <Field label="Remark">
                <Textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional notes about this order…" />
              </Field>
            </div>
          </Card>

          <Button type="submit" variant="brass" className="w-full" size="lg" disabled={submitting} icon={submitting ? null : Plus}>
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving &amp; Printing…
              </span>
            ) : 'Submit Order & Generate Invoice'}
          </Button>
        </div>
      </form>

      {/* Add Customer modal */}
      <Modal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} title="Add Customer">
        <form onSubmit={handleAddCustomer} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First Name" required>
            <Input required value={newCustomer.firstName} onChange={e => setNewCustomer({ ...newCustomer, firstName: e.target.value })} />
          </Field>
          <Field label="Last Name">
            <Input value={newCustomer.lastName} onChange={e => setNewCustomer({ ...newCustomer, lastName: e.target.value })} />
          </Field>
          <Field label="NIC No.">
            <Input value={newCustomer.nic} onChange={e => setNewCustomer({ ...newCustomer, nic: e.target.value })} placeholder="e.g. 991234567V" />
          </Field>
          <Field label="Email">
            <Input type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
          </Field>
          <Field label="Contact No." required>
            <Input required value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="07XXXXXXXX" />
          </Field>
          <Field label="Contact No. 2">
            <Input value={newCustomer.phone2} onChange={e => setNewCustomer({ ...newCustomer, phone2: e.target.value })} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
            <Button type="submit" variant="brass" disabled={savingCustomer}>{savingCustomer ? 'Saving...' : 'Add Customer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}