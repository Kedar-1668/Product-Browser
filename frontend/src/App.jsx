import React, { useEffect, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const PAGE_SIZE = 20;

export default function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cursor pagination state.
  // cursorStack[i] = the cursor that was used to fetch the page currently
  // shown at "history index" i. cursorStack[0] is always undefined (page 1).
  const [cursorStack, setCursorStack] = useState([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  // Load category list once.
  useEffect(() => {
    fetch(`${API_BASE}/api/products/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  const fetchPage = useCallback(
    async (cursor) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", PAGE_SIZE);
        if (selectedCategory !== "all") params.set("category", selectedCategory);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`${API_BASE}/api/products?${params.toString()}`);
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();

        setProducts(data.products);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError("Failed to load products. Is the backend running?");
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory]
  );

  // Reset to page 1 whenever the category filter changes.
  useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
    fetchPage(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const goNext = () => {
    if (!nextCursor) return;
    const newStack = [...cursorStack.slice(0, pageIndex + 1), nextCursor];
    setCursorStack(newStack);
    setPageIndex(pageIndex + 1);
    fetchPage(nextCursor);
  };

  const goPrev = () => {
    if (pageIndex === 0) return;
    const newIndex = pageIndex - 1;
    setPageIndex(newIndex);
    fetchPage(cursorStack[newIndex]);
  };

  const goToTop = () => {
    setCursorStack([undefined]);
    setPageIndex(0);
    fetchPage(undefined);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-800">Product Browser</h1>
          <div className="flex items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={goToTop}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100 transition"
            >
              ↻ Refresh to newest
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
              {!loading &&
                products.map((p) => (
                  <tr key={p._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 text-slate-500">{p.category}</td>
                    <td className="px-4 py-2">${p.price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={goPrev}
            disabled={pageIndex === 0 || loading}
            className="px-4 py-2 rounded-md border border-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">Page {pageIndex + 1}</span>
          <button
            onClick={goNext}
            disabled={!hasMore || loading}
            className="px-4 py-2 rounded-md border border-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
          >
            Next →
          </button>
        </div>
      </main>
    </div>
  );
}
