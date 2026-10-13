// Serverless API for user-added stops ("Add a stop" feature).
//
// Vercel auto-detects any file under /api (at the project root, next to
// src/, not inside it) as a Function, regardless of the frontend
// framework, so this file runs on Vercel's servers (not in the browser)
// even though the rest of the project is a plain Vite app.
//
// Storage: Upstash Redis, connected through the Vercel Marketplace. See
// README.md ("Adding a stop — shared database setup") for the one-time
// dashboard steps. Everything a visitor adds is stored as a single JSON
// list under one Redis key, so it's simple and has no schema/migrations.
//
// No login is required to add or delete a stop (by design, same as the
// rest of the board) — anyone with the site's URL can add, see, or
// remove a stop. Only stops added through the app live in this list and
// can be deleted here — the built-in facilities.json list is baked into
// the site at build time and isn't touched by this file.

import { Redis } from '@upstash/redis'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Loaded with fs instead of a JSON import so this keeps working regardless
// of which JSON-import syntax a given Node/bundler version supports.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseFacilities = JSON.parse(
  readFileSync(path.join(__dirname, '../src/data/facilities.json'), 'utf8'),
)

const STOPS_KEY = 'delivery-board:custom-stops'
const BASE_IDS = new Set(baseFacilities.map((f) => f.id))

// The Upstash Vercel integration can name its env vars slightly differently
// depending on how it was connected, so we check the common variants
// instead of requiring one exact name.
const REDIS_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

const ZONES = ['North Pole', 'North', 'Central', 'South', 'Unassigned']

function getRedis() {
  if (!REDIS_URL || !REDIS_TOKEN) return null
  return new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
}

function badRequest(res, message) {
  res.status(400).json({ error: message })
}

// --- Barcode generation ------------------------------------------------
//
// Every real facility barcode in facilities.json is a checksum-valid
// UPC-A number of the shape 000000XXX99 + check digit — a 5-digit "item
// number" that always ends in 99, under the pharmacy's own prefix. A stop
// added through the app with no barcode typed in used to just reuse its
// ID as the barcode, which renders as a plain Code128 text barcode
// (Barcode.jsx) instead of a real scannable UPC-A — visually inconsistent
// with the rest of the board. So: auto-generate the next number in that
// same sequence, in the same format, so an auto-assigned stop looks and
// scans exactly like the others. (These are new sequence numbers, not
// barcodes issued by any outside system — there's no such registry for a
// brand-new stop — but they follow the house numbering convention
// exactly, including a correct UPC-A check digit.)

function upcCheckDigit(digits11) {
  const d = digits11.split('').map(Number)
  const odd = d[0] + d[2] + d[4] + d[6] + d[8] + d[10]
  const even = d[1] + d[3] + d[5] + d[7] + d[9]
  return (10 - ((odd * 3 + even) % 10)) % 10
}

function makeUpc(payload5) {
  const body = '000000' + String(payload5).padStart(5, '0')
  return body + upcCheckDigit(body)
}

function nextAutoBarcode(existingBarcodes) {
  const existingSet = new Set(existingBarcodes)
  let maxPayload = 7499 // one below the lowest real payload (7599)
  for (const b of existingBarcodes) {
    if (/^\d{12}$/.test(b)) {
      const payload = Number(b.slice(6, 11))
      if (payload % 100 === 99 && payload > maxPayload) maxPayload = payload
    }
  }
  let payload = maxPayload + 100
  let code = makeUpc(payload)
  // Extremely unlikely to collide (each candidate is past every known
  // code), but guard against it anyway rather than assume.
  while (existingSet.has(code)) {
    payload += 100
    code = makeUpc(payload)
  }
  return code
}

// Both POST and DELETE can send an id either as a JSON body or (for DELETE,
// since some callers prefer not to send a body) a query string — accept
// either so the frontend has a simple, reliable way to call it.
function readId(req) {
  const fromBody = req.body && req.body.id
  const fromQuery = req.query && req.query.id
  return String(fromBody || fromQuery || '').trim().toUpperCase()
}

export default async function handler(req, res) {
  const redis = getRedis()

  if (!redis) {
    res.status(503).json({
      error:
        'The shared database is not connected yet. See README.md for setup steps.',
    })
    return
  }

  if (req.method === 'GET') {
    const stops = (await redis.get(STOPS_KEY)) || []
    res.status(200).json(stops)
    return
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const id = String(body.id || '').trim().toUpperCase()
    const typedBarcode = String(body.barcode || '').trim()
    const name = String(body.name || '').trim()
    const tagLabel = String(body.tagLabel || '').trim()

    if (!id) return badRequest(res, 'A stop ID is required.')
    if (!ZONES.includes(tagLabel)) {
      return badRequest(res, `Zone must be one of: ${ZONES.join(', ')}`)
    }

    const stops = (await redis.get(STOPS_KEY)) || []

    if (BASE_IDS.has(id) || stops.some((s) => s.id === id)) {
      return badRequest(res, `A stop called "${id}" already exists.`)
    }

    // Respect a barcode the user typed in themselves (e.g. a real one
    // already printed on a label) — only auto-generate when left blank.
    const barcode = typedBarcode
      ? typedBarcode
      : nextAutoBarcode([
          ...baseFacilities.map((f) => f.barcode),
          ...stops.map((s) => s.barcode),
        ])

    const tagColor = ZONE_COLORS[tagLabel] || '#6b7280'

    const newStop = {
      id,
      name: name || undefined,
      barcode,
      tagLabel,
      tagColor,
      addedAt: new Date().toISOString(),
      custom: true,
    }

    const updated = [...stops, newStop]
    await redis.set(STOPS_KEY, updated)

    res.status(201).json(newStop)
    return
  }

  if (req.method === 'DELETE') {
    const id = readId(req)
    if (!id) return badRequest(res, 'A stop ID is required.')

    if (BASE_IDS.has(id)) {
      return badRequest(
        res,
        'Built-in stops can\'t be deleted from the app — only stops added through "+ Add a stop".',
      )
    }

    const stops = (await redis.get(STOPS_KEY)) || []
    const next = stops.filter((s) => s.id !== id)

    if (next.length === stops.length) {
      res.status(404).json({ error: `No stop called "${id}" was found.` })
      return
    }

    await redis.set(STOPS_KEY, next)
    res.status(200).json({ ok: true, id })
    return
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  res.status(405).json({ error: 'Method not allowed' })
}

// One representative color per zone, matching the palette already used in
// facilities.json, so a user-added stop's tag looks consistent with the
// rest of its zone instead of picking a random color.
const ZONE_COLORS = {
  'North Pole': '#fb923c',
  North: '#84cc16',
  Central: '#06b6d4',
  South: '#f472b6',
  Unassigned: '#6b7280',
}