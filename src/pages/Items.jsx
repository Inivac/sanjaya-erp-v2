import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Shirt, Tag } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { PageHeader, Button, Card, Modal, Field, Input, Select, EmptyState } from '../components/ui/Primitives.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatLKR } from '../utils/format.js'
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

const emptyForm = {
  name: '', categoryId: '', material: '', color: '#1B2430',
  size: '', cost: '', rentPrice: '', description: '', status: true
}

export default function Items() {
  const { addItem, updateItem, deleteItem, itemCategories, getCategoryName } = useApp()
  const confirm = useConfirm()
  
  const [paginatedItems, setPaginatedItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [dbLoading, setDbLoading] = useState(true)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 500)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const fetchItems = useCallback(async (currentPage, searchQuery, catFilter, statFilter) => {
    setDbLoading(true)
    try {
      let query = supabase.from('items').select('*', { count: 'exact' })
      
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,coat_no.ilike.%${searchQuery}%`)
      }
      if (catFilter !== 'All') {
        query = query.eq('item_category_id', parseInt(catFilter))
      }
      if (statFilter !== 'All') {
        query = query.eq('status', statFilter === 'Active')
      }
      
      query = query.order('id', { ascending: false })
      
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)
      
      const { data, count, error } = await query
      if (error) throw error

      setPaginatedItems(data.map(i => ({
        id: i.id,
        coatNo: i.coat_no,
        name: i.name,
        categoryId: i.item_category_id,
        material: i.material,
        color: i.color,
        size: i.size,
        cost: i.cost,
        rentPrice: i.rent_price,
        description: i.description,
        status: i.status
      })))
      if (count !== null) setTotalCount(count)
    } catch (err) {
      console.error('Failed to fetch items', err)
    } finally {
      setDbLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems(page, debouncedSearch, categoryFilter, statusFilter)
  }, [page, debouncedSearch, categoryFilter, statusFilter, fetchItems])

  useEffect(() => { setPage(1) }, [debouncedSearch, categoryFilter, statusFilter])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, categoryId: itemCategories[0]?.id || '' })
    setModalOpen(true)
  }
  function openEdit(item) {
    setEditing(item.id)
    setForm({
      coatNo: item.coatNo || '',
      name: item.name || '',
      categoryId: item.categoryId || '',
      material: item.material || '',
      color: item.color || '#1B2430',
      size: item.size || '',
      cost: item.cost || '',
      rentPrice: item.rentPrice || '',
      description: item.description || '',
      status: item.status,
    })
    setModalOpen(true)
  }

  async function submit(e) {
    e.preventDefault()
    const payload = { ...form, cost: Number(form.cost) || 0, rentPrice: Number(form.rentPrice) || 0 }
    try {
      if (editing) {
        const ok = await confirm({
          title: 'Save changes to this item?',
          message: `This will update the details for "${form.name}" (ID: ${editing}).`,
          confirmLabel: 'Save Changes',
          tone: 'default',
        })
        if (!ok) return
        await updateItem(editing, payload)
        
        // Optimistic update
        setPaginatedItems(prev => prev.map(i => i.id === editing ? { ...i, ...payload } : i))
      } else {
        const newItem = await addItem(payload)
        
        // Optimistic add (placed at top of grid)
        setPaginatedItems(prev => [newItem, ...prev])
        setTotalCount(prev => prev + 1)
      }
      setModalOpen(false)
    } catch (err) {
      alert(`Failed to save item: ${err.message}`)
    }
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: 'Delete this item?',
      message: `"${item.name}" will be permanently removed from inventory. This cannot be undone.`,
      confirmLabel: 'Delete Item',
      tone: 'danger',
    })
    if (ok) {
      try {
        await deleteItem(item.id)
        // Optimistic UI deletion
        setPaginatedItems(prev => prev.filter(i => i.id !== item.id))
        setTotalCount(prev => Math.max(0, prev - 1))
      } catch (err) {
        alert(`Failed to delete item: ${err.message}`)
      }
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Items"
        description="Coats, trousers, vests, national wear and accessories in stock."
        actions={<Button variant="brass" icon={Plus} onClick={openAdd}>Add New Item</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
          <Search size={15} className="text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or coat no…" className="w-full bg-transparent text-sm focus:outline-none" />
        </div>
        <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="sm:w-44">
          <option value="All">All Categories</option>
          {itemCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sm:w-36">
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {dbLoading ? (
           <div className="py-12 text-center text-muted">
             <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent"></div>
             <p className="mt-3 text-sm">Loading items…</p>
          </div>
        ) : paginatedItems.length === 0 ? (
          <EmptyState icon={Shirt} title="No items found" description="Try adjusting your search or filters, or add a new item." />
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Coat No</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Colour</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Rental Price</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(item => (
                    <tr key={item.id} className="border-t border-line/60 hover:bg-paper/50">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{item.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{item.coatNo || '—'}</td>
                      <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                      <td className="px-4 py-3 text-muted">{getCategoryName(item.categoryId)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block h-5 w-5 rounded-full border border-line" style={{ background: item.color }} />
                      </td>
                      <td className="px-4 py-3 text-muted">{item.size || '—'}</td>
                      <td className="px-4 py-3 text-ink">{item.cost ? formatLKR(item.cost) : '—'}</td>
                      <td className="px-4 py-3 text-ink">{item.rentPrice ? formatLKR(item.rentPrice) : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={item.status ? 'sage' : 'burgundy'}>{item.status ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink"><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(item)} className="rounded-lg p-1.5 text-muted hover:bg-burgundy-50 hover:text-burgundy"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-line px-4 py-3">
                <p className="text-sm text-muted">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} items
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Item' : 'Add New Item'}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Item Name" required>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Navy Two-Piece Coat" />
          </Field>
          {editing && (
            <Field label="Coat No">
              <Input value={form.coatNo || ''} readOnly disabled className="opacity-60 cursor-not-allowed" />
            </Field>
          )}
          <Field label="Category">
            <Select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">— Select —</option>
              {itemCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Material">
            <Input value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} placeholder="e.g. Wool Blend" />
          </Field>
          <Field label="Size">
            <Input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="e.g. 40R / M / 34" />
          </Field>
          <Field label="Colour">
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-10 w-full rounded-lg border border-line" />
          </Field>
          <Field label="Purchase Cost (LKR)">
            <Input type="number" min="0" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0.00" />
          </Field>
          <Field label="Rental Price (LKR)">
            <Input type="number" min="0" value={form.rentPrice} onChange={e => setForm({ ...form, rentPrice: e.target.value })} placeholder="0.00" />
          </Field>
          <Field label="Status">
            <Select value={form.status ? 'true' : 'false'} onChange={e => setForm({ ...form, status: e.target.value === 'true' })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes about this item…" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">{editing ? 'Save Changes' : 'Add Item'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
