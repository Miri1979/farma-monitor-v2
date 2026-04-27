import { useState, useEffect } from "react";

const MOCK_NORMAS = [
  {
    id: 1, boletin: "BOE", fecha: "2025-04-27",
    titulo: "Real Decreto 345/2025 — precios de referencia de medicamentos genéricos",
    url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-3456",
    tipo: "Real Decreto", impacto: "Alto",
    resumen: "Nuevo sistema de precios de referencia para genéricos, reduciendo un 12% el precio máximo financiado para más de 200 principios activos.",
    impacto_farma: "Obliga a revisión inmediata de cartera de productos financiados. Notificación formal al Ministerio de Sanidad en 30 días.",
  },
  {
    id: 2, boletin: "DOGC", fecha: "2025-04-27",
    titulo: "Ordre SLT/89/2025 — gestió de residus de medicaments en centres sanitaris",
    url: "https://portaldogc.gencat.cat/utilsEADOP/PDF/8890/1950234.pdf",
    tipo: "Orden autonómica", impacto: "Medio",
    resumen: "Actualiza requisitos de gestión y trazabilidad de residuos de medicamentos en centros hospitalarios catalanes.",
    impacto_farma: "Afecta a redes comerciales en Cataluña. Verificar protocolos de recogida de muestras y material promocional.",
  },
  {
    id: 3, boletin: "BOE", fecha: "2025-04-27",
    titulo: "Resolución AEMPS — actualización lista medicamentos de diagnóstico hospitalario",
    url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-3421",
    tipo: "Resolución", impacto: "Alto",
    resumen: "La AEMPS amplía en 18 principios activos la lista de medicamentos de uso diagnóstico hospitalario.",
    impacto_farma: "Impacto directo para laboratorios con productos incluidos. Revisión del canal de distribución hospitalario.",
  },
];

const IMPACTO_COLORS = {
  "Alto": { bg: "#FCEBEB", text: "#A32D2D", border: "#F7C1C1" },
  "Medio": { bg: "#FAEEDA", text: "#854F0B", border: "#FAC775" },
  "Bajo": { bg: "#EAF3DE", text: "#3B6D11", border: "#C0DD97" },
  "Sin impacto": { bg: "#F1EFE8", text: "#5F5E5A", border: "#D3D1C7" },
};

const ImpactoBadge = ({ nivel }) => {
  const c = IMPACTO_COLORS[nivel] || IMPACTO_COLORS["Sin impacto"];
  return (
    <span style={{
      background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
      borderRadius: 6, fontSize: 11, fontWeight: 500, padding: "2px 8px", whiteSpace: "nowrap"
    }}>{nivel}</span>
  );
};

const NormaCard = ({ norma, expanded, onToggle }) => (
  <div style={{
    background: "#fff",
    border: "0.5px solid #e0e0e0",
    borderRadius: 12, marginBottom: 12, overflow: "hidden"
  }}>
    <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{
          background: "#E6F1FB", color: "#185FA5", border: "0.5px solid #B5D4F4",
          borderRadius: 6, fontSize: 11, fontWeight: 500, padding: "2px 8px"
        }}>{norma.boletin}</span>
        <span style={{ fontSize: 11, color: "#888" }}>{norma.tipo}</span>
        <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>{norma.fecha}</span>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
        {norma.titulo}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <ImpactoBadge nivel={norma.impacto} />
        <span style={{ fontSize: 12, color: "#888" }}>{expanded ? "▲ cerrar" : "▼ ver más"}</span>
      </div>
    </div>
    {expanded && (
      <div style={{ borderTop: "0.5px solid #e0e0e0", padding: "14px 16px" }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Resumen ejecutivo</p>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6 }}>{norma.resumen}</p>
        <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Impacto farmacéutico</p>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6 }}>{norma.impacto_farma}</p>
        <a href={norma.url} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-block", fontSize: 12, color: "#185FA5", textDecoration: "none",
          border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "5px 12px", background: "#E6F1FB"
        }}>Ver norma oficial →</a>
      </div>
    )}
  </div>
);

