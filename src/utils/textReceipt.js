import { formatLKR, formatDate, daysBetween } from './format.js'

/**
 * Formats order data into clean, fixed-width text for 80mm thermal receipt printers.
 * Uses 42 printable columns (safe for 80mm at 12 cpi).
 * Designed for direct text spooling - guaranteed 0% gibberish or binary dump!
 */
export function generateTextReceipt({ order, customer, orderItems, businessProfile }) {
  const WIDTH = 42

  const center = (str) => {
    const s = String(str ?? '').trim()
    if (s.length >= WIDTH) return s.slice(0, WIDTH)
    const left = Math.floor((WIDTH - s.length) / 2)
    return ' '.repeat(left) + s
  }

  const row = (label, value) => {
    const l = String(label ?? '')
    const v = String(value ?? '')
    const gap = WIDTH - l.length - v.length
    if (gap >= 1) return l + ' '.repeat(gap) + v
    return l + '\n' + v.padStart(WIDTH)
  }

  const line = (char = '-') => char.repeat(WIDTH)

  const wrap = (text, indent = 0) => {
    const words = String(text ?? '').split(' ')
    const out = []
    let cur = ''
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word
      if (test.length <= WIDTH) {
        cur = test
      } else {
        if (cur) out.push(cur)
        cur = ' '.repeat(indent) + word
      }
    }
    if (cur) out.push(cur)
    return out.join('\n')
  }

  const ls = []

  ls.push(line('='))
  ls.push(center(businessProfile?.name || 'SANJAYA PROFESSIONAL TAILORS'))
  if (businessProfile?.tagline) ls.push(center(businessProfile.tagline))
  if (businessProfile?.address) {
    businessProfile.address.split('\n').filter(Boolean).forEach(a => ls.push(center(a)))
  }
  if (businessProfile?.phone) ls.push(center('Tel: ' + businessProfile.phone))
  if (businessProfile?.regNo) ls.push(center('Reg: ' + businessProfile.regNo))
  ls.push(line('='))

  const invoiceNum = order.invoiceNumber || ('#' + order.id)
  const now = new Date()
  const printTime = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const rentalDays = Math.max(daysBetween(order.startDate, order.endDate), 1)

  ls.push(row('Receipt No:', invoiceNum))
  ls.push(row('Order Date:', formatDate(order.createdAt || order.startDate)))
  ls.push(row('Issue Date:', formatDate(order.startDate)))
  ls.push(row('Due Return:', formatDate(order.endDate)))
  ls.push(row('Duration:', rentalDays + ' Day' + (rentalDays > 1 ? 's' : '')))
  ls.push(row('Printed At:', printTime))
  ls.push(line('-'))

  ls.push('CUSTOMER DETAILS')
  const custName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    : 'Walk-in Customer'
  ls.push(row('Name:', custName))
  if (customer?.nic) ls.push(row('NIC No:', customer.nic))
  if (customer?.phone || customer?.phone2) {
    ls.push(row('Phone:', [customer.phone, customer.phone2].filter(Boolean).join(' / ')))
  }
  if (customer?.address) {
    ls.push(wrap('Addr: ' + customer.address, 6))
  }
  ls.push(line('-'))

  ls.push(row('ITEM / DESCRIPTION', 'LKR'))
  ls.push(line('-'))

  const items = orderItems || order.orderDetails || []
  if (items.length > 0) {
    items.forEach((d) => {
      const garments = [
        d.coat && ('Coat: ' + d.coat),
        d.trouser && ('Trouser: ' + d.trouser),
        d.west && ('Vest: ' + d.west),
        d.national && ('National: ' + d.national),
      ].filter(Boolean)

      const priceStr = formatLKR(d.rentOrSalePrice)

      if (garments.length > 0) {
        garments.forEach((g, gi) => {
          if (gi === 0) {
            const maxLabelLen = WIDTH - priceStr.length - 1
            ls.push(row(g.slice(0, maxLabelLen), priceStr))
          } else {
            ls.push('  ' + g)
          }
        })
      } else {
        const label = (d.name || d.itemName || 'Tailored Item').slice(0, WIDTH - priceStr.length - 1)
        ls.push(row(label, priceStr))
      }
    })
  } else {
    ls.push(center('(No items listed)'))
  }
  ls.push(line('-'))

  const isDryClean = Boolean(order.dryclean_status || order.isDryclean || order.drycleanStatus)
  ls.push(row('Sub Total:', formatLKR(order.subTotal)))
  ls.push(row('Dry Cleaning:', isDryClean ? 'Required' : 'No'))
  ls.push(row('Advance Paid:', formatLKR(order.paymentReceived)))
  ls.push(line('='))
  ls.push(row('BALANCE DUE:', formatLKR(order.remainingPayment)))
  ls.push(line('='))
  ls.push(row('Payment Method:', order.paymentMethod || 'Cash'))

  if (order.remark) {
    ls.push(line('-'))
    ls.push(wrap('Note: ' + order.remark, 6))
  }

  ls.push(line('-'))
  ls.push(center('Thank you for choosing Us!'))
  ls.push(center('Please present receipt on return.'))
  ls.push(center('Software: Inivac | 0742266018'))
  ls.push(line('='))
  // Orientation fix: on this Xprinter first bytes printed = BOTTOM of receipt,
  // last bytes printed = TOP (nearest the tear bar). Reversing all lines puts
  // the header at the top and footer at the bottom -- correct reading order.
  var allLines = ls.join('\n').split('\n')
  allLines.reverse()
  // Blank lines at end print last = appear at top = gap before header for clean tearing
  allLines.push('', '', '', '')
  return allLines.join('\n')
}
