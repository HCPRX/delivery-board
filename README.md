# Delivery Board

A clean rebuild of the pharmacy's facility delivery/barcode board — same
core function as the old app (search facilities, pull up a label + scannable
barcode, print in black-and-white), with none of the lockout/kill-switch
machinery and no dependency on any one person's account.

## What's different from the old app on purpose

- No login, no remote "mode" check, no kill switch, no idle screensaver,
  no "contact the developer" popup, nothing that can flip this off.
- Every pharmacy staff member with the URL can use it, all the time.
- Data lives in a plain JSON file you control (see below), not a backend
  only one person can reach.

## Running it locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Facility data

`src/data/facilities.json` is pre-loaded with your real 73 facility stops,
grouped by zone (North Pole / North / Central / South), pulled from the old
app's own public data endpoint — same facility names, addresses, route
colors, and the exact barcode values already in use, so scanners that
already recognize those codes keep working with this app too.

Each entry:

```json
{ "id": "GARD-G", "name": "Gardens - Green", "addr": "1450 Ninth St, Ogden, UT 84404", "barcode": "000000155991", "tagLabel": "North Pole", "tagColor": "#fbbf24" }
```

Two stops (`STOM-D`, `WHA-IND`) had no barcode assigned in the source data
either — they fall back to using their own code as the barcode, same as the
original app did. Add, edit, or remove entries here as your facility list
changes — this file is the whole data source, nothing calls out to any
other backend.

**Barcode format:** the 12-digit codes are real, checksum-valid UPC-A
barcodes (verified by recomputing the check digit), so they render as UPC-A
— the same symbology as a standard retail barcode. The two non-numeric
fallback codes (`STOM-D`, `WHA-IND`) render as Code128 instead, since they
aren't valid UPC-A input. **Before rolling this out, physically scan a few
printed/on-screen barcodes with the actual scanner your drivers use** to
confirm they read correctly — I can verify the data is right, but I can't
test your hardware.

## Deploying so no single person controls it

1. Have an owner/manager create a **new Vercel account using a company
   email** (not any one employee's personal account) at vercel.com/signup.
2. Push this project to a **GitHub repo owned by a company GitHub
   organization** (not a personal account) — create one at
   github.com/organizations/new if you don't have one yet.
3. In Vercel, "Add New Project" → import that GitHub repo → deploy (Vercel
   auto-detects Vite, no config needed).
4. Add at least one other trusted person as an admin/owner on both the
   GitHub org and the Vercel team, so access never depends on a single
   individual again.

## Next steps / things not yet covered

This mirrors the searchable board + barcode label part of the old app —
the part we could actually verify (search, card grid, tag/label/barcode,
print mode). It does **not** yet include anything for marking a delivery
complete, assigning drivers, or pulling live data from a pharmacy system,
because we don't have confirmed details on how (or whether) the old app
did those. Happy to add any of that once we know what's actually needed.