export default function App() {
  const [normas, setNormas] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [filtroImpacto, setFiltroImpacto] = useState("Todos");
  const [filtroBoletin, setFiltroBoletin] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [usandoDemo, setUsandoDemo] = useState(false);

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const fechaHoy = new Date().toISOString().slice(0, 10);

  const cargarNormas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/normas?fecha=${fechaHoy}`);
      if (res.ok) {
        const data = await res.json();
        if (data.normas && data.normas.length > 0) {
          setNormas(data.normas);
          setUsandoDemo(false);
        } else {
          setNormas(MOCK_NORMAS);
          setUsandoDemo(true);
        }
      } else {
        throw new Error();
      }
    } catch {
      setNormas(MOCK_NORMAS);
      setUsandoDemo(true);
    }
    setLoading(false);
  };

  useEffect(() => { cargarNormas(); }, []);

  const normasFiltradas = normas.filter(n => {
    const okI = filtroImpacto === "Todos" || n.impacto === filtroImpacto;
    const okB = filtroBoletin === "Todos" || n.boletin === filtroBoletin;
    return okI && okB;
  });

  const stats = {
    total: normas.length,
    alto: normas.filter(n => n.impacto === "Alto").length,
    medio: normas.filter(n => n.impacto === "Medio").length,
    bajo: normas.filter(n => n.impacto === "Bajo").length,
  };

  const boletinesUnicos = ["Todos", ...Array.from(new Set(normas.map(n => n.boletin)))];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "0 auto", padding: "16px 12px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Monitor legislativo</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>Impacto para sector farmacéutico</p>
          </div>
          <button onClick={cargarNormas} disabled={loading} style={{
            fontSize: 12, padding: "6px 12px", borderRadius: 8,
            border: "0.5px solid #ccc", background: "#fff", cursor: "pointer"
          }}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>{today}</p>
      </div>

      {usandoDemo && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#FFF8E1", border: "0.5px solid #FFD54F", borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#854F0B" }}>
            Mostrando datos de demostración. En producción los boletines se cargan automáticamente cada día laborable a las 8h.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Normas hoy", val: stats.total, color: "#111" },
          { label: "Impacto alto", val: stats.alto, color: "#A32D2D" },
          { label: "Impacto medio", val: stats.medio, color: "#854F0B" },
          { label: "Impacto bajo", val: stats.bajo, color: "#3B6D11" },
        ].map(s => (
          <div key={s.label} style={{ background: "#f5f5f5", borderRadius: 8, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{s.label}</p>
            <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 600, color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["Todos", "Alto", "Medio", "Bajo"].map(f => (
          <button key={f} onClick={() => setFiltroImpacto(f)} style={{
            fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
            border: "0.5px solid #ccc",
            background: filtroImpacto === f ? "#E6F1FB" : "#fff",
            color: filtroImpacto === f ? "#185FA5" : "#555",
          }}>{f}</button>
        ))}
        <select value={filtroBoletin} onChange={e => setFiltroBoletin(e.target.value)}
          style={{ fontSize: 11, padding: "4px 8px", marginLeft: "auto", borderRadius: 6, border: "0.5px solid #ccc" }}>
          {boletinesUnicos.map(b => <option key={b}>{b}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem 0", color: "#888", fontSize: 13 }}>
          Consultando boletines…
        </div>
      ) : normasFiltradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem 0", color: "#888", fontSize: 13 }}>
          No hay normas con estos filtros.
        </div>
      ) : (
        normasFiltradas.map(n => (
          <NormaCard key={n.id} norma={n} expanded={expanded === n.id}
            onToggle={() => setExpanded(expanded === n.id ? null : n.id)} />
        ))
      )}

      <div style={{ marginTop: 20, padding: "10px 12px", background: "#f5f5f5", borderRadius: 8 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#888", lineHeight: 1.5 }}>
          Actualización automática lunes a viernes a las 8:00h. Boletines: BOE + 7 CCAA.
        </p>
      </div>
    </div>
  );
}
