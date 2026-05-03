import { useState, useEffect } from "react";

function fechasEnRango(desde, hasta) {
  const fechas = [];
  const d = new Date(desde);
  const h = new Date(hasta);
  while (d <= h) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) fechas.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return fechas;
}

const NormaCard = ({ norma, expanded, onToggle }) => (
  <div style={{
    background: "#fff",
    border: norma.relevancia_farma === "Alta" ? "1px solid #F7C1C1" : "0.5px solid #e0e0e0",
    borderRadius: 12, marginBottom: 10, overflow: "hidden",
  }}>
    <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{
          background: "#E6F1FB", color: "#185FA5", border: "0.5px solid #B5D4F4",
          borderRadius: 6, fontSize: 11, fontWeight: 500, padding: "2px 8px"
        }}>{norma.boletin}</span>
        <span style={{ fontSize: 11, color: "#888" }}>{norma.tipo}</span>
        {norma.relevancia_farma === "Alta" && (
          <span style={{
            background: "#FCEBEB", color: "#A32D2D", border: "0.5px solid #F7C1C1",
            borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px", marginLeft: "auto"
          }}>⚠️ Alta relevancia farma</span>
        )}
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{norma.titulo}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#aaa" }}>{norma.fecha}</span>
        <span style={{ fontSize: 12, color: "#888" }}>{expanded ? "▲ cerrar" : "▼ ver más"}</span>
      </div>
    </div>
    {expanded && (
      <div style={{ borderTop: "0.5px solid #e0e0e0", padding: "14px 16px" }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Resumen ejecutivo</p>
        <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6 }}>{norma.resumen}</p>
        {norma.relevancia_farma === "Alta" && norma.motivo_farma && (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#A32D2D", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Impacto para compañía farmacéutica</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "#A32D2D" }}>{norma.motivo_farma}</p>
          </>
        )}
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
  const [filtroBoletin, setFiltroBoletin] = useState("Todos");
  const [soloAlta, setSoloAlta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cargandoBOE, setCargandoBOE] = useState(false);
  const [modo, setModo] = useState("hoy");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState("");

  const fechaHoy = new Date().toISOString().slice(0, 10);
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const cargarDia = async (fecha) => {
    try {
      const res = await fetch(`/api/normas?fecha=${fecha}`);
      if (res.ok) { const d = await res.json(); return d.normas || []; }
    } catch {}
    return [];
  };

  const cargarHoy = async () => {
    setLoading(true); setMsg(""); setNormas([]);
    const n = await cargarDia(fechaHoy);
    setNormas(n);
    if (n.length === 0) setMsg("No hay normas cargadas para hoy. Pulsa '⬇ Cargar BOE ahora' para descargarlas.");
    setLoading(false);
  };

  const forzarCarga = async () => {
    setCargandoBOE(true);
    setMsg("Descargando boletines y analizando con IA… puede tardar 2-3 minutos.");
    try {
      await fetch("/api/force-fetch");
      await cargarHoy();
      setMsg("");
    } catch {
      setMsg("Error al cargar los boletines. Inténtalo de nuevo.");
    }
    setCargandoBOE(false);
  };

  const buscarRango = async () => {
    if (!desde || !hasta || desde > hasta) { setMsg("Selecciona un rango de fechas válido."); return; }
    setBuscando(true); setMsg(""); setNormas([]);
    const fechas = fechasEnRango(desde, hasta);
    const resultados = await Promise.all(fechas.map(cargarDia));
    const todas = resultados.flat();
    todas.sort((a, b) => {
      if (a.relevancia_farma === "Alta" && b.relevancia_farma !== "Alta") return -1;
      if (a.relevancia_farma !== "Alta" && b.relevancia_farma === "Alta") return 1;
      return 0;
    });
    setNormas(todas);
    setMsg(todas.length === 0
      ? "No se encontraron normas en ese rango. Puede que aún no estén cargadas."
      : `${todas.length} normas encontradas entre ${desde} y ${hasta}.`);
    setBuscando(false);
  };

  useEffect(() => { cargarHoy(); }, []);

  const boletinesUnicos = ["Todos", ...Array.from(new Set(normas.map(n => n.boletin)))];
  const normasFiltradas = normas.filter(n => {
    const okB = filtroBoletin === "Todos" || n.boletin === filtroBoletin;
    const okA = !soloAlta || n.relevancia_farma === "Alta";
    return okB && okA;
  });
  const altaCount = normas.filter(n => n.relevancia_farma === "Alta").length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 500, margin: "0 auto", padding: "16px 12px", background: "#fafafa", minHeight: "100vh" }}>

      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Monitor Legislativo</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>BOE · DOUE · 17 boletines autonómicos</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#aaa" }}>{today}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: "0.5px solid #e0e0e0" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#888" }}>Normas {modo === "hoy" ? "hoy" : "en rango"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 700, color: "#111" }}>{normasFiltradas.length}</p>
        </div>
        <div style={{ background: "#FCEBEB", borderRadius: 10, padding: "10px 14px", border: "0.5px solid #F7C1C1" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#A32D2D" }}>Alta relevancia farma</p>
          <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 700, color: "#A32D2D" }}>{altaCount}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[{ id: "hoy", label: "📅 Hoy" }, { id: "rango", label: "🔍 Por fechas" }].map(m => (
          <button key={m.id} onClick={() => { setModo(m.id); if (m.id === "hoy") cargarHoy(); }} style={{
            fontSize: 12, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
            border: "0.5px solid #ccc",
            background: modo === m.id ? "#185FA5" : "#fff",
            color: modo === m.id ? "#fff" : "#555",
            fontWeight: modo === m.id ? 600 : 400,
          }}>{m.label}</button>
        ))}
        <button onClick={cargarHoy} disabled={loading || buscando || cargandoBOE} style={{
          fontSize: 12, padding: "7px 12px", borderRadius: 8,
          border: "0.5px solid #ccc", background: "#fff", cursor: "pointer", color: "#555"
        }}>↻</button>
        <button onClick={forzarCarga} disabled={cargandoBOE || loading || buscando} style={{
          fontSize: 12, padding: "7px 12px", borderRadius: 8,
          border: "none", background: cargandoBOE ? "#aaa" : "#185FA5",
          color: "#fff", cursor: "pointer",
        }}>{cargandoBOE ? "Descargando…" : "⬇ Cargar BOE ahora"}</button>
      </div>

      {modo === "rango" && (
        <div style={{ marginBottom: 14, padding: 14, background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#888" }}>Desde</p>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={fechaHoy}
                style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#888" }}>Hasta</p>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} max={fechaHoy}
                style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            </div>
          </div>
          <button onClick={buscarRango} disabled={buscando || !desde || !hasta} style={{
            marginTop: 10, width: "100%", fontSize: 12, padding: "8px", borderRadius: 8,
            border: "none", background: "#185FA5", color: "#fff", cursor: "pointer",
            opacity: (!desde || !hasta || buscando) ? 0.5 : 1,
          }}>{buscando ? "Buscando…" : "Buscar normas"}</button>
        </div>
      )}

      {normas.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setSoloAlta(!soloAlta)} style={{
            fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
            border: "0.5px solid #F7C1C1",
            background: soloAlta ? "#FCEBEB" : "#fff",
            color: soloAlta ? "#A32D2D" : "#555",
          }}>⚠️ Solo alta relevancia</button>
          <select value={filtroBoletin} onChange={e => setFiltroBoletin(e.target.value)}
            style={{ fontSize: 11, padding: "4px 8px", marginLeft: "auto", borderRadius: 6, border: "0.5px solid #ccc" }}>
            {boletinesUnicos.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      )}

      {msg && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FFF8E1", border: "0.5px solid #FFD54F", borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#854F0B", lineHeight: 1.5 }}>{msg}</p>
        </div>
      )}

      {loading || buscando ? (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "#aaa", fontSize: 13 }}>
          {buscando ? "Buscando normas…" : "Cargando boletines…"}
        </div>
      ) : normasFiltradas.map(n => (
        <NormaCard key={`${n.id}-${n.fecha}`} norma={n}
          expanded={expanded === `${n.id}-${n.fecha}`}
          onToggle={() => setExpanded(expanded === `${n.id}-${n.fecha}` ? null : `${n.id}-${n.fecha}`)} />
      ))}

      <div style={{ marginTop: 20, padding: "10px 14px", background: "#f0f0f0", borderRadius: 8 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#999", lineHeight: 1.5 }}>
          Actualización automática lunes a viernes a las 8:00h. Pulsa "⬇ Cargar BOE ahora" para actualizar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
