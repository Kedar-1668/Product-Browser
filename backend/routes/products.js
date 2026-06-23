import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

/**
 * GET /api/products
 *
 * Query params:
 *   category   - optional, filter by exact category
 *   limit      - optional, page size (default 20, max 100)
 *   cursor     - optional, opaque base64 cursor returned by previous page.
 *                Omit it to get page 1 (the newest products).
 *
 * WHY CURSOR (KEYSET) PAGINATION INSTEAD OF page/skip:
 *
 * With `skip(n).limit(k)` pagination, "page 2" literally means
 * "skip the first n docs of whatever the collection looks like RIGHT NOW,
 * then take the next k." If 50 new products are inserted at the top while
 * a user is browsing, every doc shifts down by 50 positions. The user's
 * "page 2" request now re-fetches docs they already saw on page 1, and
 * skips 50 products they never saw. That's exactly the duplicate/missing
 * bug this task warns about. skip() also gets slower the deeper you
 * paginate, because MongoDB still has to walk over and discard all the
 * skipped documents.
 *
 * Cursor pagination instead asks: "give me the next products *after this
 * specific product*", using a tuple of (created_at, _id) as the cursor.
 * Because created_at and _id never change for a document that's already
 * been created, the cursor stays valid no matter how many new documents
 * get inserted above it or how many other documents get updated. New
 * inserts appear only on a *future* "refresh to top" call, and in-place
 * updates (price/updated_at change) don't move a product's position at
 * all, since we sort by created_at, not updated_at. Each query is also an
 * indexed range scan (`created_at < cursor_value`), so it's O(log n + limit)
 * instead of O(skip + limit) -- pagination stays fast on page 5,000 just
 * like it is on page 1.
 */

function encodeCursor(doc) {
  const payload = JSON.stringify({
    created_at: doc.created_at.toISOString(),
    id: doc._id.toString(),
  });
  return Buffer.from(payload, "utf-8").toString("base64");
}

function decodeCursor(cursor) {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf-8");
    const { created_at, id } = JSON.parse(json);
    return { created_at: new Date(created_at), id };
  } catch (err) {
    return null;
  }
}

router.get("/", async (req, res) => {
  try {
    const { category, cursor } = req.query;
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 20;
    limit = Math.min(limit, 100);

    const filter = {};
    if (category && category !== "all") {
      filter.category = category;
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded) {
        return res.status(400).json({ error: "Invalid cursor" });
      }
      // "Newest first" means descending created_at. To get items strictly
      // after the cursor in that ordering, we want items with an earlier
      // created_at, OR the same created_at but a smaller _id (tiebreaker
      // for documents that share the exact same timestamp).
      filter.$or = [
        { created_at: { $lt: decoded.created_at } },
        {
          created_at: decoded.created_at,
          _id: { $lt: decoded.id },
        },
      ];
    }

    // Fetch one extra document so we know whether there's a next page,
    // without needing a separate count query.
    const docs = await Product.find(filter)
      .sort({ created_at: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;

    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

    res.json({
      products: page,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/categories - distinct category list for the filter dropdown
router.get("/categories", async (req, res) => {
  try {
    const categories = await Product.distinct("category");
    res.json({ categories: categories.sort() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
