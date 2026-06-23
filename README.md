# Product Browser (MERN)

A backend (+ small UI) for browsing ~200,000 products, newest first, with
category filtering and pagination that stays correct and fast even while
data is being written to concurrently.

Stack: **MongoDB + Express + React (Vite) + Node**, styled with **Tailwind CSS**.

## Why this design

### 1. Pagination: cursor (keyset), not `skip`/`limit`

The naive approach — `Product.find().sort().skip(page * size).limit(size)` —
breaks on this task's own requirement:

- `skip` is **stateless about identity**. "Page 2" means "skip whatever the
  first `size` docs are *right now*, take the next `size`." If 50 new
  products are inserted at the top while someone is browsing, every existing
  document shifts down by 50 positions. The next "page 2" request then
  re-shows documents already seen on page 1, and skips 50 the user never saw.
  That's exactly the duplicate/missing bug described in the task.
- `skip` also gets **slower** the deeper you paginate (MongoDB has to walk
  over and discard every skipped document), so it doesn't satisfy "pagination
  should be fast" at scale either.

Instead, the API uses **keyset pagination**: each page request includes a
cursor encoding the `(created_at, _id)` of the last item seen. The next page
is fetched with a query like:

```js
{ $or: [
  { created_at: { $lt: cursor.created_at } },
  { created_at: cursor.created_at, _id: { $lt: cursor.id } }
]}
```

sorted by `{ created_at: -1, _id: -1 }`. Because `created_at` and `_id` never
change once a document exists, the cursor stays valid no matter how many new
products get inserted above it. New inserts only show up if the user
explicitly refreshes to the top — they never silently reshuffle a page the
user is already looking at. Updates to existing products (price changes,
`updated_at` bumps) don't move their position at all, since ordering is by
`created_at`, not `updated_at`.

This also makes every page query an **indexed range scan**
(`O(log n + page size)`), so page 5,000 is exactly as fast as page 1. This is
backed by a compound index:

```js
productSchema.index({ created_at: -1, _id: -1 });               // global feed
productSchema.index({ category: 1, created_at: -1, _id: -1 });  // filtered feed
```

The `_id` tiebreaker matters because many seeded products can share the exact
same `created_at` millisecond — without it, ties could be split across two
pages inconsistently.

The trade-off: pure keyset pagination doesn't give you "jump to page 5,000"
arbitrarily — you can only walk forward/backward from a cursor. That's fine
for an infinite-scroll / next-previous browsing UI, which is what this task
describes, and is the standard approach for feeds where data changes live
(it's what Twitter/Slack/etc. use). I kept a small cursor history stack on
the frontend so "Previous" still works.

### 2. Why MongoDB

Document shape is simple and fixed (name, category, price, timestamps) —
no relational joins needed. MongoDB's compound indexes give exactly the
keyset-pagination query pattern above for free, and `insertMany` makes
seeding 200k rows fast. A relational DB (Postgres) would work equally well
here with the same keyset technique on a `(created_at, id)` index — I just
went with the stack the task suggested (MERN).

### 3. Seeding 200k products quickly

`backend/seed/seedProducts.js` builds documents in memory in batches of
5,000 and writes them with `insertMany(..., { ordered: false })`, instead of
looping `save()` one at a time (which would mean 200,000 separate round
trips to the DB). `ordered: false` also lets MongoDB parallelize the writes
internally. On a local MongoDB this seeds 200k docs in low single-digit
seconds.

`backend/seed/simulateLiveWrites.js` is a separate script you can run **while
browsing the UI** to simulate the "50 products added/updated mid-browse"
scenario from the task — it inserts 25 new products (which appear at the top
on next refresh) and updates 25 random existing ones (price + `updated_at`
only, so their position doesn't change). Use this to verify no duplicates/
no gaps appear while paginating forward.

## Project structure

```
backend/
  models/Product.js          Mongoose schema + indexes
  routes/products.js         GET /api/products (cursor pagination), /categories
  seed/seedProducts.js        generates + inserts 200,000 products
  seed/simulateLiveWrites.js  simulates concurrent inserts/updates for testing
  server.js                   Express app entry point
frontend/
  src/App.jsx                 Vite + React + Tailwind UI: category filter, next/prev
```

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env        # point MONGODB_URI at your local/Atlas/Neon-style Mongo instance
npm run seed                 # generates 200,000 products (run once)
npm run dev                  # starts the API on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env         # set VITE_API_BASE_URL if backend isn't on localhost:5000
npm run dev                  # http://localhost:5173
```

### Testing the "correct while data is changing" requirement

1. Start browsing in the UI (or hit the API directly), and click "Next" a few times.
2. In another terminal: `cd backend && node seed/simulateLiveWrites.js`
3. Keep paginating forward — you should never see a duplicate product or
   notice a gap, because your cursor is anchored to specific documents, not
   to a shifting offset.

## What I'd improve with more time

- Add a lightweight integration test that seeds a small dataset, pages
  through it while concurrently inserting/updating, and asserts the set of
  IDs seen has no duplicates and matches the expected total.
- Add response caching/ETags for category list and maybe the first page,
  since that's the highest-traffic page.
- Add cursor signing (HMAC) so the cursor can't be tampered with by a client
  to forge an arbitrary query, though it's only ever used for read access here.
- Virtualized/infinite-scroll list on the frontend instead of "Next/Previous"
  buttons, for a smoother browse experience on large pages.

## Note on AI usage

I used AI (Claude) to scaffold this project — generating boilerplate
(Express setup, Vite/Tailwind config, the seed script's batching loop) and
to talk through pagination strategies. The core design decision — keyset
pagination over `(created_at, _id)` instead of `skip/limit`, and why it
solves the "no duplicates/no gaps under concurrent writes" requirement — is
the central engineering idea of this task, and I made sure I can explain and
modify that part of the code from first principles, since that's what the
live round will test.
