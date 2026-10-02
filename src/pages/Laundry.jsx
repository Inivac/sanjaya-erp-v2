import { useState, useEffect } from 'react'
import { Shirt, Search } from 'lucide-react'
import { PageHeader, Card, EmptyState } from '../components/ui/Primitives.jsx'
import { supabase } from '../utils/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Laundry() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'Admin'
  
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function fetchLaundryItems() {
    setLoading(true)
    const { data: laundryData, error } = await supabase
      .from('laundry_items')
      .select('*, orders!inner(invoice_number, is_dryclean)')
      .eq('orders.is_dryclean', true)
      .order('id', { ascending: false })
      
    if (error) {
      alert(`Failed to load dry cleaning items: ${error.message}`)
      setLoading(false)
      return
    }

    if (!laundryData || laundryData.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    const itemIds = [...new Set(laundryData.map(l => l.item_id).filter(Boolean))]
    let itemMap = {}
    if (itemIds.length > 0) {
      const { data: iData } = await supabase.from('items').select('id, coat_no').in('id', itemIds)
      if (iData) iData.forEach(i => { itemMap[i.id] = i.coat_no || String(i.id) })
    }

    const mapped = laundryData.map(l => ({
      id: l.id,
      itemId: l.item_id,
      itemCode: itemMap[l.item_id] || `#${l.item_id}`,
      status: l.status || 'Pending',
      invoiceNumber: l.orders?.invoice_number || '—'
    }))

    setItems(mapped)
    setLoading(false)
  }

  useEffect(() => {
    fetchLaundryItems()
  }, [])

  async function handleStatusChange(rowId, newStatus) {
    // Optimistic UI update
    setItems(prev => prev.map(o => o.id === rowId ? { ...o, status: newStatus } : o))
    
    const { error } = await supabase
      .from('laundry_items')
      .update({ status: newStatus })
      .eq('id', rowId)
    
    if (error) {
      alert(`Failed to update status: ${error.message}`)
      // Revert if error
      fetchLaundryItems()
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Laundry Mode"
        title="Dry Cleaning Items"
        description="Manage the cleaning status of individual garments."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
          <Search size={15} className="text-muted" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by item code..." 
            className="w-full bg-transparent text-sm focus:outline-none" 
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
           <div className="py-12 text-center text-muted">
             <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent"></div>
             <p className="mt-3 text-sm">Loading requests…</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Shirt} title="No items" description="There are currently no items requiring dry cleaning." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  {isAdmin && <th className="px-4 py-3 font-medium">Invoice No</th>}
                  <th className="px-4 py-3 font-medium">Item Code</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter(o => !search.trim() || o.itemCode.toLowerCase().includes(search.trim().toLowerCase()))
                  .map(o => {
                  return (
                    <tr key={o.id} className="border-t border-line/60 hover:bg-paper/50">
                      <td className="px-4 py-3 font-mono text-xs text-ink whitespace-nowrap">
                        LOD_{String(o.id).padStart(3, '0')}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {o.invoiceNumber}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-ink">
                        {o.itemCode}
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={o.status === 'Complete'}
                            onChange={e => handleStatusChange(o.id, e.target.checked ? 'Complete' : 'Pending')}
                            className="h-4 w-4 rounded border-line text-brass focus:ring-brass/30 transition-colors"
                          />
                          <span className={`text-xs font-semibold ${o.status === 'Complete' ? 'text-sage' : 'text-muted'}`}>
                            {o.status === 'Complete' ? 'Complete' : 'Pending'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
