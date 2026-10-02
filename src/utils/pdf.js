import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Captures the rendered InvoiceDocument DOM element using html2canvas
 * and embeds it into a jsPDF document at 80mm thermal receipt width.
 *
 * @param {HTMLElement} element - The DOM node to capture (printRef.current)
 * @param {string} filename - Output PDF filename
 */
export async function downloadInvoicePDF({ element, filename }) {
  // Render the element to canvas at 2x scale for crispness
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')

  // 80mm wide thermal paper
  const MM = 2.8346          // 1 mm in pt
  const pageWidthPt  = 80 * MM
  const imgWidthPt   = pageWidthPt
  const imgHeightPt  = (canvas.height / canvas.width) * imgWidthPt

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pageWidthPt, imgHeightPt],
  })

  doc.addImage(imgData, 'PNG', 0, 0, imgWidthPt, imgHeightPt)
  doc.save(filename)
}
