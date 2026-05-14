"use client";

import { useState, useEffect, useCallback } from "react";

type Author = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  createdAt: string | null;
};

type FormState = {
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  bio: "",
  avatarUrl: "",
  twitterUrl: "",
  linkedinUrl: "",
  websiteUrl: "",
};

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadAuthors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog/authors");
      if (!res.ok) throw new Error();
      setAuthors(await res.json());
    } catch {
      showToast("Failed to load authors", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAuthors(); }, [loadAuthors]);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(author: Author) {
    setEditingId(author.id);
    setForm({
      name: author.name,
      title: author.title ?? "",
      bio: author.bio ?? "",
      avatarUrl: author.avatarUrl ?? "",
      twitterUrl: author.twitterUrl ?? "",
      linkedinUrl: author.linkedinUrl ?? "",
      websiteUrl: author.websiteUrl ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast("Author name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        title: form.title.trim() || null,
        bio: form.bio.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        twitterUrl: form.twitterUrl.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
      };

      const res = await fetch(
        editingId ? `/api/admin/blog/authors/${editingId}` : "/api/admin/blog/authors",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }

      const saved: Author = await res.json();

      if (editingId) {
        setAuthors((prev) => prev.map((a) => (a.id === editingId ? saved : a)));
        showToast("Author updated");
      } else {
        setAuthors((prev) => [saved, ...prev]);
        showToast("Author created");
      }
      closeForm();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Posts assigned to them will lose their author link.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/blog/authors/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Delete failed");
      }
      setAuthors((prev) => prev.filter((a) => a.id !== id));
      showToast("Author deleted");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function field(key: keyof FormState, label: string, placeholder: string, textarea = false) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</label>
        {textarea ? (
          <textarea
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            rows={3}
            style={{ border: "1px solid #e8eaed", borderRadius: 7, padding: "9px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none" }}
          />
        ) : (
          <input
            type="text"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            style={{ border: "1px solid #e8eaed", borderRadius: 7, padding: "9px 12px", fontSize: 14, outline: "none" }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        .authors-page { padding: 32px 40px; max-width: 900px; }
        .author-card { background: #fff; border: 1px solid #e8eaed; border-radius: 10px; padding: 18px 22px; display: flex; align-items: flex-start; gap: 16px; transition: border-color 0.15s; }
        .author-card:hover { border-color: #d1d5db; }
        .author-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #f3f4f6; border: 2px solid #e8eaed; flex-shrink: 0; }
        .author-avatar-placeholder { width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #dc2626; flex-shrink: 0; }
        .icon-btn { background: none; border: 1px solid #e8eaed; border-radius: 7px; cursor: pointer; padding: 6px 12px; font-size: 12px; font-weight: 600; color: #6b7280; transition: all 0.15s; }
        .icon-btn:hover { border-color: #d1d5db; background: #f9fafb; color: #374151; }
        .icon-btn.danger:hover { border-color: #fca5a5; color: #dc2626; background: #fff5f5; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding-top: 60px; overflow-y: auto; }
        .modal { background: #fff; border-radius: 14px; padding: 28px; width: 100%; max-width: 520px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); margin-bottom: 40px; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: slide-in 0.2s ease; }
        .toast-success { background: #111827; color: #fff; }
        .toast-error { background: #dc2626; color: #fff; }
        @keyframes slide-in { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (max-width: 768px) { .authors-page { padding: 20px 16px; } }
      `}</style>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="authors-page">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: 0 }}>Authors</h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>Manage reusable author profiles for blog posts</p>
          </div>
          <button
            onClick={openNew}
            style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + New Author
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 14 }}>Loading...</div>
        ) : authors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✍️</div>
            <p style={{ fontSize: 15, color: "#6b7280", fontWeight: 500 }}>No authors yet</p>
            <button onClick={openNew} style={{ marginTop: 16, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Create First Author
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {authors.map((author) => (
              <div key={author.id} className="author-card">
                {author.avatarUrl ? (
                  <img src={author.avatarUrl} alt={author.name} className="author-avatar" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="author-avatar-placeholder">{author.name.charAt(0).toUpperCase()}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{author.name}</div>
                  {author.title && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{author.title}</div>}
                  {author.bio && (
                    <p style={{ fontSize: 13, color: "#9ca3af", margin: "6px 0 0", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {author.bio}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    {author.twitterUrl && <a href={author.twitterUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0052cc", textDecoration: "none" }}>𝕏 Twitter</a>}
                    {author.linkedinUrl && <a href={author.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0052cc", textDecoration: "none" }}>LinkedIn</a>}
                    {author.websiteUrl && <a href={author.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0052cc", textDecoration: "none" }}>Website</a>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="icon-btn" onClick={() => openEdit(author)}>Edit</button>
                  <button
                    className="icon-btn danger"
                    onClick={() => handleDelete(author.id, author.name)}
                    disabled={deletingId === author.id}
                  >
                    {deletingId === author.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Author Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                {editingId ? "Edit Author" : "New Author"}
              </h2>
              <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", lineHeight: 1 }}>✕</button>
            </div>

            {field("name", "Name *", "John Smith")}
            {field("title", "Title / Role", "SEO Strategist")}
            {field("bio", "Bio", "Brief author biography...", true)}
            {field("avatarUrl", "Avatar URL", "https://...")}
            {form.avatarUrl && (
              <img src={form.avatarUrl} alt="Preview" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid #e8eaed", marginBottom: 14 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            {field("twitterUrl", "Twitter / X URL", "https://twitter.com/...")}
            {field("linkedinUrl", "LinkedIn URL", "https://linkedin.com/in/...")}
            {field("websiteUrl", "Website URL", "https://...")}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Author"}
              </button>
              <button
                onClick={closeForm}
                style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "11px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
