import React, { useState, useEffect } from 'react'
import { Modal, Button, Field, Input, Select } from './ui/Primitives.jsx'
import { formatLKR } from '../utils/format.js'
import { useApp } from '../context/AppContext.jsx'

export default function ReturnModal({ open, order, onClose, onConfirm }) {
  const { orderStatuses } = useApp()
  const [paymentAmount, setPaymentAmount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  useEffect(() => {
    if (order) {
      setPaymentAmount(String(order.remainingPayment || 0))
      setPaymentMethod(order.paymentMethod || 'Cash')
    }
  }, [order])

  if (!open || !order) return null

  const customer = order.customerData || null
  const remaining = order.remainingPayment || 0
  const total = order.subTotal || 0
  const alreadyPaid = order.paymentReceived || 0
  const enteredAmount = Number(paymentAmount) || 0
  
  const newRemaining = Math.max(remaining - enteredAmount, 0)
  const newReceived = alreadyPaid + enteredAmount

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await onConfirm(order.id, {
        paymentReceived: newReceived,
        remainingPayment: newRemaining,
        paymentMethod: paymentMethod,
        settlementAmount: enteredAmount
      })
      onClose()
    } catch (err) {
      alert(`Failed to settle payment and return order: ${err.message}`)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Settle Payment — Invoice ${order.invoiceNumber || `#${order.id}`}`} width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h4 className="font-semibold text-ink">Customer</h4>
          <p className="text-sm text-muted">{customer ? `${customer.firstName} ${customer.lastName}` : '—'}</p>
          <p className="text-xs text-muted">{customer?.phone}</p>
        </div>

        <div className="rounded-lg border border-line divide-y divide-line bg-paper/30">
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-muted">Total Rental Amount</span>
            <span className="font-medium text-ink">{formatLKR(total)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-muted">Already Paid</span>
            <span className="font-semibold text-sage">{formatLKR(alreadyPaid)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm bg-paper/50">
            <span className="text-brass-dark font-medium">Remaining Due Balance</span>
            <span className="font-semibold text-burgundy">{formatLKR(remaining)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount Paid Now (LKR)" required>
            <Input 
              type="number" 
              min="0" 
              max={remaining} 
              step="any"
              value={paymentAmount} 
              onChange={e => setPaymentAmount(e.target.value)} 
              required
            />
          </Field>
          <Field label="Payment Method">
            <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {['Cash', 'Card', 'Bank Transfer', 'Online'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-brass-50 p-3 text-center border border-brass-100">
          <span className="text-xs text-muted uppercase tracking-wider font-semibold">New Remaining Balance Due</span>
          <span className={`font-display text-lg font-bold ${newRemaining > 0 ? 'text-burgundy' : 'text-sage'}`}>
            {formatLKR(newRemaining)}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="brass">Save Payment</Button>
        </div>
      </form>
    </Modal>
  )
}
