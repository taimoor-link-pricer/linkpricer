"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "active" | "blocked" | "expired" | "revoked";

interface AdminKey {
  id: string;
  name: string;
  userId: string;
  email: string;
  userName: string | null;
  source: "subscription" | "admin";
  plan: string | null;
  grantedBy: string | null;
  monthlyLimit: number;
  monthUsed: number;
  perMinuteLimit: number;
  lastUsedAt: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  blockedAt: string | null;
  status: Status;
}

interface Created {
  key: string;
  email: string;
  accountCreated: boolean;
  setPasswordLink: string | null;
}

const FILTERS: { value: string; label: string }[] = [
  { value: "current", label: "All current" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

const STATUS_STYLE: Record<Status, { bg: string; color: string; label: string }> = {
  active: { bg: "#dcfce7", color: "#166534", label: "Active" },
  blocked: { bg: "#fee2e2", color: "#b91c1c", label: "Blocked" },
  expired: { bg: "#fef3c7", color: "#92400e", label: "Expired" },
  revoked: { bg: "#f3f4f6", color: "#6b7280", label: "Revoked" },
};

// Expiry is picked as a calendar date and means "through the end of that day,
// UTC" — the same clock the monthly quota resets on.
const dateToExpiry = (d: string) => (d ? `${d}T23:59:59.000Z` : null);
const expiryToDate = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const input: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #d1d5db",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 };
const primaryBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "#fff", background: "#2563eb", border: "none",
  borderRadius: 7, padding: "9px 16px", cursor: "pointer",
};
const ghostBtn: React.CSSProperties = { fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer" };
const linkBtn: React.CSSProperties = { fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        style={{ background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: "0 0 16px" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function CopyRow({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} style={{ ...input, fontFamily: mono ? "monospace" : undefined, background: "#f9fafb" }} />
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        style={{ ...primaryBtn, whiteSpace: "nowrap" }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<AdminKey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("current");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [editing, setEditing] = useState<AdminKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Responses can land out of order (a slow search for "a" after a fast one
  // for "ab"); only the latest request may write to the table.
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const seq = ++latestLoad.current;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), status });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/api-keys?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load API keys");
      if (seq !== latestLoad.current) return;
      setKeys(data.keys);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      if (seq === latestLoad.current) setLoadError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      if (seq === latestLoad.current) setLoading(false);
    }
  }, [page, status, search]);

  // Debounced so typing in the search box is one request, not one per key.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function setBlocked(k: AdminKey, blocked: boolean) {
    if (blocked && !confirm(`Block the API key for ${k.email}? Requests with it will be refused immediately.`)) return;
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/admin/api-keys/${k.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });
      if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Failed to update the key.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const th: React.CSSProperties = {
    textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #e8eaed", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #f0f2f5", fontSize: 13, color: "#374151", verticalAlign: "top" };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: "0 0 4px" }}>API Keys</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Every developer API key. Create one without a subscription, set its limits and expiry, or block it.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={primaryBtn}>+ Create API key</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by email, name or key name"
          style={{ ...input, width: 300 }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              style={{
                fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 99, cursor: "pointer",
                border: "1px solid " + (status === f.value ? "#2563eb" : "#e5e7eb"),
                background: status === f.value ? "#eff6ff" : "#fff",
                color: status === f.value ? "#2563eb" : "#4b5563",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>{total.toLocaleString("en-US")} {total === 1 ? "key" : "keys"}</span>
      </div>

      {loadError && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{loadError}</div>}

      <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Account", "Key", "Usage this month", "Per min", "Expires", "Last used", "Status", ""].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && keys.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 32 }}>Loading…</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 32 }}>No API keys match.</td></tr>
            ) : keys.map((k) => {
              const s = STATUS_STYLE[k.status];
              return (
                <tr key={k.id} style={{ opacity: busyId === k.id ? 0.5 : 1 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: "#111827" }}>{k.email}</div>
                    {k.userName && <div style={{ fontSize: 12, color: "#6b7280" }}>{k.userName}</div>}
                  </td>
                  <td style={td}>
                    <div>{k.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {k.source === "subscription" ? `Stripe subscription${k.plan ? ` · ${k.plan}` : ""}` : k.grantedBy ? `Granted by ${k.grantedBy}` : "No subscription"}
                      {" · "}created {fmtDate(k.createdAt)}
                    </div>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {k.monthUsed.toLocaleString("en-US")} / {k.monthlyLimit.toLocaleString("en-US")}
                  </td>
                  <td style={td}>{k.perMinuteLimit}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{k.expiresAt ? fmtDate(k.expiresAt) : "Never"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(k.lastUsedAt)}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                    {k.status !== "revoked" && (
                      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button onClick={() => setEditing(k)} style={{ ...linkBtn, color: "#2563eb" }}>Edit</button>
                        {k.blockedAt ? (
                          <button onClick={() => setBlocked(k, false)} disabled={busyId === k.id} style={{ ...linkBtn, color: "#166534" }}>Unblock</button>
                        ) : (
                          <button onClick={() => setBlocked(k, true)} disabled={busyId === k.id} style={{ ...linkBtn, color: "#dc2626" }}>Block</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...ghostBtn, opacity: page <= 1 ? 0.4 : 1 }}>← Previous</button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...ghostBtn, opacity: page >= totalPages ? 0.4 : 1 }}>Next →</button>
        </div>
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={(c) => { setCreating(false); setCreated(c); load(); }}
        />
      )}
      {created && (
        <Modal title="API key created" onClose={() => setCreated(null)}>
          <p style={{ fontSize: 13, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", margin: "0 0 14px" }}>
            Copy the key now. It is shown only once — only its hash is stored.
          </p>
          <span style={label}>API key for {created.email}</span>
          <CopyRow value={created.key} />
          {created.accountCreated && (
            <div style={{ marginTop: 16 }}>
              <span style={label}>New account — set-password link</span>
              {created.setPasswordLink ? (
                <>
                  <CopyRow value={created.setPasswordLink} mono={false} />
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "6px 0 0" }}>
                    Send this to {created.email} so they can choose a password and sign in to their developer dashboard.
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                  The account was created, but a set-password link could not be generated. They can use “Forgot password” on the sign-in page.
                </p>
              )}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={() => setCreated(null)} style={primaryBtn}>Done</button>
          </div>
        </Modal>
      )}
      {editing && (
        <EditModal k={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function LimitFields(props: {
  monthlyLimit: string; setMonthlyLimit: (v: string) => void;
  perMinuteLimit: string; setPerMinuteLimit: (v: string) => void;
  expiry: string; setExpiry: (v: string) => void;
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label} htmlFor="ak-monthly">Monthly limit (lookups)</label>
          <input id="ak-monthly" type="number" min={1} value={props.monthlyLimit} onChange={(e) => props.setMonthlyLimit(e.target.value)} style={input} />
        </div>
        <div>
          <label style={label} htmlFor="ak-minute">Per-minute limit (requests)</label>
          <input id="ak-minute" type="number" min={1} value={props.perMinuteLimit} onChange={(e) => props.setPerMinuteLimit(e.target.value)} style={input} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor="ak-expiry">Expires (optional)</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input id="ak-expiry" type="date" value={props.expiry} onChange={(e) => props.setExpiry(e.target.value)} style={{ ...input, width: 180 }} />
          {props.expiry && <button onClick={() => props.setExpiry("")} style={ghostBtn}>Never expires</button>}
        </div>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "5px 0 0" }}>
          Works through the end of that day (UTC). Leave empty for a key that never expires.
        </p>
      </div>
    </>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Created) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("1000");
  const [perMinuteLimit, setPerMinuteLimit] = useState("60");
  const [expiry, setExpiry] = useState("");
  // Shown only once the server says there is no account for this email.
  const [needsAccount, setNeedsAccount] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(createAccount: boolean) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim() || undefined,
          monthlyLimit: Number(monthlyLimit),
          perMinuteLimit: Number(perMinuteLimit),
          expiresAt: dateToExpiry(expiry),
          createAccount,
          firstName,
          lastName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return onCreated(data as Created);
      if (data.code === "no_account") {
        setNeedsAccount(true);
        return;
      }
      setError(data.error ?? "Failed to create the API key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create API key" onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor="ak-email">Account email</label>
        <input
          id="ak-email" type="email" autoFocus value={email} placeholder="partner@example.com"
          onChange={(e) => { setEmail(e.target.value); setNeedsAccount(false); }}
          style={input}
        />
      </div>

      {needsAccount && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "#1e40af", margin: "0 0 10px" }}>
            No account exists for this email. A new account will be created and the key tied to it.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label} htmlFor="ak-first">First name (optional)</label>
              <input id="ak-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label} htmlFor="ak-last">Last name (optional)</label>
              <input id="ak-last" value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor="ak-name">Key name (optional)</label>
        <input id="ak-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Linkpricer API — Admin grant" style={input} />
      </div>

      <LimitFields
        monthlyLimit={monthlyLimit} setMonthlyLimit={setMonthlyLimit}
        perMinuteLimit={perMinuteLimit} setPerMinuteLimit={setPerMinuteLimit}
        expiry={expiry} setExpiry={setExpiry}
      />

      {error && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={() => submit(needsAccount)} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Creating…" : needsAccount ? "Create account + key" : "Create key"}
        </button>
      </div>
    </Modal>
  );
}

function EditModal({ k, onClose, onSaved }: { k: AdminKey; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(k.name);
  const [monthlyLimit, setMonthlyLimit] = useState(String(k.monthlyLimit));
  const [perMinuteLimit, setPerMinuteLimit] = useState(String(k.perMinuteLimit));
  const [expiry, setExpiry] = useState(expiryToDate(k.expiresAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    // Send only what changed: an untouched expiry that has already passed
    // would otherwise be rejected as "must be in the future".
    const body: Record<string, unknown> = {};
    if (name.trim() !== k.name) body.name = name;
    if (Number(monthlyLimit) !== k.monthlyLimit) body.monthlyLimit = Number(monthlyLimit);
    if (Number(perMinuteLimit) !== k.perMinuteLimit) body.perMinuteLimit = Number(perMinuteLimit);
    if (expiry !== expiryToDate(k.expiresAt)) body.expiresAt = dateToExpiry(expiry);
    if (Object.keys(body).length === 0) return onClose();

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/api-keys/${k.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return onSaved();
      setError((await res.json().catch(() => ({}))).error ?? "Failed to update the key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit key — ${k.email}`} onClose={onClose}>
      {k.source === "subscription" && (
        <p style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", margin: "0 0 14px" }}>
          This key belongs to a Stripe subscription. Stripe resets its limits and clears any expiry whenever the subscription updates — to stop it, block it instead.
        </p>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor="ak-name">Key name</label>
        <input id="ak-name" value={name} onChange={(e) => setName(e.target.value)} style={input} />
      </div>
      <LimitFields
        monthlyLimit={monthlyLimit} setMonthlyLimit={setMonthlyLimit}
        perMinuteLimit={perMinuteLimit} setPerMinuteLimit={setPerMinuteLimit}
        expiry={expiry} setExpiry={setExpiry}
      />
      <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 10px" }}>
        Used this month: {k.monthUsed.toLocaleString("en-US")}. Changing the limit does not reset usage.
      </p>
      {error && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}
