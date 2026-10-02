export function formatLKR(value) {
  const n = Number(value) || 0
  return 'Rs. ' + n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysBetween(a, b) {
  const one = 1000 * 60 * 60 * 24
  return Math.round((new Date(b) - new Date(a)) / one)
}

export function initials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}
