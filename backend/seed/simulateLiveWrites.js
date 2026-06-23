import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Simulates real-world write activity while a user is browsing:
 * - Inserts 25 brand-new products with created_at = now (so they appear
 *   at the very top of the "newest first" feed).
 * - Updates 25 random existing products' price + updated_at (their
 *   created_at, and therefore their position in the list, stays put).
 */
async function simulate() {
  await mongoose.connect(MONGODB_URI);

  console.log("Inserting 25 new products...");
  const now = Date.now();
  const newDocs = Array.from({ length: 25 }, (_, i) => ({
    name: `LIVE-INSERTED Product ${now}-${i}`,
    category: "Electronics",
    price: Math.round((Math.random() * 500 + 10) * 100) / 100,
    created_at: new Date(now + i), // strictly newest
    updated_at: new Date(now + i),
  }));
  await Product.insertMany(newDocs);

  console.log("Updating 25 random existing products (price + updated_at only)...");
  const sample = await Product.aggregate([{ $sample: { size: 25 } }]);
  for (const doc of sample) {
    await Product.updateOne(
      { _id: doc._id },
      {
        $set: {
          price: Math.round((Math.random() * 500 + 10) * 100) / 100,
          updated_at: new Date(),
        },
      }
    );
  }

  console.log("Done simulating live writes.");
  await mongoose.disconnect();
}

simulate().catch((err) => {
  console.error(err);
  process.exit(1);
});
