import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI ;

const TOTAL_PRODUCTS = 200000;
const BATCH_SIZE = 5000; // insertMany in batches -> avoids one giant array in memory + one giant write

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Home & Kitchen",
  "Books",
  "Toys",
  "Sports",
  "Beauty",
  "Automotive",
  "Grocery",
  "Office Supplies",
];

const ADJECTIVES = ["Premium", "Classic", "Compact", "Deluxe", "Eco", "Smart", "Portable", "Heavy-Duty", "Wireless", "Pro"];
const NOUNS = ["Widget", "Gadget", "Chair", "Lamp", "Backpack", "Bottle", "Headphones", "Mixer", "Notebook", "Charger"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice() {
  // price between 5.00 and 999.99
  return Math.round((Math.random() * 994 + 5) * 100) / 100;
}

/**
 * Spread created_at timestamps over the last ~2 years so that
 * "newest first" pagination has realistic, non-identical ordering data
 * to sort through. We go backward in time as `i` increases, so index 0
 * is the newest-created and the last batch is the oldest-created.
 */
function createdAtForIndex(i, total) {
  const now = Date.now();
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  // newest product (i = total-1, inserted last conceptually) gets "now"
  // We just need a spread; exact ordering doesn't matter for correctness.
  const offset = Math.floor((i / total) * twoYearsMs);
  return new Date(now - offset);
}

async function seed() {
  console.log(`Connecting to ${MONGODB_URI} ...`);
  await mongoose.connect(MONGODB_URI);

  console.log("Clearing existing products...");
  await Product.deleteMany({});

  console.log(`Generating and inserting ${TOTAL_PRODUCTS} products in batches of ${BATCH_SIZE}...`);

  const start = Date.now();

  for (let batchStart = 0; batchStart < TOTAL_PRODUCTS; batchStart += BATCH_SIZE) {
    const batch = [];
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_PRODUCTS);

    for (let i = batchStart; i < batchEnd; i++) {
      const createdAt = createdAtForIndex(i, TOTAL_PRODUCTS);
      batch.push({
        name: `${randomItem(ADJECTIVES)} ${randomItem(NOUNS)} #${i}`,
        category: randomItem(CATEGORIES),
        price: randomPrice(),
        created_at: createdAt,
        updated_at: createdAt,
      });
    }

    // insertMany with ordered:false lets MongoDB parallelize the write
    // and not stop on a single document error.
    await Product.insertMany(batch, { ordered: false });

    console.log(`Inserted ${batchEnd} / ${TOTAL_PRODUCTS}`);
  }

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done. Inserted ${TOTAL_PRODUCTS} products in ${seconds}s.`);

  console.log("Building indexes (if not already present)...");
  await Product.init(); // ensures indexes declared in schema are created

  await mongoose.disconnect();
  console.log("Disconnected. Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
