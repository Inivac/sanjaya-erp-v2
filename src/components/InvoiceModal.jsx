import { useRef } from 'react'
import { Printer, X, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Button } from './ui/Primitives.jsx'
import InvoiceDocument from './InvoiceDocument.jsx'

export default function InvoiceModal({ open, onClose, order, justCreated = false }) {
  const { businessProfile } = useApp()
  const printRef = useRef(null)

  if (!open || !order) return null

  const customer = order.customerData || null
  const safeCustomer = customer
    ? { ...customer, lastName: customer.lastName || '' }
    : null

  const orderItems = order.orderDetails || []

  function handlePrint() {
    window.print()
  }

  async function handleThermalPrint() {
    if (window.require) {
      const { ipcRenderer } = window.require('electron')
      try {
        const result = await ipcRenderer.invoke('print-escpos-receipt', { 
          data: { order, customer: safeCustomer, orderItems, businessProfile },
          printerName: 'Xprinter XP-80'
        })
        if (!result.success) {
          console.error('Thermal print failed:', result.failureReason)
          alert('Thermal print failed. See console for details.')
        }
      } catch (err) {
        console.error('IPC error:', err)
        alert('Failed to communicate with printer service.')
      }
    } else {
      alert('Thermal printing is only available in the desktop app.')
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
      <div className="no-print absolute inset-0 bg-ink/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 flex max-h-[94vh] w-full max-w-2xl flex-col animate-in overflow-hidden rounded-card bg-white shadow-pop">

        {/* Header */}
        <div className="no-print flex items-center justify-between border-b border-line bg-paper px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2">
            {justCreated && <CheckCircle2 size={18} className="text-sage" />}
            <div>
              <p className="font-display text-sm font-semibold text-ink">
                {justCreated ? 'Order Created — Invoice Ready' : `Invoice ${order.invoiceNumber || `#${order.id}`}`}
              </p>
              <p className="text-xs text-muted">Preview — click Print to open the system print dialog</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-line/60 hover:text-ink">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Receipt Preview */}
        <div className="scrollbar-thin flex-1 overflow-y-auto bg-stone-100/70 p-3 sm:p-5">
          <div className="mx-auto rounded-sm border border-stone-300 bg-white shadow-md w-[80mm] max-w-full overflow-hidden">
            <InvoiceDocument
              ref={printRef}
              order={order}
              customer={safeCustomer}
              orderItems={orderItems}
              businessProfile={businessProfile}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="no-print flex items-center justify-end gap-2 border-t border-line bg-white px-4 sm:px-5 py-3">
          <Button variant="outline" onClick={onClose} size="sm">
            Close
          </Button>
          <Button variant="outline" size="sm" icon={Printer} onClick={handlePrint}>
            Print Dialog
          </Button>
          <Button variant="brass" size="sm" icon={Printer} onClick={handleThermalPrint}>
            Print (Thermal POS)
          </Button>
        </div>
      </div>
    </div>
  )
}
