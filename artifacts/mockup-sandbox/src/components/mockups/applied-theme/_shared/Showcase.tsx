type Tokens = Record<string, string>;

const SEMANTIC = { green: "#22c55e", blue: "#38bdf8", red: "#ef4444", orange: "#f59e0b" };

export function Showcase({ t, modeName, tagline }: { t: Tokens; modeName: string; tagline: string }) {
  const font = "'Inter', system-ui, -apple-system, sans-serif";
  const card: React.CSSProperties = {
    background: t.panel,
    border: `1px solid ${t.line}`,
    borderRadius: 14,
    padding: 16,
  };
  return (
    <div style={{ fontFamily: font, background: t.bg, minHeight: "100vh", color: t.text }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      />
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <div
          style={{
            width: 210,
            background: t.sidebar,
            borderRight: `1px solid ${t.line}`,
            padding: "18px 12px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 16px" }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: t.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              CK
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 0.3 }}>CONCRETE KING</div>
              <div style={{ fontSize: 9, color: t.muted, letterSpacing: 1.4 }}>RMC OPERATIONS OS</div>
            </div>
          </div>
          {["Dashboard", "Orders", "Dispatch", "Nearby Plants", "Reports"].map((item, i) => (
            <div
              key={item}
              style={{
                padding: "9px 10px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: i === 0 ? 700 : 500,
                color: i === 0 ? t.gold : t.muted,
                background: i === 0 ? t.goldSoft : "transparent",
                marginBottom: 2,
              }}
            >
              {item}
            </div>
          ))}
          <div style={{ marginTop: 22, padding: 10, borderRadius: 10, background: t.promptBg, border: `1px solid ${t.promptBorder}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.gold }}>{modeName} mode</div>
            <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>{tagline}</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Dashboard</div>
              <div style={{ fontSize: 12, color: t.muted }}>Applied theme — exactly as it renders in the live app</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  fontFamily: font,
                  background: "transparent",
                  color: t.text,
                  border: `1px solid ${t.line}`,
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                Export
              </button>
              <button
                style={{
                  fontFamily: font,
                  background: t.gold,
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                + New Order
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            {[
              { label: "Today's Dispatch", value: "142 m³", delta: "+12%", color: SEMANTIC.green },
              { label: "Active Orders", value: "18", delta: "5 pending", color: t.gold },
              { label: "Fleet On Road", value: "9 / 12", delta: "3 idle", color: SEMANTIC.blue },
              { label: "Overdue Challans", value: "2", delta: "action needed", color: SEMANTIC.red },
            ].map((k) => (
              <div key={k.label} style={card}>
                <div style={{ fontSize: 11, color: t.muted, fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 2px" }}>{k.value}</div>
                <div style={{ fontSize: 11, color: k.color, fontWeight: 700 }}>{k.delta}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
            {/* Recent dispatch table */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Recent Dispatch</div>
              {[
                { ch: "CH-2041", client: "Skyline Infra", grade: "M25", qty: "8 m³", st: "Delivered", c: SEMANTIC.green },
                { ch: "CH-2040", client: "Metro Rail P4", grade: "M35", qty: "10 m³", st: "In transit", c: SEMANTIC.blue },
                { ch: "CH-2039", client: "GreenHomes", grade: "M20", qty: "6 m³", st: "Delivered", c: SEMANTIC.green },
                { ch: "CH-2038", client: "NH-48 Bridge", grade: "M40", qty: "12 m³", st: "Delayed", c: SEMANTIC.red },
              ].map((r) => (
                <div
                  key={r.ch}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 0",
                    borderTop: `1px solid ${t.line}`,
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ fontWeight: 700, color: t.gold, width: 70 }}>{r.ch}</span>
                  <span style={{ flex: 1 }}>{r.client}</span>
                  <span style={{ color: t.muted, width: 44 }}>{r.grade}</span>
                  <span style={{ width: 50 }}>{r.qty}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: r.c,
                      background: t.chipBg,
                      borderRadius: 99,
                      padding: "3px 9px",
                    }}
                  >
                    {r.st}
                  </span>
                </div>
              ))}
            </div>

            {/* Palette */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Theme tokens ({modeName})</div>
              {[
                ["Page background", t.bg],
                ["Card / panel", t.panel],
                ["Ink text", t.text],
                ["Muted text", t.muted],
                ["Teal accent", t.gold],
                ["Accent dark", t.goldDark],
                ["Accent soft tint", t.goldSoft],
              ].map(([label, hex]) => (
                <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: hex as string,
                      border: `1px solid ${t.line}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 11, color: t.muted, fontFamily: "monospace" }}>{hex}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.line}`, fontSize: 11, color: t.muted }}>
                Auto mode switches Day ↔ Night by local sunrise/sunset — no location prompt.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
