import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

// Most of the pharmacy's facility codes are real, checksum-valid UPC-A
// barcodes (the same symbology as standard retail products) — verified by
// recomputing the UPC-A check digit against the value. Render those as
// UPC-A so existing scanners hardware-configured for UPC-A still read them.
// The couple of stops with no assigned barcode (they fall back to their own
// alphanumeric code, e.g. "STOM-D") aren't valid UPC-A input, so those fall
// back to Code128, which can encode arbitrary text.
function isValidUpcA(value) {
  if (!/^\d{12}$/.test(value)) return false
  const d = value.split('').map(Number)
  const odd = d[0] + d[2] + d[4] + d[6] + d[8] + d[10]
  const even = d[1] + d[3] + d[5] + d[7] + d[9]
  const check = (10 - ((odd * 3 + even) % 10)) % 10
  return check === d[11]
}

export default function Barcode({ value, height = 60 }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current) return
    const format = isValidUpcA(value) ? 'UPC' : 'CODE128'
    JsBarcode(svgRef.current, value, {
      format,
      displayValue: true,
      height,
      margin: 8,
      fontSize: 14,
    })
  }, [value, height])

  return <svg ref={svgRef} role="img" aria-label={`Barcode for ${value}`} />
}
