import { useMemo, useState } from 'react'
import Barcode from './components/Barcode.jsx'
import facilities from './data/facilities.json'

// Delivery Board
//
// A searchable grid of facility cards, grouped by route zone. Each card
// shows a route tag, the facility ID, and a scannable barcode. Click a
// card to view/print an enlarged version. No login, no remote kill
// switch, no admin-only lock — every pharmacy staff member who has this
// URL can use it, all the time.
//
// Swap `src/data/facilities.json` for your real facility list, or wire this
// up to a real backend later (see README.md).

// Fixed display order for zones — new facilities always render inside
// their zone's section, never tacked onto the end of the board.
const ZONE_ORDER = ['North Pole', 'North', 'Central', 'South', 'Unassigned']

export default function App() {
  const [query, setQuery] = useState('')
  const [zone, setZone] = useState('All')
  const [selected, setSelected] = useState(null)
  const [printMode, setPrintMode] = useState(false)

  const zoneCounts = useMemo(() => {
    const counts = {}
    facilities.forEach((f) => {
      counts[f.tagLabel] = (counts[f.tagLabel] || 0) + 1
    })
    return counts
  }, [])

  const zoneTabs = useMemo(
    () => ['All', ...ZONE_ORDER.filter((z) => zoneCounts[z])],
    [zoneCounts],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return facilities.filter((f) => {
      const matchesQuery =
        !q ||
        (f.name || '').toLowerCase().includes(q) ||
        f.tagLabel.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      const matchesZone = zone === 'All' || f.tagLabel === zone
      return matchesQuery && matchesZone
    })
  }, [query, zone])

  const grouped = useMemo(() => {
    const byZone = {}
    visible.forEach((f) => {
      ;(byZone[f.tagLabel] = byZone[f.tagLabel] || []).push(f)
    })
    Object.values(byZone).forEach((items) =>
      items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    )
    return ZONE_ORDER.filter((z) => byZone[z]).map((z) => [z, byZone[z]])
  }, [visible])

  return (
    <div className={`board${printMode ? ' board--bw' : ''}`}>
      <header className="board__topbar">
        <h1 className="board__title">Delivery Board</h1>
        <input
          className="board__search"
          type="text"
          placeholder="Search facility or route…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="board__toggle">
          <input
            type="checkbox"
            checked={printMode}
            onChange={(e) => setPrintMode(e.target.checked)}
          />
          Print mode (B/W)
        </label>
      </header>

      <div className="board__zonebar">
        {zoneTabs.map((z) => (
          <button
            key={z}
            type="button"
            className="zonebtn"
            aria-pressed={zone === z}
            onClick={() => setZone(z)}
          >
            {z === 'All' ? `All (${facilities.length})` : `${z} (${zoneCounts[z]})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="board__empty">No facilities match "{query}".</p>
      ) : (
        grouped.map(([zoneName, items]) => (
          <section key={zoneName} className="board__zone">
            <h2 className="board__zone-title">
              {zoneName}
              <span>{items.length} stop{items.length === 1 ? '' : 's'}</span>
            </h2>
            <div className="board__grid">
              {items.map((f) => (
                <button
                  key={f.id}
                  className="card"
                  style={{ borderColor: printMode ? undefined : f.tagColor }}
                  onClick={() => setSelected(f)}
                >
                  <div
                    className="card__tag"
                    style={{ backgroundColor: printMode ? undefined : f.tagColor }}
                  >
                    {f.tagLabel}
                  </div>
                  <div className="card__label">{f.id}</div>
                  <div className="card__barcode">
                    <Barcode value={f.barcode} height={40} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal__close"
              aria-label="Close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <div className="modal__label">{selected.id}</div>
            {selected.addr && <div className="modal__addr">{selected.addr}</div>}
            <div className="modal__barcode">
              <Barcode value={selected.barcode} height={80} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}