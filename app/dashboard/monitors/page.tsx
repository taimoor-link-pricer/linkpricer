"use client";

import { useAuthContext } from "@/lib/contexts/auth-context";

function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f5f6f8",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #e8eaed",
          borderTopColor: "#0052cc",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface MonitorRow {
  domain: string;
  publishedUrl: string;
  status: "Live" | "Down";
  daysLive: number;
  lastChecked: string;
}

export default function MonitorsPage() {
  const { loading } = useAuthContext();

  if (loading) return <LoadingSpinner />;

  // No monitors yet — empty state
  const monitors: MonitorRow[] = [];

  return (
    <>
    <style>{`
      .monitors-page { padding: 32px 40px; max-width: 1100px; margin: 0 auto; }
      @media (max-width: 768px) { .monitors-page { padding: 20px 16px; } }
    `}</style>
    <div className="monitors-page">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#000000",
            margin: "0 0 4px",
          }}
        >
          Link Monitors
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0, maxWidth: 520 }}>
          Track live links from completed orders — we check daily that your
          backlinks are still live.
        </p>
      </div>

      {/* Info banner */}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 10,
          padding: "14px 18px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>📡</span>
        <p style={{ fontSize: 13, color: "#1e40af", margin: 0 }}>
          We automatically monitor all your live links every 24 hours and alert
          you if a backlink goes down.
        </p>
      </div>

      {/* Table or empty state */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8eaed",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {monitors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#374151",
                margin: "0 0 8px",
              }}
            >
              No links to monitor yet
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#9ca3af",
                margin: 0,
                maxWidth: 380,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.6,
              }}
            >
              Links appear here automatically after your orders go live. Place
              an order to get started.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Domain", "Published URL", "Status", "Days Live", "Last Checked"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "12px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          borderBottom: "1px solid #e8eaed",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {monitors.map((row, idx) => {
                  const isLast = idx === monitors.length - 1;
                  const isLive = row.status === "Live";
                  return (
                    <tr key={row.domain} style={{ background: "#ffffff" }}>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
                          fontWeight: 600,
                          color: "#111827",
                          fontSize: 14,
                        }}
                      >
                        {row.domain}
                      </td>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
                        }}
                      >
                        <a
                          href={row.publishedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 13,
                            color: "#0052cc",
                            textDecoration: "none",
                            maxWidth: 240,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.publishedUrl}
                        </a>
                      </td>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: 99,
                            background: isLive ? "#dcfce7" : "#fee2e2",
                            color: isLive ? "#166534" : "#991b1b",
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
                          color: "#374151",
                          fontSize: 14,
                        }}
                      >
                        {row.daysLive}d
                      </td>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
                          color: "#6b7280",
                          fontSize: 13,
                        }}
                      >
                        {row.lastChecked}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
