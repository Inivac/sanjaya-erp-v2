import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Users, Phone, Mail } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { PageHeader, Button, Card, Modal, Field, Input, Textarea, EmptyState } from '../components/ui/Primitives.jsx'
import { formatDate } from '../utils/format.js'
import { supabase } from '../utils/supabaseClient.js'

// Custom debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

const emptyForm = { firstName: '', lastName: '', nic: '', email: '', phone: '', phone2: '', address: '' }

const ITEMS_PER_PAGE = 10

export default function Customers() {
  const { orders, addCustomer, updateCustomer, deleteCustomer } = useApp()
  const confirm = useConfirm()
  
  // Server-side State
  const [paginatedCustomers, setPaginatedCustomers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [dbLoading, setDbLoading] = useState(true)
  
  // UI State
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 500)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
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
    setForm(prev => ({ ...prev, [field]: value }))
    setCustomerErrors(prev => ({ ...prev, [field]: validateCustomerField(field, value) }))
  }

  const hasCustomerErrors = Object.values(customerErrors).some(Boolean)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1

  const fetchCustomers = useCallback(async (currentPage, searchQuery) => {
    setDbLoading(true)
    try {
      let query = supabase.from('customers').select('*', { count: 'exact' })
      
      if (searchQuery) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,nic.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
      }
      
      query = query.order('id', { ascending: false })
      
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      
      query = query.range(from, to)
      
      const { data, error, count } = await query
      
      if (error) throw error
      
      setPaginatedCustomers(data.map(c => ({
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        nic: c.nic,
        email: c.email,
        phone: c.phone,
        phone2: c.phone1,
        address: c.address,
        createdOn: c.created_at
      })))
      
      if (count !== null) setTotalCount(count)
    } catch (err) {
      console.error('Failed to fetch customers:', err.message)
    } finally {
      setDbLoading(false)
    }
  }, [])

  // Trigger fetch when page or debounced search changes
  useEffect(() => {
    fetchCustomers(page, debouncedSearch)
  }, [page, debouncedSearch, fetchCustomers])

  // Reset to page 1 on new search
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setCustomerErrors({})
    setModalOpen(true)
  }

  function openEdit(c) {
    setEditing(c.id)
    setForm({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      nic: c.nic || '',
      email: c.email || '',
      phone: c.phone || '',
      phone2: c.phone2 || '',
      address: c.address || '',
    })
    setCustomerErrors({})
    setModalOpen(true)
  }
  
  async function submit(e) {
    e.preventDefault()
    // Run full validation before submit
    const fields = ['firstName', 'lastName', 'phone', 'phone2', 'nic', 'email', 'address']
    const errors = {}
    fields.forEach(f => { errors[f] = validateCustomerField(f, form[f]) })
    setCustomerErrors(errors)
    if (Object.values(errors).some(Boolean)) return

    try {
      if (editing) {
        const ok = await confirm({
          title: 'Save changes to this customer?',
          message: `This will update the record for ${form.firstName} ${form.lastName}.`,
          confirmLabel: 'Save Changes',
          tone: 'default',
        })
        if (!ok) return
        await updateCustomer(editing, form)
      } else {
        await addCustomer(form)
      }
      setModalOpen(false)
      setCustomerErrors({})
      // Refetch current page to see changes immediately
      fetchCustomers(page, search)
    } catch (err) {
      alert(`Failed to save customer: ${err.message}`)
    }
  }
  
  async function handleDelete(c) {
    const count = orderCount(c.id)
    const ok = await confirm({
      title: 'Delete this customer?',
      message: `${c.firstName} ${c.lastName} will be permanently removed.${count ? ` They have ${count} order(s) on file, which will remain but no longer link to a customer record.` : ''} This cannot be undone.`,
      confirmLabel: 'Delete Customer',
      tone: 'danger',
    })
    if (ok) {
      try {
        await deleteCustomer(c.id)
        // Refetch current page
        fetchCustomers(page, search)
      } catch (err) {
        alert(`Failed to delete customer: ${err.message}`)
      }
    }
  }
  
  function orderCount(customerId) {
    return orders.filter(o => o.customer === customerId).length
  }

  return (
    <div>
      <PageHeader
        eyebrow="Rentals"
        title="Customers"
        description="Everyone who has rented or ordered tailoring services."
        actions={<Button variant="brass" icon={Plus} onClick={openAdd}>Add Customer</Button>}
      />

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 sm:max-w-sm">
        <Search size={15} className="text-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, NIC or phone…" className="w-full bg-transparent text-sm focus:outline-none" />
      </div>

      <Card className="overflow-hidden">
        {dbLoading ? (
          <div className="py-12 text-center text-muted">
             <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent"></div>
             <p className="mt-3 text-sm">Loading customers…</p>
          </div>
        ) : paginatedCustomers.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Try a different search, or add a new customer." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer Details</th>
                  <th className="px-4 py-3 font-medium">Contact Details</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Added On</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map(c => (
                  <tr key={c.id} className="border-t border-line/60 hover:bg-paper/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted">NIC: {c.nic || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5"><Phone size={13} className="text-muted" /> {c.phone}{c.phone2 && `, ${c.phone2}`}</p>
                      {c.email && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><Mail size={12} /> {c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted max-w-[200px] truncate">{c.address || '—'}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(c.createdOn)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(c)} className="rounded-lg p-1.5 text-muted hover:bg-burgundy-50 hover:text-burgundy"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {paginatedCustomers.length > 0 && totalPages > 1 && !dbLoading && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} customers
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
            <Button variant="outline" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setCustomerErrors({}) }} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="First Name" required>
            <Input
              required
              maxLength={50}
              value={form.firstName}
              onChange={e => handleCustomerField('firstName', e.target.value)}
              className={customerErrors.firstName ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.firstName && <p className="mt-1 text-xs text-burgundy">{customerErrors.firstName}</p>}
          </Field>
          <Field label="Last Name">
            <Input
              maxLength={50}
              value={form.lastName}
              onChange={e => handleCustomerField('lastName', e.target.value)}
              className={customerErrors.lastName ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.lastName && <p className="mt-1 text-xs text-burgundy">{customerErrors.lastName}</p>}
          </Field>
          <Field label="NIC No.">
            <Input
              value={form.nic}
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
              value={form.email}
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
              value={form.phone}
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
              value={form.phone2}
              onChange={e => handleCustomerField('phone2', e.target.value.replace(/\D/g, ''))}
              placeholder="07XXXXXXXX"
              className={customerErrors.phone2 ? 'border-burgundy ring-1 ring-burgundy' : ''}
            />
            {customerErrors.phone2 && <p className="mt-1 text-xs text-burgundy">{customerErrors.phone2}</p>}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea
              value={form.address}
              maxLength={200}
              onChange={e => handleCustomerField('address', e.target.value)}
            />
            <p className="mt-1 text-xs text-muted text-right">{(form.address || '').length}/200</p>
            {customerErrors.address && <p className="mt-1 text-xs text-burgundy">{customerErrors.address}</p>}
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setCustomerErrors({}) }}>Cancel</Button>
            <Button type="submit" variant="brass" disabled={hasCustomerErrors}>
              {editing ? 'Save Changes' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
