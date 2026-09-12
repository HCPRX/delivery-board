import { useMemo, useState } from 'react'
import Barcode from './components/Barcode.jsx'
import facilities from './data/facilities.json'

// Delivery Board
//
// A searchable grid of facility cards. Each card shows a route tag, the
// facility name, and a scannable barcode. Click a card to view/print an
// enlarged version. No login, no remote kill switch, no admin-only lock —
// every pharmacy staff member who has this URL can use it, all the time.
//
// Swap `src/data/facilities.json` for your real facility list, or wire this
// up to a real backend later (see README.md).

export default function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [printMode, setPrintMode] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return facilities
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.tagLabel.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q),
    )
  }, [query])

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

      {visible.length === 0 ? (
        <p className="board__empty">No facilities match "{query}".</p>
      ) : (
        <div className="board__grid">
          {visible.map((f) => (
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
              <div className="card__label">{f.name}</div>
              <div className="card__barcode">
                <Barcode value={f.barcode} height={40} />
              </div>
            </button>
          ))}
        </div>
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
            <div className="modal__label">{selected.name}</div>
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
