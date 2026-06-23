import mongoose from "mongoose";

/**
 * Product schema.
 
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
