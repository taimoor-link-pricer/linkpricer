// Icon set + star rating, ported verbatim from the Karolis design handoff
// (data/helpers.jsx — `LP.Icon` / `LP.Stars`). Outline SVGs, 1.6px stroke.

type IconName =
  | "chevron" | "chevronDown" | "chevronUp" | "heart" | "heartFill" | "download"
  | "info" | "help" | "star" | "starFill" | "external" | "upload" | "search"
  | "arrowUp" | "arrowDown" | "arrowRight" | "sparkle" | "bolt" | "check" | "x"
  | "plus" | "lock" | "filter" | "sort" | "clock" | "plug" | "db" | "user"
  | "cart" | "shield" | "page" | "grid" | "list" | "flag" | "paperclip";

export function Icon({
  name,
  size = 16,
  color = "currentColor",
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style,
  };

  const paths: Record<IconName, React.ReactNode> = {
    chevron: <path d="M9 6l6 6-6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronUp: <path d="M6 15l6-6 6 6" />,
    heart: <path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11z" />,
    heartFill: <path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11z" fill={color} />,
    download: <><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.6" fill={color} /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2.3-2.6 3.7" /><circle cx="12" cy="17.2" r="0.6" fill={color} /></>,
    star: <path d="M12 3l2.6 5.6 6 .9-4.4 4.2 1 6-5.2-2.8-5.2 2.8 1-6L3.4 9.5l6-.9z" />,
    starFill: <path d="M12 3l2.6 5.6 6 .9-4.4 4.2 1 6-5.2-2.8-5.2 2.8 1-6L3.4 9.5l6-.9z" fill={color} />,
    external: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
    upload: <><path d="M12 20V8" /><path d="M7 13l5-5 5 5" /><path d="M5 4h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
    arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
    arrowDown: <path d="M12 5v14M5 12l7 7 7-7" />,
    arrowRight: <path d="M5 12h14M13 5l7 7-7 7" />,
    sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />,
    bolt: <path d="M13 3L4 14h7l-1 7 9-11h-7z" />,
    check: <path d="M5 12l4 4 10-10" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    filter: <path d="M3 5h18l-7 9v6l-4-2v-4z" />,
    sort: <><path d="M7 4v16M3 8l4-4 4 4" /><path d="M17 20V4M13 16l4 4 4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    plug: <><path d="M9 7v4M15 7v4" /><path d="M6 11h12v3a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" /><path d="M12 18v3" /></>,
    db: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></>,
    cart: <><path d="M3 4h2l2.5 12h11l2-8H7" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></>,
    shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
    page: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3" /><path d="M9 12h6M9 16h6M9 8h2" /></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill={color} /><circle cx="4" cy="12" r="1" fill={color} /><circle cx="4" cy="18" r="1" fill={color} /></>,
    flag: <><path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" /></>,
    paperclip: <path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />,
  };

  return <svg {...props}>{paths[name] ?? null}</svg>;
}

export function Stars({
  n = 0,
  size = 12,
  color = "#f59e0b",
  muted = "#d1d5db",
}: {
  n?: number;
  size?: number;
  color?: string;
  muted?: string;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= n ? "starFill" : "star"} size={size} color={i <= n ? color : muted} />
      ))}
    </span>
  );
}
