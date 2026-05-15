"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

type Author = {
  id: string;
  name: string;
  title: string | null;
};

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  htmlContent: string | null;
  cssContent: string | null;
  contentType: string;
  category: string;
  authorId: string | null;
  coverImageUrl: string | null;
  published: boolean;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

type LibraryImage = {
  name: string;
  url: string;
  size: number;
  updatedAt: string | null;
  contentType: string;
};

const CATEGORIES = [
  "Case Studies", "Guides", "Industry News", "Tips & Tricks",
  "SEO Strategy", "Link Building", "Data & Research", "Product Updates",
];

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function ToolbarButton({
  active, onClick, children, title, disabled,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: active ? "#fee2e2" : "none",
        border: "1px solid",
        borderColor: active ? "#fca5a5" : "#e8eaed",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "4px 8px",
        fontSize: 13,
        color: active ? "#dc2626" : "#374151",
        fontWeight: active ? 700 : 500,
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.12s",
        minWidth: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

// ─── Image Library Modal ──────────────────────────────────────────────────────
function ImageLibraryModal({
  onSelect,
  onClose,
  title,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
  title: string;
}) {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog/images");
      if (res.ok) setImages(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (!files.length) return;
      setUploading(true);
      try {
        await Promise.all(
          files.map(async (file) => {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/admin/blog/upload-image", { method: "POST", body: form });
            if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
          })
        );
        await load();
      } catch {
        // individual errors are swallowed; partial success is fine
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  async function handleDelete(img: LibraryImage, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${img.name}"? This cannot be undone.`)) return;
    setDeletingName(img.name);
    try {
      await fetch("/api/admin/blog/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `blog-images/${img.name}` }),
      });
      setImages((prev) => prev.filter((i) => i.name !== img.name));
      if (selected === img.url) setSelected(null);
    } finally {
      setDeletingName(null);
    }
  }

  const filtered = images.filter((img) =>
    !search || img.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40, overflow: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 780, margin: "0 20px 40px", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e8eaed", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{images.length} image{images.length !== 1 ? "s" : ""} in library</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: "1px solid #e8eaed", borderRadius: 7, padding: "7px 12px", fontSize: 13, outline: "none", width: 160 }}
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1, whiteSpace: "nowrap" }}
            >
              {uploading ? "Uploading..." : "↑ Upload"}
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", lineHeight: 1, padding: 4 }}>✕</button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 14 }}>Loading library...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
              <p style={{ color: "#6b7280", fontSize: 14 }}>{images.length === 0 ? "No images uploaded yet" : "No images match your search"}</p>
              {images.length === 0 && (
                <button onClick={handleUpload} style={{ marginTop: 14, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Upload First Image
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {filtered.map((img) => {
                const isSelected = selected === img.url;
                return (
                  <div
                    key={img.name}
                    onClick={() => setSelected(isSelected ? null : img.url)}
                    style={{
                      border: `2px solid ${isSelected ? "#dc2626" : "#e8eaed"}`,
                      borderRadius: 10,
                      overflow: "hidden",
                      cursor: "pointer",
                      background: isSelected ? "#fff5f5" : "#f9fafb",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      boxShadow: isSelected ? "0 0 0 3px rgba(220,38,38,0.15)" : "none",
                      position: "relative",
                    }}
                  >
                    <div style={{ position: "relative", paddingTop: "66%", background: "#f3f4f6" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                      {isSelected && (
                        <div style={{ position: "absolute", top: 6, right: 6, background: "#dc2626", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>✓</div>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={img.name}>{img.name}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{fmtBytes(img.size)}</span>
                        <button
                          onClick={(e) => handleDelete(img, e)}
                          disabled={deletingName === img.name}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12, padding: "1px 3px", borderRadius: 4 }}
                          title="Delete"
                        >
                          {deletingName === img.name ? "…" : "🗑"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #e8eaed", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button
            disabled={!selected}
            onClick={() => { if (selected) { onSelect(selected); onClose(); } }}
            style={{ background: selected ? "#dc2626" : "#e8eaed", color: selected ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: selected ? "pointer" : "not-allowed" }}
          >
            Use Selected Image
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────
export default function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [cssContent, setCssContent] = useState("");
  const [activeTab, setActiveTab] = useState<"editor" | "code" | "split">("editor");
  const [showSEO, setShowSEO] = useState(false);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [originalPublishedAt, setOriginalPublishedAt] = useState<string | null>(null);

  // Image library modal state
  const [libraryMode, setLibraryMode] = useState<"cover" | "editor" | null>(null);

  // loadedContent is set once when fetch returns — state so effects re-run when it arrives
  const [loadedContent, setLoadedContent] = useState<string | null>(null);
  // prevent double-sync if both editor and loadedContent deps fire close together
  const contentSynced = useRef(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Init TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-600 underline" } }),
      Image.configure({ HTMLAttributes: { class: "max-w-full h-auto rounded-lg my-4" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: "",
    onUpdate: ({ editor }) => { setHtmlContent(editor.getHTML()); },
    editorProps: { attributes: { class: "prose max-w-none focus:outline-none min-h-[420px] p-4" } },
    immediatelyRender: false,
  });

  // Load existing post
  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/blog/posts/${id}`)
      .then((r) => r.json())
      .then((post: BlogPost) => {
        setTitle(post.title);
        setSlug(post.slug);
        setExcerpt(post.excerpt ?? "");
        setCategory(post.category ?? "");
        setAuthorId(post.authorId);
        setCoverImageUrl(post.coverImageUrl ?? "");
        setPublished(post.published);
        setMetaTitle(post.metaTitle ?? "");
        setMetaDescription(post.metaDescription ?? "");
        setOriginalPublishedAt(post.publishedAt);
        if (post.cssContent) setCssContent(post.cssContent);
        if (post.contentType === "html") setActiveTab("code");

        const content = post.htmlContent || post.content || "";
        setHtmlContent(content);
        setLoadedContent(content); // triggers the sync effect below
      })
      .catch(() => showToast("Failed to load post", "error"));
  }, [id, isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync loaded content into editor — runs whenever editor becomes ready OR content arrives,
  // whichever is last. The synced ref prevents double-loading.
  useEffect(() => {
    if (!editor || !loadedContent || isNew || contentSynced.current) return;
    editor.commands.setContent(loadedContent);
    contentSynced.current = true;
  }, [editor, loadedContent, isNew]);

  // Load authors
  useEffect(() => {
    fetch("/api/admin/blog/authors").then((r) => r.json()).then(setAuthors).catch(() => {});
  }, []);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (isNew) {
      setSlug(val.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim());
    }
  }

  const syncEditorFromHtml = useCallback(() => {
    if (editor && htmlContent !== editor.getHTML()) {
      editor.commands.setContent(htmlContent, { emitUpdate: false });
    }
  }, [editor, htmlContent]);

  // Upload cover image directly (no library)
  async function handleCoverUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploadingCover(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/admin/blog/upload-image", { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
        const { url } = await res.json();
        setCoverImageUrl(url);
        showToast("Cover image uploaded");
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Upload failed", "error");
      } finally {
        setUploadingCover(false);
      }
    };
    input.click();
  }

  // Upload content image (into editor body)
  async function handleEditorImageUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/admin/blog/upload-image", { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
        const { url } = await res.json();
        editor?.chain().focus().setImage({ src: url }).run();
        showToast("Image uploaded");
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Upload failed", "error");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  async function handleSave() {
    if (!title || !slug) { showToast("Title and slug are required", "error"); return; }
    setSaving(true);
    try {
      const content = editor?.getHTML() ?? htmlContent;
      const resolvedCategory = category === "__custom__" ? customCategory : category;
      const body = {
        title, slug, excerpt, content,
        htmlContent: content,
        cssContent: cssContent || null,
        contentType: activeTab === "code" ? "html" : "text",
        category: resolvedCategory,
        authorId: authorId || null,
        coverImageUrl: coverImageUrl || null,
        published,
        publishedAt: published ? (originalPublishedAt ?? new Date().toISOString()) : null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      };

      const res = await fetch(
        isNew ? "/api/admin/blog/posts" : `/api/admin/blog/posts/${id}`,
        { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Save failed"); }
      showToast("Post saved successfully");
      if (isNew) { const saved = await res.json(); router.replace(`/admin/blog/${saved.id}`); }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  const wordCount = htmlContent.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const metaTitleLen = (metaTitle || title).length;
  const metaDescLen = metaDescription.length;

  return (
    <>
      <style>{`
        .blog-editor { max-width: 1100px; padding: 0; }
        .section-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; margin-bottom: 16px; overflow: hidden; }
        .section-header { padding: 16px 24px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
        .section-body { padding: 20px 24px; }
        .field-row { display: grid; gap: 16px; margin-bottom: 16px; }
        .field-row-2 { grid-template-columns: 1fr 1fr; }
        .field-group { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.4px; }
        .field-input { border: 1px solid #e8eaed; border-radius: 7px; padding: 9px 12px; font-size: 14px; color: #111827; background: #fff; outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box; }
        .field-input:focus { border-color: #dc2626; box-shadow: 0 0 0 2px rgba(220,38,38,0.08); }
        .field-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 16px; padding-right: 32px; }
        .field-textarea { resize: vertical; min-height: 80px; font-family: inherit; }
        .tab-btn { background: none; border: none; cursor: pointer; padding: 7px 14px; font-size: 13px; font-weight: 600; color: #6b7280; border-radius: 7px; transition: all 0.12s; }
        .tab-btn.active { background: #fff; color: #111827; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .tab-bar { background: #f5f6f8; border-radius: 9px; padding: 3px; display: inline-flex; gap: 2px; }
        .toolbar { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 14px; background: #f9fafb; border-bottom: 1px solid #e8eaed; }
        .toolbar-sep { width: 1px; height: 22px; background: #e8eaed; margin: 0 2px; align-self: center; }
        .tiptap-wrapper { border: none; min-height: 420px; overflow-y: auto; }
        .tiptap-wrapper .ProseMirror { min-height: 420px; }
        .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #d1d5db; border-radius: 24px; transition: background 0.2s; }
        .toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
        input:checked + .toggle-slider { background: #16a34a; }
        input:checked + .toggle-slider:before { transform: translateX(20px); }
        .seo-meter { height: 4px; border-radius: 2px; background: #e8eaed; overflow: hidden; margin-top: 4px; }
        .seo-meter-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: slide-in 0.2s ease; }
        .toast-success { background: #111827; color: #fff; }
        .toast-error { background: #dc2626; color: #fff; }
        .cover-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .cover-action-btn { display: flex; align-items: center; gap: 6px; border: 1px solid #e8eaed; background: #f9fafb; border-radius: 7px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; transition: all 0.15s; }
        .cover-action-btn:hover { border-color: #dc2626; color: #dc2626; background: #fff5f5; }
        .cover-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes slide-in { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (max-width: 768px) { .field-row-2 { grid-template-columns: 1fr; } .blog-editor { padding: 0; } }
      `}</style>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Image Library Modal */}
      {libraryMode === "cover" && (
        <ImageLibraryModal
          title="Select Cover Image"
          onSelect={(url) => setCoverImageUrl(url)}
          onClose={() => setLibraryMode(null)}
        />
      )}
      {libraryMode === "editor" && (
        <ImageLibraryModal
          title="Insert Image into Content"
          onSelect={(url) => { editor?.chain().focus().setImage({ src: url }).run(); }}
          onClose={() => setLibraryMode(null)}
        />
      )}

      <div style={{ padding: "0 0 40px" }}>
        {/* Top Bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e8eaed", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <button
            onClick={() => router.push("/admin/blog")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}
          >
            ← Back to Posts
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{wordCount} words</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label className="toggle-switch">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: published ? "#16a34a" : "#6b7280" }}>
                {published ? "Published" : "Draft"}
              </span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save Post"}
            </button>
          </div>
        </div>

        <div className="blog-editor" style={{ padding: "24px 32px" }}>
          {/* Post Details */}
          <div className="section-card">
            <div className="section-header">
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Post Details</span>
            </div>
            <div className="section-body">
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Title *</label>
                  <input className="field-input" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Enter post title..." />
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Slug *</label>
                  <input className="field-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="post-url-slug" style={{ fontFamily: "monospace", fontSize: 13 }} />
                </div>
              </div>
              <div className="field-row field-row-2">
                <div className="field-group">
                  <label className="field-label">Category</label>
                  <select className="field-input field-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">+ Custom...</option>
                  </select>
                  {category === "__custom__" && (
                    <input className="field-input" style={{ marginTop: 6 }} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Enter custom category..." />
                  )}
                </div>
                <div className="field-group">
                  <label className="field-label">Author</label>
                  <select className="field-input field-select" value={authorId ?? ""} onChange={(e) => setAuthorId(e.target.value || null)}>
                    <option value="">No author / LinkPricer Team</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}{a.title ? ` — ${a.title}` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cover Image — upload or pick from library */}
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Cover Image</label>

                  {/* Preview */}
                  {coverImageUrl ? (
                    <div style={{ position: "relative", display: "inline-block", marginBottom: 10 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverImageUrl}
                        alt="Cover"
                        style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, border: "1px solid #e8eaed", display: "block" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <button
                        onClick={() => setCoverImageUrl("")}
                        title="Remove cover image"
                        style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 26, height: 26, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => setLibraryMode("cover")}
                      style={{ width: "100%", height: 120, border: "2px dashed #e8eaed", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", background: "#fafafa", transition: "border-color 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#dc2626"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#e8eaed"; }}
                    >
                      <span style={{ fontSize: 28 }}>🖼️</span>
                      <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Click to select cover image</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="cover-actions">
                    <button className="cover-action-btn" disabled={uploadingCover} onClick={handleCoverUpload}>
                      {uploadingCover ? "⏳ Uploading..." : "↑ Upload new image"}
                    </button>
                    <button className="cover-action-btn" onClick={() => setLibraryMode("cover")}>
                      🖼 Choose from library
                    </button>
                    {coverImageUrl && (
                      <input
                        className="field-input"
                        value={coverImageUrl}
                        onChange={(e) => setCoverImageUrl(e.target.value)}
                        placeholder="or paste URL directly..."
                        style={{ flex: 1, minWidth: 200, fontSize: 12, fontFamily: "monospace" }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Excerpt</label>
                  <textarea className="field-input field-textarea" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Brief description shown in post listings and search results..." rows={3} />
                </div>
              </div>
            </div>
          </div>

          {/* SEO Section */}
          <div className="section-card">
            <div className="section-header" style={{ cursor: "pointer" }} onClick={() => setShowSEO(!showSEO)}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>SEO Settings</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{showSEO ? "▲ Collapse" : "▼ Expand"}</span>
            </div>
            {showSEO && (
              <div className="section-body">
                <div className="field-row">
                  <div className="field-group">
                    <label className="field-label">
                      Meta Title
                      <span style={{ fontWeight: 400, color: metaTitleLen > 60 ? "#dc2626" : metaTitleLen > 50 ? "#d97706" : "#16a34a", marginLeft: 6 }}>{metaTitleLen}/60</span>
                    </label>
                    <input className="field-input" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title || "Defaults to post title"} />
                    <div className="seo-meter"><div className="seo-meter-fill" style={{ width: `${Math.min(100, (metaTitleLen / 60) * 100)}%`, background: metaTitleLen > 60 ? "#dc2626" : metaTitleLen > 50 ? "#d97706" : "#16a34a" }} /></div>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field-group">
                    <label className="field-label">
                      Meta Description
                      <span style={{ fontWeight: 400, color: metaDescLen > 160 ? "#dc2626" : metaDescLen > 140 ? "#d97706" : metaDescLen > 0 ? "#16a34a" : "#9ca3af", marginLeft: 6 }}>{metaDescLen}/160</span>
                    </label>
                    <textarea className="field-input field-textarea" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder={excerpt || "Defaults to excerpt. Ideal: 120–160 characters."} rows={3} />
                    <div className="seo-meter"><div className="seo-meter-fill" style={{ width: `${Math.min(100, (metaDescLen / 160) * 100)}%`, background: metaDescLen > 160 ? "#dc2626" : metaDescLen > 140 ? "#d97706" : metaDescLen > 0 ? "#16a34a" : "#e8eaed" }} /></div>
                  </div>
                </div>
                <div style={{ background: "#f9fafb", border: "1px solid #e8eaed", borderRadius: 8, padding: "14px 16px", fontSize: 13 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Google Preview</div>
                  <div style={{ color: "#1a0dab", fontSize: 16, fontWeight: 500, marginBottom: 2 }}>{metaTitle || title || "Post Title"}</div>
                  <div style={{ color: "#006621", fontSize: 13, marginBottom: 4 }}>linkpricer.com/blog/{slug || "post-slug"}</div>
                  <div style={{ color: "#545454", fontSize: 13, lineHeight: 1.5 }}>{metaDescription || excerpt || "Post description..."}</div>
                </div>
              </div>
            )}
          </div>

          {/* Content Editor */}
          <div className="section-card">
            <div className="section-header">
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Content</span>
              <div className="tab-bar">
                <button className={`tab-btn${activeTab === "editor" ? " active" : ""}`} onClick={() => setActiveTab("editor")}>✏️ Editor</button>
                <button className={`tab-btn${activeTab === "code" ? " active" : ""}`} onClick={() => setActiveTab("code")}>{"</>"} Code</button>
                <button className={`tab-btn${activeTab === "split" ? " active" : ""}`} onClick={() => setActiveTab("split")}>⊟ Split</button>
              </div>
            </div>

            {(activeTab === "editor" || activeTab === "split") && (
              <div className="toolbar">
                <ToolbarButton active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold"><b>B</b></ToolbarButton>
                <ToolbarButton active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic"><i>I</i></ToolbarButton>
                <ToolbarButton active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Strikethrough"><s>S</s></ToolbarButton>
                <ToolbarButton active={editor?.isActive("code")} onClick={() => editor?.chain().focus().toggleCode().run()} title="Inline code">{"<>"}</ToolbarButton>
                <span className="toolbar-sep" />
                <ToolbarButton active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">H2</ToolbarButton>
                <ToolbarButton active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">H3</ToolbarButton>
                <ToolbarButton active={editor?.isActive("heading", { level: 4 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4">H4</ToolbarButton>
                <span className="toolbar-sep" />
                <ToolbarButton active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">• List</ToolbarButton>
                <ToolbarButton active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Ordered list">1. List</ToolbarButton>
                <ToolbarButton active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Blockquote">"</ToolbarButton>
                <ToolbarButton active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} title="Code block">{"</>"}</ToolbarButton>
                <span className="toolbar-sep" />
                <ToolbarButton
                  active={editor?.isActive("link")}
                  onClick={() => {
                    const url = prompt("Enter URL:");
                    if (url) editor?.chain().focus().setLink({ href: url }).run();
                    else if (editor?.isActive("link")) editor.chain().focus().unsetLink().run();
                  }}
                  title="Link"
                >🔗</ToolbarButton>
                <ToolbarButton onClick={() => setLibraryMode("editor")} title="Pick from image library">🖼</ToolbarButton>
                <ToolbarButton onClick={handleEditorImageUpload} disabled={uploading} title="Upload image from device">
                  {uploading ? "⏳" : "📤"}
                </ToolbarButton>
                <span className="toolbar-sep" />
                <ToolbarButton onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">⊞ Table</ToolbarButton>
                {editor?.isActive("table") && (
                  <>
                    <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">+Col</ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">-Col</ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">+Row</ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">-Row</ToolbarButton>
                  </>
                )}
                <span className="toolbar-sep" />
                <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} title="Undo">↩</ToolbarButton>
                <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} title="Redo">↪</ToolbarButton>
              </div>
            )}

            <div style={{ display: "flex", minHeight: 420 }}>
              {activeTab !== "code" && (
                <div className="tiptap-wrapper" style={{ flex: 1, borderRight: activeTab === "split" ? "1px solid #e8eaed" : "none" }}>
                  <EditorContent editor={editor} style={{ height: "100%" }} />
                </div>
              )}
              {activeTab !== "editor" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", background: "#f9fafb", borderBottom: "1px solid #e8eaed" }}>HTML</div>
                    <textarea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} onBlur={syncEditorFromHtml} style={{ flex: 1, fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, padding: 14, border: "none", outline: "none", resize: "none", minHeight: 280, background: "#fff" }} placeholder="<p>HTML content...</p>" />
                  </div>
                  <div style={{ flex: "0 0 180px", borderTop: "1px solid #e8eaed", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", background: "#f9fafb", borderBottom: "1px solid #e8eaed" }}>CSS (Scoped)</div>
                    <textarea value={cssContent} onChange={(e) => setCssContent(e.target.value)} style={{ flex: 1, fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, padding: 14, border: "none", outline: "none", resize: "none", background: "#fff" }} placeholder=".my-class { color: red; }" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
