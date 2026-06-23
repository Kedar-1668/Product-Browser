import express from "express";
import Product from "../models/Product.js";

const router = express.Router();



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
