import { useEffect, useMemo, useState } from 'react'
import Barcode from './components/Barcode.jsx'
import baseFacilities from './data/facilities.json'

// Delivery Board
//
// A searchable grid of facility cards, grouped by route zone. Each card
// shows a route tag, the facility ID, and a scannable barcode. Click a
// card to view/print an enlarged version. No login, no remote kill
// switch, no admin-only lock — every pharmacy staff member who has this
// URL can use it, all the time.
//
// `src/data/facilities.json` is the built-in list, bundled into the site
// at build time. On top of that, anyone can add a stop through the "+ Add
// a stop" button; those go into a small shared database (see README.md)
// and show up live for everyone, same as the built-in stops — no reload,
// rebuild, or redeploy needed.

// Fixed display order for zones — new facilities always render inside
// their zone's section, never tacked onto the end of the board.
const ZONE_ORDER = ['North Pole', 'North', 'Central', 'South', 'Unassigned']

const EMPTY_FORM = { id: '', barcode: '', name: '', tagLabel: 'Unassigned' }

export default function App() {
  const [query, setQuery] = useState('')
  const [zone, setZone] = useState('All')
  const [selected, setSelected] = useState(null)
  const [printMode, setPrintMode] = useState(false)

  const [customStops, setCustomStops] = useState([])
  const [dbStatus, setDbStatus] = useState('loading') // loading | ready | unavailable

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Pull in anything the team has already added through the app, so a
  // stop someone added from another device shows up here too.
  useEffect(() => {
    let cancelled = false
    fetch('/api/stops')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((stops) => {
        if (cancelled) return
        setCustomStops(Array.isArray(stops) ? stops : [])
        setDbStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setDbStatus('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const facilities = useMemo(
    () => [...baseFacilities, ...customStops],
    [customStops],
  )

  const zoneCounts = useMemo(() => {
    const counts = {}
    facilities.forEach((f) => {
      counts[f.tagLabel] = (counts[f.tagLabel] || 0) + 1
    })
    return counts
  }, [facilities])

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
  }, [facilities, query, zone])

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

  function openAddForm() {
    setForm(EMPTY_FORM)
    setFormError('')
    setAddOpen(true)
  }

  async function handleAddStop(e) {
    e.preventDefault()
    setFormError('')

    const id = form.id.trim().toUpperCase()
    if (!id) {
      setFormError('Enter a stop ID.')
      return
    }
    if (facilities.some((f) => f.id === id)) {
      setFormError(`"${id}" already exists on the board.`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          barcode: form.barcode.trim() || id,
          name: form.name.trim(),
          tagLabel: form.tagLabel,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Could not add that stop. Try again.')
        return
      }
      setCustomStops((prev) => [...prev, data])
      setAddOpen(false)
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
        <button type="button" className="addstopbtn" onClick={openAddForm}>
          + Add a stop
        </button>
        <label className="board__toggle">
          <input
            type="checkbox"
            checked={printMode}
            onChange={(e) => setPrintMode(e.target.checked)}
          />
          Print mode (B/W)
        </label>
      </header>

      {dbStatus === 'unavailable' && (
        <p className="board__notice">
          The shared database isn't connected yet, so stops anyone adds won't be saved. The
          board below still works normally.
        </p>
      )}

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
              <span className="board__zone-name">{zoneName}</span>
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
                  <div className="card__label">
                    {f.id}
                    {f.custom && <span className="card__custom-dot" title="Added by a teammate" />}
                  </div>
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

      {addOpen && (
        <div className="modal" onClick={() => !submitting && setAddOpen(false)}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal__close"
              aria-label="Close"
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              ×
            </button>
            <form className="addform" onSubmit={handleAddStop}>
              <h2 className="addform__title">Add a stop</h2>
              <p className="addform__hint">
                This shows up for everyone on the board right away.
              </p>

              <label className="addform__field">
                Stop ID
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="e.g. GARD-E"
                  autoFocus
                />
              </label>

              <label className="addform__field">
                Zone
                <select
                  value={form.tagLabel}
                  onChange={(e) => setForm({ ...form, tagLabel: e.target.value })}
                >
                  {ZONE_ORDER.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>

              <label className="addform__field">
                Barcode number <span>(optional — defaults to the Stop ID)</span>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="e.g. 000000123456"
                />
              </label>

              <label className="addform__field">
                Name / notes <span>(optional)</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Garden Plaza - East wing"
                />
              </label>

              {formError && <p className="addform__error">{formError}</p>}

              <button type="submit" className="addform__submit" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add stop'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}