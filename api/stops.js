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
    const barcode = String(body.barcode || id || '').trim()
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