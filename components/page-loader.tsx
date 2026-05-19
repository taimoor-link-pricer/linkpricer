export function PageLoader() {
  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", alignItems: "center",
      justifyContent: "center", background: "#ffffff", zIndex: 9999,
    }}>
      <img
        src="/logo-icon.png"
        alt="Linkpricer"
        style={{ width: 48, height: 48, animation: "lp-pulse 1.4s ease-in-out infinite" }}
      />
      <style>{`
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.92); }
        }
      `}</style>
    </div>
  );
}
