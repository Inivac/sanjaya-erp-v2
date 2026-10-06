import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, UserPlus, Clock, X } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, Button, Card, Modal, Field, Input, Select, Textarea } from '../components/ui/Primitives.jsx'
import Autocomplete from '../components/ui/Autocomplete.jsx'
import { formatLKR } from '../utils/format.js'
import { supabase } from '../utils/supabaseClient.js'

// Keywords to match against category names (substring match, case-insensitive).
// A category name is matched if it CONTAINS any of the keywords.
const CATEGORY_KEYWORDS = {
  coat: ['coat'],
  trouser: ['trouser', 'pant'],
  west: ['west', 'vest'],
  national: ['national'],
}

export default function AddOrder() {
  const { id: editOrderId } = useParams()
  const isEditMode = Boolean(editOrderId)

  const { orderStatuses, nextInvoiceNumber, addOrder, updateFullOrder, fetchOrderWithDetails, itemCategories, getCategoryName, businessProfile } = useApp()
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
    const PAGE_SIZE = 1000
    let allData = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, material, color, size, cost, rent_price, item_category_id, coat_no, status')
        .eq('status', true)
        .order('id')
        .range(from, from + PAGE_SIZE - 1)

      if (error) { console.error('fetchItems error', error); break }
      if (data && data.length > 0) {
        allData = [...allData, ...data]
        from += PAGE_SIZE
        hasMore = data.length === PAGE_SIZE
      } else {
        hasMore = false
      }
    }

    if (allData.length > 0) setDbItems(allData)
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

  // ---- Load Order for Edit Mode --------------------------------------------
  useEffect(() => {
    if (isEditMode) {
      async function loadEditData() {
        try {
          const details = await fetchOrderWithDetails(editOrderId)
          if (!details) {
            alert('Order not found')
            navigate('/orders')
            return
          }
          const returnedStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'returned')?.id
          const cancelledStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'cancelled')?.id
          if ([returnedStatusId, cancelledStatusId].includes(details.status)) {
            alert('Returned or Cancelled orders cannot be edited.')
            navigate('/orders')
            return
          }
          if (details.customerData) {
            setDbCustomers(prev => {
              if (prev.find(c => String(c.id) === String(details.customerId))) return prev
              return [{
                id: details.customerData.id,
                firstName: details.customerData.firstName || details.customerData.first_name,
                lastName: details.customerData.lastName || details.customerData.last_name,
                phone: details.customerData.phone
              }, ...prev]
            })
          }
          console.log(details)
          setCustomerId(String(details.customerId || ''))
          setStartDate(details.startDate ? details.startDate.split('T')[0] : '')
          setEndDate(details.endDate ? details.endDate.split('T')[0] : '')
          setPaymentReceived(details.paymentReceived > 0 ? String(details.paymentReceived) : '')
          setPaymentMethod(details.paymentMethod || 'Cash')
          setStatusId(String(details.status || ''))
          setIsDryclean(details.dryclean_status || false)
          setRemark(details.remark || '')

          if (details.orderDetails && details.orderDetails.length > 0) {
            const mappedLines = details.orderDetails.map(d => ({
              id: Math.random().toString(36).substring(2, 9),
              coat: d.coat ? { id: d.coat, coat_no: d.coat_label?.split('—')[0]?.trim() || '', name: d.coat_label || '' } : null,
              trouser: d.trouser ? { id: d.trouser, coat_no: d.trouser_label?.split('—')[0]?.trim() || '', name: d.trouser_label || '' } : null,
              west: d.west ? { id: d.west, coat_no: d.west_label?.split('—')[0]?.trim() || '', name: d.west_label || '' } : null,
              national: d.national ? { id: d.national, coat_no: d.national_label?.split('—')[0]?.trim() || '', name: d.national_label || '' } : null,
              price: d.rentOrSalePrice || 0,
            }))
            setOrderLines(mappedLines)

            // Auto-select the first line into the draft fields for quick editing
            const firstLine = details.orderDetails[0]
            setDraftCoatId(firstLine.coat ? String(firstLine.coat) : '')
            setDraftTrouserId(firstLine.trouser ? String(firstLine.trouser) : '')
            setDraftWestId(firstLine.west ? String(firstLine.west) : '')
            setDraftNationalId(firstLine.national ? String(firstLine.national) : '')
            setDraftPrice(firstLine.rentOrSalePrice ? String(firstLine.rentOrSalePrice) : '')
            setPriceTouched(true)
          }
        } catch (err) {
          console.error(err)
        }
      }
      loadEditData()
    }
  }, [isEditMode, editOrderId, fetchOrderWithDetails, navigate])



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
        const excludedStatusIds = orderStatuses
          .filter(s => /cancel/i.test(s.name) || /return/i.test(s.name))
          .map(s => s.id)

        const { data: overlappingOrders } = await supabase
          .from('orders')
          .select('id, status')
          .lte('start_date', endDate)
          .gte('end_date', startDate)

        const activeOrderIds = (overlappingOrders || [])
          .filter(o => !excludedStatusIds.includes(o.status) && String(o.id) !== String(editOrderId))
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

  function categoryNameFor(item) {
    const cat = itemCategories.find(c => String(c.id) === String(item.item_category_id))
    return cat?.name || ''
  }

  function itemsInCategory(key) {
    const keywords = CATEGORY_KEYWORDS[key]
    return dbItems.filter(i => {
      const catName = categoryNameFor(i).toLowerCase().trim()
      return keywords.some(kw => catName.includes(kw))
    })
  }

  const coatItems = useMemo(() => itemsInCategory('coat'), [dbItems, itemCategories])
  const trouserItems = useMemo(() => itemsInCategory('trouser'), [dbItems, itemCategories])
  const westItems = useMemo(() => itemsInCategory('west'), [dbItems, itemCategories])
  const nationalItems = useMemo(() => itemsInCategory('national'), [dbItems, itemCategories])

  const isItemBooked = useCallback((item) => unavailableItemIds.has(String(item.id)), [unavailableItemIds])

  const findItem = (id, list) => list.find(i => String(i.id) === String(id)) || null

  const draftAutoTotal = useMemo(() => {
    const items = [
      findItem(draftCoatId, coatItems),
      findItem(draftTrouserId, trouserItems),
      findItem(draftWestId, westItems),
      findItem(draftNationalId, nationalItems),
    ].filter(Boolean)
    return items.reduce((sum, i) => sum + (Number(i.rent_price) || 0), 0)
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

      // Exclude cancelled AND returned orders from the conflict check.
      const excludedStatusIds = orderStatuses
        .filter(s => /cancel/i.test(s.name) || /return/i.test(s.name))
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
        .filter(o => !excludedStatusIds.includes(o.status))
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
  const [customerErrors, setCustomerErrors] = useState({})

  function validateCustomerField(field, value = '') {
    const val = value || ''
    switch (field) {
      case 'firstName':
        if (!val.trim()) return 'First name is required'
        if (val.length > 50) return 'Max 50 characters'
        return ''
      case 'lastName':
        if (val && val.length > 50) return 'Max 50 characters'
        return ''
      case 'phone':
      case 'phone2': {
        if (field === 'phone' && !val.trim()) return 'Phone number is required'
        if (!val) return ''
        if (!/^\d+$/.test(val)) return 'Only digits allowed'
        if (!val.startsWith('0')) return 'Must start with 0'
        if (val.length !== 10) return 'Must be exactly 10 digits'
        return ''
      }
      case 'nic':
        if (!val) return ''
        if (!/^(\d{9}[VvXx]|\d{12})$/.test(val)) return 'Invalid NIC (e.g. 991234567V or 199912345678)'
        return ''
      case 'email':
        if (!val) return ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Invalid email address'
        return ''
      case 'address':
        if (val && val.length > 200) return 'Max 200 characters'
        return ''
      default:
        return ''
    }
  }

  function handleCustomerField(field, value) {
    setNewCustomer(prev => ({ ...prev, [field]: value }))
    setCustomerErrors(prev => ({ ...prev, [field]: validateCustomerField(field, value) }))
  }

  const hasCustomerErrors = Object.values(customerErrors).some(Boolean)

  async function handleAddCustomer(e) {
    e.preventDefault()
    // Run full validation before submit
    const fields = ['firstName', 'lastName', 'phone', 'phone2', 'nic', 'email', 'address']
    const errors = {}
    fields.forEach(f => { errors[f] = validateCustomerField(f, newCustomer[f]) })
    setCustomerErrors(errors)
    if (Object.values(errors).some(Boolean)) return
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

      const newCust = { id: data.id, firstName: data.first_name, lastName: data.last_name, phone: data.phone }
      setDbCustomers(prev => [newCust, ...prev])
      setShowAddCustomer(false)
      setNewCustomer({ firstName: '', lastName: '', nic: '', phone: '', phone2: '', email: '', address: '' })
      setCustomerErrors({})
      // Set customerId after the new customer is committed to options so the
      // Autocomplete's useEffect can find it and display the name correctly.
      setTimeout(() => setCustomerId(String(data.id)), 0)
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

      const payload = {
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
      }

      let finalOrder
      if (isEditMode) {
        await updateFullOrder(editOrderId, payload)
        // Auto-print usually isn't necessary on every edit, but we can just navigate away
        navigate('/orders')
        return
      } else {
        finalOrder = await addOrder(payload)
      }

      // Auto-print thermal POS receipt instantly for new orders
      if (window.require && finalOrder) {
        const { ipcRenderer } = window.require('electron')
        const safeCustomer = finalOrder.customerData
          ? { ...finalOrder.customerData, lastName: finalOrder.customerData.lastName || '' }
          : null

        try {
          await ipcRenderer.invoke('print-escpos-receipt', {
            data: {
              order: finalOrder,
              customer: safeCustomer,
              orderItems: finalOrder.orderDetails || [],
              businessProfile
            },
            printerName: localStorage.getItem('erp_pos_printer') || businessProfile?.posPrinter || 'Xprinter XP-80'
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
        eyebrow={isEditMode ? "Edit Order" : "Rentals"}
        title={isEditMode ? `Edit Order #${editOrderId}` : "Add New Order"}
        description={isEditMode ? "Update the details for this order." : "Record a new rental or sale order for a customer."}
        actions={<Link to="/orders"><Button variant="outline" icon={ArrowLeft}>Back to Orders</Button></Link>}
      />



      <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_275px] xl:grid-cols-[1fr_285px]">
        <div className="space-y-5 min-w-0">
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
                  isDisabled={isItemBooked}
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
                  isDisabled={isItemBooked}
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
                  isDisabled={isItemBooked}
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
                  isDisabled={isItemBooked}
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

        {/* Right Panel (Payment & Order Details) */}
        <div className="space-y-5 min-w-0">
          <Card className="p-4 sm:p-5">
            <h3 className="mb-3.5 font-display text-base font-semibold text-ink">Payment</h3>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span className="text-muted text-xs sm:text-sm">Total Price ({orderLines.length} line{orderLines.length === 1 ? '' : 's'})</span>
                <span className="font-semibold text-ink">{formatLKR(totalPrice)}</span>
              </div>
              <Field label="Payment Received (LKR)">
                <Input
                  type="number"
                  min="0"
                  max={totalPrice || undefined}
                  value={paymentReceived}
                  onChange={e => {
                    const val = e.target.value
                    if (totalPrice > 0 && Number(val) > totalPrice) {
                      setPaymentReceived(String(totalPrice))
                    } else {
                      setPaymentReceived(val)
                    }
                  }}
                  placeholder="0.00"
                  className={totalPrice > 0 && Number(paymentReceived) > totalPrice ? 'border-burgundy ring-1 ring-burgundy' : ''}
                />
                {totalPrice > 0 && Number(paymentReceived) > totalPrice && (
                  <p className="mt-1 text-xs text-burgundy font-medium">
                    ⚠ Payment received cannot exceed total price ({formatLKR(totalPrice)})
                  </p>
                )}
              </Field>
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span className="text-muted text-xs sm:text-sm">Remaining Payment</span>
                <span className={remaining > 0 ? 'font-semibold text-burgundy' : 'font-semibold text-sage'}>{formatLKR(remaining)}</span>
              </div>
              <Field label="Payment Method">
                <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  {['Cash', 'Card', 'Bank Transfer', 'Online'].map(m => <option key={m}>{m}</option>)}
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="mb-3.5 font-display text-base font-semibold text-ink">Order Details</h3>
            <div className="space-y-3.5">
              <Field label="Order Status">
                <Select value={statusId} onChange={e => setStatusId(e.target.value)}>
                  {orderStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <label className="flex items-start gap-2 text-xs sm:text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={isDryclean} onChange={e => setIsDryclean(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-brass shrink-0" />
                <span className="leading-snug">Requires dry cleaning before handover</span>
              </label>
              <Field label="Remark">
                <Textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional notes about this order…" rows={3} />
              </Field>
            </div>
          </Card>

          <Button type="submit" variant="brass" className="w-full justify-center" size="lg" disabled={submitting} icon={submitting ? null : Plus}>
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </span>
            ) : isEditMode ? 'Update Order' : 'Submit Order & Generate Invoice'}
          </Button>
        </div>
      </form>

      {/* Add Customer modal */}
      <Modal open={showAddCustomer} onClose={() => { setShowAddCustomer(false); setCustomerErrors({}) }} title="Add Customer">
        <form onSubmit={handleAddCustomer} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="First Name" required>
            <Input
              required
              maxLength={50}
              value={newCustomer.firstName}
              onChange={e => handleCustomerField('firstName', e.target.value)}
              className={customerErrors.firstName ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.firstName && <p className="mt-1 text-xs text-burgundy">{customerErrors.firstName}</p>}
          </Field>
          <Field label="Last Name">
            <Input
              maxLength={50}
              value={newCustomer.lastName}
              onChange={e => handleCustomerField('lastName', e.target.value)}
              className={customerErrors.lastName ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.lastName && <p className="mt-1 text-xs text-burgundy">{customerErrors.lastName}</p>}
          </Field>
          <Field label="NIC No.">
            <Input
              value={newCustomer.nic}
              maxLength={12}
              onChange={e => handleCustomerField('nic', e.target.value)}
              placeholder="e.g. 991234567V or 199912345678"
              className={customerErrors.nic ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.nic && <p className="mt-1 text-xs text-burgundy">{customerErrors.nic}</p>}
          </Field>
          <Field label="Email">
            <Input
              type="text"
              value={newCustomer.email}
              onChange={e => handleCustomerField('email', e.target.value)}
              placeholder="name@example.com"
              className={customerErrors.email ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.email && <p className="mt-1 text-xs text-burgundy">{customerErrors.email}</p>}
          </Field>
          <Field label="Contact No." required>
            <Input
              required
              type="tel"
              maxLength={10}
              value={newCustomer.phone}
              onChange={e => handleCustomerField('phone', e.target.value.replace(/\D/g, ''))}
              placeholder="07XXXXXXXX"
              className={customerErrors.phone ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.phone
              ? <p className="mt-1 text-xs text-burgundy">{customerErrors.phone}</p>
              : <p className="mt-1 text-xs text-muted">10 digits, starting with 0</p>
            }
          </Field>
          <Field label="Contact No. 2">
            <Input
              type="tel"
              maxLength={10}
              value={newCustomer.phone2}
              onChange={e => handleCustomerField('phone2', e.target.value.replace(/\D/g, ''))}
              placeholder="07XXXXXXXX"
              className={customerErrors.phone2 ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.phone2 && <p className="mt-1 text-xs text-burgundy">{customerErrors.phone2}</p>}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea
              value={newCustomer.address}
              maxLength={200}
              onChange={e => handleCustomerField('address', e.target.value)}
            />
            <p className="mt-1 text-xs text-muted text-right">{newCustomer.address.length}/200</p>
            {customerErrors.address && <p className="mt-1 text-xs text-burgundy">{customerErrors.address}</p>}
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => { setShowAddCustomer(false); setCustomerErrors({}) }}>Cancel</Button>
            <Button type="submit" variant="brass" disabled={savingCustomer || hasCustomerErrors}>
              {savingCustomer ? 'Saving...' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}