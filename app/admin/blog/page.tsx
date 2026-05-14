"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  coverImageUrl: string | null;
};

type PagedResponse = {
  posts: PostRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function BlogPostsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const status = (searchParams.get("status") ?? "all") as "all" | "published" | "draft";
  const search = searchParams.get("search") ?? "";

  const [data, setData] = useState<PagedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "" || (k === "page" && v === "1")) params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (page > 1) params.set("page", String(page));
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/blog/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load posts");
      setData(await res.json());
    } catch {
      setError("Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Debounce search input → URL param
  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      updateParams({ search: val, page: "1" });
    }, 350);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/blog/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadPosts();
    } catch {
      alert("Failed to delete post");
    } finally {
      setDeletingId(null);
    }
  }

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <>
      <style>{`
        .blog-page { padding: 32px 40px; max-width: 1100px; }
        .blog-stat { background: #fff; border: 1px solid #e8eaed; border-radius: 10px; padding: 20px 24px; min-width: 120px; }
        .post-card { background: #fff; border: 1px solid #e8eaed; border-radius: 10px; padding: 20px 24px; transition: border-color 0.15s, box-shadow 0.15s; }
        .post-card:hover { border-color: #d1d5db; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
        .badge-published { background: #dcfce7; color: #16a34a; }
        .badge-draft { background: #f3f4f6; color: #6b7280; }
        .icon-btn { background: none; border: 1px solid #e8eaed; border-radius: 7px; cursor: pointer; padding: 6px 10px; font-size: 13px; color: #6b7280; display: flex; align-items: center; gap: 4px; transition: all 0.15s; }
        .icon-btn:hover { border-color: #d1d5db; color: #374151; background: #f9fafb; }
        .icon-btn.danger:hover { border-color: #fca5a5; color: #dc2626; background: #fff5f5; }
        .filter-btn { background: none; border: 1px solid #e8eaed; border-radius: 7px; cursor: pointer; padding: 6px 14px; font-size: 13px; font-weight: 500; color: #6b7280; transition: all 0.15s; }
        .filter-btn.active { background: #111827; color: #fff; border-color: #111827; }
        .page-btn { background: #fff; border: 1px solid #e8eaed; border-radius: 7px; cursor: pointer; padding: 6px 12px; font-size: 13px; font-weight: 500; color: #374151; transition: all 0.15s; min-width: 36px; }
        .page-btn:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; }
        .page-btn.active { background: #dc2626; color: #fff; border-color: #dc2626; font-weight: 700; }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .skeleton { background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite linear; border-radius: 4px; }
        @media (max-width: 768px) { .blog-page { padding: 20px 16px; } }
      `}</style>

      <div className="blog-page">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: 0 }}>Blog Posts</h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
              {total > 0 ? `${total} post${total !== 1 ? "s" : ""} total` : "Manage your blog content"}
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/blog/new")}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            + New Post
          </button>
        </div>

        {/* Filters & Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "published", "draft"] as const).map((f) => (
              <button
                key={f}
                className={`filter-btn${status === f ? " active" : ""}`}
                onClick={() => updateParams({ status: f === "all" ? null : f, page: "1" })}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search by title, category, excerpt..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: 200, border: "1px solid #e8eaed", borderRadius: 7, padding: "7px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 10, padding: "20px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div className="skeleton" style={{ width: 72, height: 52, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 17, width: `${45 + (i * 13) % 30}%`, marginBottom: 10 }} />
                  <div className="skeleton" style={{ height: 12, width: `${55 + (i * 7) % 25}%`, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 11, width: `${25 + (i * 9) % 20}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>
            <button onClick={loadPosts} style={{ marginTop: 12, fontSize: 13, color: "#0052cc", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Retry</button>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <p style={{ fontSize: 15, color: "#6b7280", fontWeight: 500 }}>
              {search || status !== "all" ? "No posts match your filters" : "No blog posts yet"}
            </p>
            {!search && status === "all" && (
              <button onClick={() => router.push("/admin/blog/new")} style={{ marginTop: 16, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Create First Post
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {posts.map((post) => (
                <div key={post.id} className="post-card">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    {post.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.coverImageUrl}
                        alt=""
                        style={{ width: 72, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid #e8eaed", flexShrink: 0 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{post.title}</span>
                        <span className={`badge ${post.published ? "badge-published" : "badge-draft"}`}>
                          {post.published ? "Published" : "Draft"}
                        </span>
                      </div>
                      {post.excerpt && (
                        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {post.excerpt}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9ca3af", flexWrap: "wrap" }}>
                        {post.category && <span>Category: <strong style={{ color: "#6b7280" }}>{post.category}</strong></span>}
                        {post.author && <span>By {post.author}</span>}
                        {post.createdAt && <span>Created: {formatDate(post.createdAt)}</span>}
                        {post.published && post.publishedAt && <span>Published: {formatDate(post.publishedAt)}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="icon-btn" onClick={() => router.push(`/admin/blog/${post.id}`)} title="Edit post">✏️ Edit</button>
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(post.id, post.title)}
                        disabled={deletingId === post.id}
                        title="Delete post"
                      >
                        {deletingId === post.id ? "..." : "🗑"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24, flexWrap: "wrap" }}>
                <button className="page-btn" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>← Prev</button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} style={{ padding: "6px 4px", fontSize: 13, color: "#9ca3af" }}>…</span>
                    ) : (
                      <button
                        key={p}
                        className={`page-btn${p === page ? " active" : ""}`}
                        onClick={() => updateParams({ page: String(p) })}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button className="page-btn" disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>Next →</button>

                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
                  {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function AdminBlogPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "32px 40px" }}>
        <style>{`
          @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
          .skeleton { background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite linear; border-radius: 4px; }
        `}</style>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 14, width: 160, marginBottom: 32 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 10, padding: "20px 24px", marginBottom: 10, display: "flex", gap: 16 }}>
            <div className="skeleton" style={{ width: 72, height: 52, borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 17, width: `${45 + (i * 13) % 30}%`, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: `${55 + (i * 7) % 25}%`, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 11, width: `${25 + (i * 9) % 20}%` }} />
            </div>
          </div>
        ))}
      </div>
    }>
      <BlogPostsInner />
    </Suspense>
  );
}
