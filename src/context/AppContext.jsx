import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient.js'
import { createClient } from '@supabase/supabase-js'
import { businessProfileSeed } from '../data/mockData.js'

const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const VITE_SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABSE_SERVICE_ROLE_KEY

let supabaseAdmin = supabase
if (VITE_SUPABASE_URL && VITE_SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: 'sb-admin-auth-token' }
  })
}

const AppContext = createContext(null)

// Map helper functions from DB (snake_case) to UI (camelCase)
const mapItemFromDb = (i) => i ? ({
  id: i.id,
  coatNo: i.coat_no,
  name: i.name,
  categoryId: i.item_category_id,
  material: i.material,
  color: i.color,
  size: i.size,
  cost: Number(i.cost || 0),
  rentPrice: Number(i.rent_price || 0),
  image: i.image,
  description: i.description,
  status: i.status, // boolean: true = active/available
  createdAt: i.created_at
}) : null

const mapCategoryFromDb = (c) => c ? ({ id: c.id, name: c.name }) : null

const mapOrderStatusFromDb = (s) => s ? ({ id: s.id, name: s.name, description: s.description }) : null

const mapCustomerFromDb = (c) => c ? ({
  id: c.id,
  firstName: c.first_name,
  lastName: c.last_name,
  nic: c.nic,
  email: c.email,
  phone: c.phone,
  phone2: c.phone1,
  address: c.address,
  createdOn: c.created_at
}) : null

const mapOrderDetailFromDb = (d) => d ? ({
  id: d.id,
  orderId: d.order_id,
  coat: d.coat,
  trouser: d.trouser,
  west: d.west,
  national: d.national,
  coat_label: d.coat_label,
  trouser_label: d.trouser_label,
  west_label: d.west_label,
  national_label: d.national_label,
  rentOrSalePrice: Number(d.rent_or_sale_price || 0)
}) : null

const mapOrderFromDb = (o) => o ? ({
  id: o.id,
  invoiceNumber: o.invoice_number,
  customerId: o.customer_id,
  customerData: o.customers ? mapCustomerFromDb(o.customers) : null,
  startDate: o.start_date,
  endDate: o.end_date,
  subTotal: Number(o.sub_total || 0),
  paymentReceived: Number(o.payment_received || 0),
  remainingPayment: Number(o.remaining_payment || 0),
  paymentMethod: o.payment_method,
  status: o.status, // integer referencing order_status.id
  isDryclean: Boolean(o.is_dryclean),
  drycleanStatus: Boolean(o.dryclean_status),
  dryclean_status: Boolean(o.dryclean_status),
  remark: o.remark,
  createdAt: o.created_at,
  // order_details joined
  orderDetails: o.order_details ? o.order_details.map(mapOrderDetailFromDb) : []
}) : null

const mapUserFromDb = (u) => u ? ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  lastLogin: u.last_login
}) : null

const mapProfileFromDb = (p) => p ? ({
  name: p.name,
  tagline: p.tagline,
  regNo: p.reg_no,
  taxId: p.tax_id,
  currency: p.currency,
  phone: p.phone,
  email: p.email,
  address: p.address,
  lateFeePerDay: Number(p.late_fee_per_day)
}) : null

