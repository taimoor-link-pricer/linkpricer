"use client";

// Shared between ProfileMenu (small nav avatar) and the Profile page (larger
// preview + upload target) so both render the same photo-or-initials circle.
export function Avatar({ url, initials, size }: { url: string | null | undefined; initials: string; size: number }) {
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%",
    background: "linear-gradient(135deg, #2c64f0, #7c3aed)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800, fontSize: size * 0.36, letterSpacing: 0.5,
    flexShrink: 0, overflow: "hidden",
  };
  if (url) {
    return (
      <div style={style}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return <div style={style}>{initials}</div>;
}
