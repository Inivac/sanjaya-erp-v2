import { forwardRef } from 'react'
import { formatLKR, formatDate, daysBetween } from '../utils/format.js'
import logoImg from '../assests/logo/yellow_logo.jpg'
import qrImg from '../assests/logo/qr.png'

/**
 * Professional Thermal receipt-style invoice (optimized for 80mm / 72mm printable width).
 */
const InvoiceDocument = forwardRef(function InvoiceDocument({ order, customer, orderItems, businessProfile }, ref) {
  if (!order) return null

  const rentalDays = Math.max(daysBetween(order.startDate, order.endDate), 1)
  const invoiceDisplay = order.invoiceNumber || `#${order.id}`
  const now = new Date()
  const printedDate = now.toLocaleDateString('en-GB')
  const printedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const orderDate = order.createdAt ? formatDate(order.createdAt) : formatDate(order.startDate)
  const isDryClean = Boolean(order.dryclean_status || order.isDryclean || order.drycleanStatus)

  const Divider = ({ dashed }) => (
    <div
      style={{
        borderTop: dashed ? '1px dashed #000' : '1px solid #000',
        margin: '5px 0',
      }}
    />
  )

  const KeyValueRow = ({ label, value, bold, isPrice }) => {
    if (value === undefined || value === null || value === '') return null
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          fontSize: bold ? '13px' : '12px',
          fontWeight: bold ? '800' : '500',
          margin: '2px 0',
          lineHeight: '1.3',
        }}
      >
        <span style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', paddingRight: '6px' }}>
          {label}
        </span>
        <span
          style={{
            flex: '0 0 auto',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: bold ? '800' : (isPrice ? '600' : '500'),
          }}
        >
          {value}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="invoice-printable"
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        fontSize: '12px',
        fontWeight: '500',
        color: '#000',
        background: '#fff',
        width: '100%',
        maxWidth: '76mm',
        boxSizing: 'border-box',
        margin: '0 auto',
        padding: '6px 8px 0 8px',
        lineHeight: '1.35',
      }}
    >
      {/* Shop Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <img
          src={logoImg}
          alt="Business Logo"
          style={{
            display: 'block',
            margin: '0 auto 4px',
            maxWidth: '110px',
            maxHeight: '55px',
            objectFit: 'contain',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        />
        <div style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {businessProfile?.name || 'Sanjaya Professional Tailors'}
        </div>

        {businessProfile?.tagline && (
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
            {businessProfile.tagline}
          </div>
        )}
        {businessProfile?.address && (
          <div style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '1px' }}>
            {businessProfile.address}
          </div>
        )}
        {businessProfile?.phone && (
          <div style={{ fontSize: '11px', fontWeight: '600' }}>
            Tel: {businessProfile.phone}
          </div>
        )}
        {businessProfile?.email && (
          <div style={{ fontSize: '10px' }}>
            {businessProfile.email}
          </div>
        )}
        {businessProfile?.regNo && (
          <div style={{ fontSize: '10px' }}>
            Reg: {businessProfile.regNo}
          </div>
        )}
      </div>

      <Divider />

      {/* Invoice Meta */}
      <div style={{ margin: '2px 0' }}>
        <KeyValueRow label="Receipt No:" value={invoiceDisplay} bold />
        <KeyValueRow label="Order Date:" value={orderDate} />
        <KeyValueRow label="Issue Date:" value={formatDate(order.startDate)} />
        <KeyValueRow label="Due Return:" value={formatDate(order.endDate)} bold />
        <KeyValueRow label="Duration:" value={`${rentalDays} Day${rentalDays > 1 ? 's' : ''}`} />
        <KeyValueRow label="Printed At:" value={`${printedDate} ${printedTime}`} />
      </div>

      <Divider dashed />

      {/* Customer Info */}
      <div style={{ margin: '2px 0' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
          CUSTOMER DETAILS
        </div>
        <KeyValueRow
          label="Name:"
          value={customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : 'Walk-in Customer'}
          bold
        />
        {customer?.nic && <KeyValueRow label="NIC No:" value={customer.nic} bold />}
        {(customer?.phone || customer?.phone2) && (
          <KeyValueRow
            label="Phone:"
            value={[customer?.phone, customer?.phone2].filter(Boolean).join(' / ')}
          />
        )}
        {customer?.address && (
          <div style={{ fontSize: '11px', margin: '2px 0', lineHeight: '1.25' }}>
            <span style={{ fontWeight: '700' }}>Address: </span>
            <span>{customer.address}</span>
          </div>
        )}
      </div>

      <Divider dashed />

      {/* Items Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '2px 0',
        }}
      >
        <span style={{ flex: '1 1 auto' }}>ITEM / DESCRIPTION</span>
        <span style={{ flex: '0 0 auto', textAlign: 'right', whiteSpace: 'nowrap' }}>PRICE (LKR)</span>
      </div>
      <Divider />

      {/* Items List */}
      <div style={{ margin: '3px 0' }}>
        {(orderItems && orderItems.length > 0) ? (
          orderItems.map((d, idx) => {
            const garments = [
              d.coat && { label: 'Coat', value: d.coat },
              d.trouser && { label: 'Trouser', value: d.trouser },
              d.west && { label: 'Vest', value: d.west },
              d.national && { label: 'National', value: d.national },
            ].filter(Boolean)

            return (
              <div key={idx} style={{ marginBottom: '4px', borderBottom: idx < orderItems.length - 1 ? '1px dotted #ccc' : 'none', paddingBottom: '3px' }}>
                {garments.length > 0 ? (
                  garments.map((g, gi) => (
                    <div
                      key={gi}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        fontSize: '11.5px',
                        margin: '1px 0',
                        lineHeight: '1.25',
                      }}
                    >
                      <span style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', paddingRight: '6px' }}>
                        <strong style={{ fontWeight: '700' }}>{g.label}:</strong> {g.value}
                      </span>
                      <span
                        style={{
                          flex: '0 0 auto',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: '600',
                        }}
                      >
                        {gi === 0 ? formatLKR(d.rentOrSalePrice) : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      fontSize: '11.5px',
                      margin: '1px 0',
                    }}
                  >
                    <span style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', paddingRight: '6px' }}>
                      {d.name || d.itemName || `Item #${idx + 1}`}
                    </span>
                    <span
                      style={{
                        flex: '0 0 auto',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: '600',
                      }}
                    >
                      {formatLKR(d.rentOrSalePrice)}
                    </span>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div style={{ fontSize: '11px', fontStyle: 'italic', margin: '4px 0' }}>No items listed</div>
        )}
      </div>

      <Divider />

      {/* Financials & Totals */}
      <div style={{ margin: '2px 0' }}>
        <KeyValueRow label="Sub Total:" value={formatLKR(order.subTotal)} isPrice />
        <KeyValueRow label="Dry Cleaning:" value={isDryClean ? 'Required' : 'No'} />
        <KeyValueRow label="Advance Paid:" value={formatLKR(order.paymentReceived)} isPrice />

        <div style={{ borderTop: '1.5px solid #000', margin: '4px 0 2px' }} />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '900',
            margin: '3px 0',
          }}
        >
          <span style={{ flex: '1 1 auto' }}>BALANCE DUE:</span>
          <span
            style={{
              flex: '0 0 auto',
              textAlign: 'right',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatLKR(order.remainingPayment)}
          </span>
        </div>

        <div style={{ borderTop: '1.5px solid #000', margin: '2px 0 4px' }} />

        <KeyValueRow label="Payment Method:" value={order.paymentMethod || 'Cash'} />
      </div>

      {order.remark && (
        <>
          <Divider dashed />
          <div style={{ fontSize: '11px', margin: '3px 0', wordBreak: 'break-word', lineHeight: '1.25' }}>
            <span style={{ fontWeight: '700' }}>Note: </span>
            <span>{order.remark}</span>
          </div>
        </>
      )}

      <Divider dashed />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px', lineHeight: '1.4' }}>
        <div style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Thank you for choosing Us!
        </div>
        <div style={{ fontSize: '10px', marginTop: '2px' }}>
          Please bring this receipt when returning rented items.
        </div>

        <img
          src={qrImg}
          alt="QR Code"
          style={{
            display: 'block',
            margin: '6px auto',
            width: '55px',
            height: '55px',
            objectFit: 'contain',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        />

        <div style={{ marginTop: '6px', borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '9px', fontWeight: '600' }}>
          Software Powered by Inivac | 0742266018
        </div>
      </div>

      {/* Cut line — marks the physical tear position on the roll */}
      <div
        style={{
          marginTop: '10px',
          borderTop: '1px dashed #aaa',
          textAlign: 'center',
          fontSize: '8px',
          color: '#999',
          paddingTop: '2px',
          letterSpacing: '1px',
          paddingBottom: '4px',
        }}
      >
        ✂   cut here   ✂
      </div>

      {/* Extra bottom space so the cut line clears the printer head */}
      <div style={{ height: '14mm' }} />
    </div>
  )
})

export default InvoiceDocument
