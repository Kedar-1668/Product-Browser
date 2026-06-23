import mongoose from "mongoose";

/**
 * Product schema.
 *
 * Note on pagination strategy (read README.md for full explanation):
 * We paginate using a (created_at, _id) cursor instead of skip/offset.
 * That means we need a compound index on { created_at: -1, _id: -1 }
 * (and a category-scoped version for filtered browsing) so that both
 * "give me the next page after cursor X" queries are index-only scans,
 * not full collection scans.
 */
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true },
  created_at: { type: Date, required: true, default: Date.now },
  updated_at: { type: Date, required: true, default: Date.now },
});

// Compound index for global "newest first" keyset pagination.
productSchema.index({ created_at: -1, _id: -1 });

// Compound index for category-filtered "newest first" keyset pagination.
productSchema.index({ category: 1, created_at: -1, _id: -1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