export function AppProvider({ children }) {
  const [items, setItems] = useState([])
  const [itemCategories, setItemCategories] = useState([])
  const [orderStatuses, setOrderStatuses] = useState([])
  const [orders, setOrders] = useState([])
  const [expenses] = useState([])
  const [users, setUsers] = useState([])
  const [businessProfile, setBusinessProfile] = useState(businessProfileSeed)
  const [loading, setLoading] = useState(true)

  // Fetch initial data from Supabase DB on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [
          { data: dbCategories, error: errCats },
          { data: dbOrderStatuses, error: errStatuses },
          { data: dbUsers, error: errUsers },
          { data: dbProfile, error: errProfile }
        ] = await Promise.all([
          supabase.from('item_categories').select('*').order('name'),
          supabase.from('order_status').select('*').order('id'),
          supabase.from('users').select('*').order('name'),
          supabase.from('business_profile').select('*').eq('id', 1).maybeSingle()
        ])

        if (errCats) throw errCats
        if (errStatuses) throw errStatuses
        if (errUsers) throw errUsers
        if (errProfile) throw errProfile

        if (dbCategories) setItemCategories(dbCategories.map(mapCategoryFromDb))
        if (dbOrderStatuses) setOrderStatuses(dbOrderStatuses.map(mapOrderStatusFromDb))
        if (dbUsers) setUsers(dbUsers.map(mapUserFromDb))
        if (dbProfile) setBusinessProfile(mapProfileFromDb(dbProfile))
      } catch (err) {
        console.error('Error fetching initial data from Supabase:', err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ── Items ──────────────────────────────────────────────────────────────────

  const addItemCategory = useCallback(async (name) => {
    const { data, error } = await supabase.from('item_categories').insert({ name }).select().single()
    if (error) throw error
    setItemCategories(prev => [...prev, mapCategoryFromDb(data)].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [])

  const deleteItemCategory = useCallback(async (id) => {
    const { error } = await supabase.from('item_categories').delete().eq('id', id)
    if (error) throw error
    setItemCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  const addItem = useCallback(async (item) => {
    // Auto-generate coat_no: fetch all coat_no values, extract max numeric part, increment
    const { data: existing } = await supabase.from('items').select('coat_no')
    const maxNo = (existing || []).reduce((max, row) => {
      const num = parseInt(String(row.coat_no || '').replace(/\D/g, ''), 10)
      return isNaN(num) ? max : Math.max(max, num)
    }, 0)
    const coatNo = `ST${String(maxNo + 1).padStart(6, '0')}`

    const mapped = {
      coat_no: coatNo,
      item_category_id: item.categoryId || null,
      name: item.name,
      material: item.material || null,
      color: item.color || null,
      size: item.size || null,
      cost: item.cost || null,
      rent_price: item.rentPrice || null,
      image: item.image || null,
      description: item.description || null,
      status: item.status !== undefined ? item.status : true,
    }
    const { data, error } = await supabase.from('items').insert(mapped).select().single()
    if (error) throw error
    return mapItemFromDb(data)
  }, [])

  const updateItem = useCallback(async (id, patch) => {
    const mapped = {}
    if (patch.coatNo !== undefined) mapped.coat_no = patch.coatNo || null
    if (patch.categoryId !== undefined) mapped.item_category_id = patch.categoryId || null
    if (patch.name !== undefined) mapped.name = patch.name
    if (patch.material !== undefined) mapped.material = patch.material || null
    if (patch.color !== undefined) mapped.color = patch.color || null
    if (patch.size !== undefined) mapped.size = patch.size || null
    if (patch.cost !== undefined) mapped.cost = patch.cost || null
    if (patch.rentPrice !== undefined) mapped.rent_price = patch.rentPrice || null
    if (patch.image !== undefined) mapped.image = patch.image || null
    if (patch.description !== undefined) mapped.description = patch.description || null
    if (patch.status !== undefined) mapped.status = patch.status

    const { error } = await supabase.from('items').update(mapped).eq('id', id)
    if (error) throw error
  }, [])

  const deleteItem = useCallback(async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const addCustomer = useCallback(async (c) => {
    // Find highest ID and increment
    const { data: existing } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1)
    const nextId = existing?.[0]?.id ? Number(existing[0].id) + 1 : 1

    const createdOn = new Date().toISOString()
    const mapped = {
      id: nextId,
      first_name: c.firstName,
      last_name: c.lastName,
      nic: c.nic || null,
      email: c.email || null,
      phone: c.phone,
      phone1: c.phone2 || null,
      address: c.address,
      created_at: createdOn
    }
    const { error } = await supabase.from('customers').insert(mapped)
    if (error) throw error
  }, [])

  const updateCustomer = useCallback(async (id, patch) => {
    const mapped = {}
    if (patch.firstName !== undefined) mapped.first_name = patch.firstName
    if (patch.lastName !== undefined) mapped.last_name = patch.lastName
    if (patch.nic !== undefined) mapped.nic = patch.nic || null
    if (patch.email !== undefined) mapped.email = patch.email || null
    if (patch.phone !== undefined) mapped.phone = patch.phone
    if (patch.phone2 !== undefined) mapped.phone1 = patch.phone2 || null
    if (patch.address !== undefined) mapped.address = patch.address

    const { error } = await supabase.from('customers').update(mapped).eq('id', id)
    if (error) throw error
  }, [])

  const deleteCustomer = useCallback(async (id) => {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) throw error
  }, [])

  // ── Orders ─────────────────────────────────────────────────────────────────

  const fetchOrderWithDetails = useCallback(async (orderId) => {
    const { data: fullOrder } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (!fullOrder) return null
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from('order_details').select('*').eq('order_id', orderId),
      fullOrder.customer_id ? supabase.from('customers').select('*').eq('id', fullOrder.customer_id).maybeSingle() : { data: null }
    ])

    // Resolve item IDs to coat_no & name
    const details = d || []
    const itemIds = [...new Set(details.flatMap(x => [x.coat, x.trouser, x.west, x.national].filter(Boolean)))]
    let coatMap = {}
    if (itemIds.length > 0) {
      const { data: itemsData } = await supabase.from('items').select('id, coat_no, name').in('id', itemIds)
      if (itemsData) {
        itemsData.forEach(i => {
          const code = (i.coat_no || '').trim()
          const name = (i.name || '').trim()
          coatMap[i.id] = code && name ? `${code} — ${name}` : (code || name || String(i.id))
        })
      }
    }

    // Replace the raw IDs in the DB object with the newly resolved labels (store labels in _label, keep original IDs)
    const resolvedDetails = details.map(x => ({
      ...x,
      coat_label: x.coat ? coatMap[x.coat] || String(x.coat) : null,
      trouser_label: x.trouser ? coatMap[x.trouser] || String(x.trouser) : null,
      west_label: x.west ? coatMap[x.west] || String(x.west) : null,
      national_label: x.national ? coatMap[x.national] || String(x.national) : null,
    }))

    return mapOrderFromDb({ ...fullOrder, customers: c || null, order_details: resolvedDetails })
  }, [])

  const nextInvoiceNumber = useCallback(async () => {
    // To get next invoice safely across network, fetch highest id
    const { data } = await supabase.from('orders').select('id, invoice_number').order('id', { ascending: false }).limit(1)
    const next = data && data.length > 0 ? (data[0].id + 1 + 10000) : 10001
    return `INV${next}`
  }, [])

  const addOrder = useCallback(async (order) => {
    const invoiceNumber = order.invoiceNumber || (await nextInvoiceNumber())

    const orderRow = {
      invoice_number: invoiceNumber,
      customer_id: order.customerId,
      start_date: order.startDate,
      end_date: order.endDate,
      sub_total: order.subTotal,
      payment_received: order.paymentReceived,
      remaining_payment: order.remainingPayment,
      payment_method: order.paymentMethod,
      status: order.status, // integer
      is_dryclean: false,
      dryclean_status: order.isDryclean,
      remark: order.remark || null,
    }

    const { data: insertedOrder, error: orderErr } = await supabase
      .from('orders').insert(orderRow).select().single()
    if (orderErr) throw orderErr

    // Insert order_details
    if (order.orderDetails && order.orderDetails.length > 0) {
      const detailRows = order.orderDetails.map(d => ({
        order_id: insertedOrder.id,
        coat: d.coat || null,
        trouser: d.trouser || null,
        west: d.west || null,
        national: d.national || null,
        rent_or_sale_price: d.rentOrSalePrice || 0,
      }))
      const { error: detailErr } = await supabase.from('order_details').insert(detailRows)
      if (detailErr) throw detailErr
    }

    if (order.orderDetails && order.orderDetails.length > 0) {
      const laundryRows = []
      order.orderDetails.forEach(d => {
        const itemIds = [d.coat, d.trouser, d.west, d.national].filter(Boolean)
        itemIds.forEach(itemId => {
          laundryRows.push({
            order_id: insertedOrder.id,
            item_id: itemId,
            status: 'Pending'
          })
        })
      })
      if (laundryRows.length > 0) {
        const { error: lErr } = await supabase.from('laundry_items').insert(laundryRows)
        if (lErr) console.error('Failed to insert laundry items:', lErr)
      }
    }

    if (order.paymentReceived && order.paymentReceived > 0) {
      const { error: payErr } = await supabase.from('payments').insert({
        order_id: insertedOrder.id,
        amount: order.paymentReceived,
        payment_date: new Date().toISOString(),
        payment_method: order.paymentMethod,
        payment_type: 'Advance'
      })
      if (payErr) console.error('Failed to insert advance payment:', payErr)
    }

    // Fetch the full order + related data separately (no FK joins)
    const mappedOrder = await fetchOrderWithDetails(insertedOrder.id)
    return mappedOrder
  }, [nextInvoiceNumber, fetchOrderWithDetails])

  const updateOrder = useCallback(async (id, patch) => {
    const mapped = {}
    if (patch.customerId !== undefined) mapped.customer_id = patch.customerId
    if (patch.startDate !== undefined) mapped.start_date = patch.startDate
    if (patch.endDate !== undefined) mapped.end_date = patch.endDate
    if (patch.subTotal !== undefined) mapped.sub_total = patch.subTotal
    if (patch.paymentReceived !== undefined) mapped.payment_received = patch.paymentReceived
    if (patch.remainingPayment !== undefined) mapped.remaining_payment = patch.remainingPayment
    if (patch.paymentMethod !== undefined) mapped.payment_method = patch.paymentMethod
    if (patch.status !== undefined) mapped.status = patch.status
    // if (patch.isDryclean !== undefined) mapped.is_dryclean = patch.isDryclean
    if (patch.drycleanStatus !== undefined) mapped.dryclean_status = patch.drycleanStatus
    if (patch.remark !== undefined) mapped.remark = patch.remark || null

    if (patch.settlementAmount && patch.settlementAmount > 0) {
      const { error: pErr } = await supabase.from('payments').insert({
        order_id: id,
        amount: patch.settlementAmount,
        payment_date: new Date().toISOString(),
        payment_method: patch.paymentMethod || null,
        payment_type: 'Settlement'
      })
      if (pErr) console.error('Failed to insert settlement payment:', pErr)
    }

    const { error } = await supabase.from('orders').update(mapped).eq('id', id)
    if (error) throw error

    const returnedStatusId = orderStatuses.find(s => s.name?.toLowerCase() === 'returned')?.id
    if (patch.status !== undefined && patch.status === returnedStatusId) {
      const { data: details } = await supabase.from('order_details').select('*').eq('order_id', id)
      if (details && details.length > 0) {
        const laundryRows = []
        details.forEach(d => {
          const itemIds = [d.coat, d.trouser, d.west, d.national].filter(Boolean)
          itemIds.forEach(itemId => {
            laundryRows.push({
              order_id: id,
              item_id: itemId,
              status: 'Pending'
            })
          })
        })
        if (laundryRows.length > 0) {
          const { error: lErr } = await supabase.from('laundry_items').insert(laundryRows)
          if (lErr) console.error('Failed to queue laundry items on return:', lErr)
        }
      }
    }

    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
  }, [])

  const updateFullOrder = useCallback(async (id, order) => {
    // 1. Update orders table
    const mapped = {
      customer_id: order.customerId,
      start_date: order.startDate,
      end_date: order.endDate,
      sub_total: order.subTotal,
      payment_received: order.paymentReceived,
      remaining_payment: order.remainingPayment,
      payment_method: order.paymentMethod,
      status: order.status,
      // is_dryclean: order.isDryclean || false,
      remark: order.remark || null,
    }
    const { error: oErr } = await supabase.from('orders').update(mapped).eq('id', id)
    if (oErr) throw oErr

    // 2. Replace order_details
    const { error: delErr } = await supabase.from('order_details').delete().eq('order_id', id)
    if (delErr) throw delErr

    if (order.orderDetails && order.orderDetails.length > 0) {
      const detailRows = order.orderDetails.map(d => ({
        order_id: id,
        coat: d.coat || null,
        trouser: d.trouser || null,
        west: d.west || null,
        national: d.national || null,
        rent_or_sale_price: d.rentOrSalePrice || 0,
      }))
      const { error: detailErr } = await supabase.from('order_details').insert(detailRows)
      if (detailErr) throw detailErr
    }

    // Refresh context orders list slightly (though usually full refresh happens on page load)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...order } : o))
  }, [])

  const deleteOrder = useCallback(async (id) => {
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) throw error
    // Note: We no longer update global state
  }, [])

  // ── Expenses ───────────────────────────────────────────────────────────────

  const addExpense = useCallback(async (exp) => {
    // Generate next text id from DB to avoid collisions when local state is stale
    const { data: lastExpense, error: lastExpenseErr } = await supabase
      .from('expenses')
      .select('id')
      .like('id', 'EXP%')
      .order('id', { ascending: false })
      .limit(1)

    if (lastExpenseErr) throw lastExpenseErr

    const lastNum = lastExpense?.[0]?.id
      ? parseInt(String(lastExpense[0].id).replace(/\D/g, ''), 10) || 0
      : 0
    const next = lastNum + 1
    const id = `EXP${String(next).padStart(4, '0')}`
    const mapped = {
      id,
      date: exp.date,
      category: exp.category,
      amount: exp.amount,
      paid_by: exp.paidBy,
      note: exp.note || null
    }
    const { error } = await supabase.from('expenses').insert(mapped)
    if (error) throw error
  }, [])

  const deleteExpense = useCallback(async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
  }, [])

  // ── Users ──────────────────────────────────────────────────────────────────

  const addUser = useCallback(async (u) => {
    let userId = null

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true
    })

    if (authError) throw authError
    userId = authData?.user?.id

    if (!userId) throw new Error("Could not create user in auth table")

    const mapped = {
      id: userId,
      name: u.name,
      email: u.email,
      role: u.role,
      status: 'Invited',
      last_login: '—'
    }
    const { error: dbError } = await supabaseAdmin.from('users').insert(mapped)
    if (dbError) throw dbError

    setUsers(prev => [...prev, { id: userId, name: u.name, email: u.email, role: u.role, status: 'Invited', lastLogin: '—' }].sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  const updateUser = useCallback(async (id, patch) => {
    const mapped = {}
    if (patch.name !== undefined) mapped.name = patch.name
    if (patch.email !== undefined) mapped.email = patch.email
    if (patch.role !== undefined) mapped.role = patch.role
    if (patch.status !== undefined) mapped.status = patch.status
    if (patch.lastLogin !== undefined) mapped.last_login = patch.lastLogin

    const { error } = await supabase.from('users').update(mapped).eq('id', id)
    if (error) throw error
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }, [])

  const deleteUser = useCallback(async (id) => {
    // Note: Public users table FK cascade means deleting auth user deletes public user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) throw error
    setUsers(prev => prev.filter(u => u.id !== id))
  }, [])

  // ── Business Profile ───────────────────────────────────────────────────────

  const updateBusinessProfile = useCallback(async (form) => {
    const mapped = {
      name: form.name,
      tagline: form.tagline || null,
      reg_no: form.regNo || null,
      tax_id: form.taxId || null,
      currency: form.currency,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      late_fee_per_day: form.lateFeePerDay
    }
    const { error } = await supabase.from('business_profile').update(mapped).eq('id', 1)
    if (error) throw error
    setBusinessProfile(form)
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const findItem = useCallback((id) => items.find(i => i.id === id), [items])
  const getCategoryName = useCallback((id) => itemCategories.find(c => c.id === id)?.name || '—', [itemCategories])
  const getStatusName = useCallback((id) => orderStatuses.find(s => s.id === id)?.name || String(id), [orderStatuses])

  const value = useMemo(() => ({
    items, addItem, updateItem, deleteItem,
    itemCategories, getCategoryName, addItemCategory, deleteItemCategory,
    orderStatuses, getStatusName,
    addCustomer, updateCustomer, deleteCustomer,
    orders, addOrder, updateOrder, updateFullOrder, deleteOrder, nextInvoiceNumber, fetchOrderWithDetails,
    expenses, addExpense, deleteExpense,
    users, addUser, updateUser, deleteUser,
    businessProfile, setBusinessProfile: updateBusinessProfile,
    findItem,
    loading
  }), [
    items, itemCategories, orderStatuses, orders, expenses, users, businessProfile, loading,
    addItem, updateItem, deleteItem, getCategoryName, addItemCategory, deleteItemCategory, getStatusName,
    addCustomer, updateCustomer, deleteCustomer,
    addOrder, updateOrder, updateFullOrder, deleteOrder, nextInvoiceNumber, fetchOrderWithDetails,
    addExpense, deleteExpense, addUser, updateUser, deleteUser,
    updateBusinessProfile, findItem
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
