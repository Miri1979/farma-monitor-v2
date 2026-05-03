import { getStore } from "@netlify/blobs";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const BOLETINES = [
  { nombre: "BOE", label: "Estado", rssUrl: "https://www.boe.es/rss/canal.php?c=1" },
  { nombre: "DOUE", label: "UE", rssUrl: "https://eur-lex.europa.eu/rss/oj_l.xml" },
  { nombre: "DOGC", label: "Cataluña", rssUrl: "https://portaldogc.gencat.cat/utilsEADOP/RSS/RSS.do?tipo=01" },
  { nombre: "BOCM", label: "Madrid", rssUrl: "https://www.bocm.es/rss/bocm_rss.xml" },
  { nombre: "BOPV", label: "País Vasco", rssUrl: "https://www.euskadi.eus/bopv2/datos/rss/rss_bopv.xml" },
  { nombre: "BOJA", label: "Andalucía", rssUrl: "https://www.juntadeandalucia.es/boja/rss.xml" },
  { nombre: "DOCV", label: "C. Valenciana", rssUrl: "https://dogv.gva.es/portal/ficha_disposicion_pc.jsp?rss=1" },
  { nombre: "DOG", label: "Galicia", rssUrl: "https://www.xunta.gal/dog/Publicados/Rss/rss.xml" },
  { nombre: "BORM", label: "Murcia", rssUrl: "https://www.borm.es/borm/rss.do" },
  { nombre: "BOA", label: "Aragón", rssUrl: "https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERLST&BASE=BISA&DOCS=1-10&SEC=FIRMA&SEPARADOR=&&SORT=-PUBL&rss=1" },
  { nombre: "BOCA", label: "Canarias", rssUrl: "https://www.gobiernodecanarias.org/boc/rss.xml" },
  { nombre: "BOPA", label: "Asturias", rssUrl: "https://sede.asturias.es/bopa/rss/bopa.rss" },
  { nombre: "BOC", label: "Cantabria", rssUrl: "https://boc.cantabria.es/boces/rss.rss" },
  { nombre: "BOCL", label: "Castilla y León", rssUrl: "https://bocyl.jcyl.es/rss/bocyl.rss" },
  { nombre: "DOCM", label: "Castilla-La Mancha", rssUrl: "https://docm.jccm.es/docm/rss/rss.jsp" },
  { nombre: "DOE", label: "Extremadura", rssUrl: "https://doe.juntaex.es/pdfs/doe/rss.xml" },
  { nombre: "BOR", label: "La Rioja", rssUrl: "https://ias1.larioja.org/boletin/Bor_Boletin.portada?rss=1" },
  { nombre: "BON", label: "Navarra", rssUrl: "https://bon.navarra.es/rss/bon.rss" },
];

async function fetchRSS(boletin) {
  try {
    const res = await fetch(boletin.rssUrl, {
      headers: { "User-Agent": "MonitorLegislativoFarma/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { nombre: boletin.nombre, error: `HTTP ${res.status}`, items: [], total: 0 };
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || "";
      const link = (block.match(/<link>(.*?)<\/link>/) ||
        block.match(/<guid[^>]*>(.*?)<\/guid>/))?.[1]?.trim() || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/))?.[1]?.trim() || "";
      if (title && link) items.push({ titulo: title, url: link, pubDate, boletin: boletin.nombre, label: boletin.label });
    }
    return { nombre: boletin.nombre, items, total: items.length };
  } catch (e) {
    return { nombre: boletin.nombre, error: e.message, items: [], total: 0 };
  }
}

async function analizarConClaude(item) {
  const prompt = `Eres un experto jurídico y en regulación farmacéutica. Analiza esta norma y devuelve SOLO un JSON válido sin markdown:
{"tipo":"tipo de disposición","resumen":"resumen ejecutivo en 3-4 frases","relevancia_farma":"Alta|No destacada","motivo_farma":"si Alta: motivo concreto, si No destacada: vacío"}

Norma: ${item.titulo}
Boletín: ${item.boletin} (${item.label})`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { tipo: "Disposición", resumen: "No disponible", relevancia_farma: "No destacada", motivo_farma: "" };
  }
}

export default async function handler() {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  try {
    const store = getStore("normas");
    const hoy = new Date().toISOString().slice(0, 10);

    const resultados = await Promise.all(BOLETINES.map(fetchRSS));
    const diagnostico = resultados.map(r => ({
      boletin: r.nombre, total: r.total || 0, error: r.error || null,
      muestra: r.items.slice(0, 2).map(i => i.titulo)
    }));

    const todosItems = resultados.flatMap(r => r.items);
    const normasAnalizadas = [];
    let id = 1;

    for (let i = 0; i < todosItems.length; i += 5) {
      const lote = todosItems.slice(i, i + 5);
      const analizados = await Promise.all(lote.map(async (item) => {
        const analisis = await analizarConClaude(item);
        return {
          id: id++, fecha: hoy,
          boletin: item.boletin, label: item.label,
          titulo: item.titulo, url: item.url,
          tipo: analisis.tipo || "Disposición",
          resumen: analisis.resumen,
          relevancia_farma: analisis.relevancia_farma || "No destacada",
          motivo_farma: analisis.motivo_farma || "",
        };
      }));
      normasAnalizadas.push(...analizados);
      if (i + 5 < todosItems.length) await new Promise(r => setTimeout(r, 800));
    }

    normasAnalizadas.sort((a, b) => {
      if (a.relevancia_farma === "Alta" && b.relevancia_farma !== "Alta") return -1;
      if (a.relevancia_farma !== "Alta" && b.relevancia_farma === "Alta") return 1;
      return 0;
    });

    await store.set(`normas-${hoy}`, JSON.stringify({
      fecha: hoy, total: normasAnalizadas.length,
      normas: normasAnalizadas, generadoEn: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
      ok: true, fecha: hoy,
      diagnostico,
      total_normas: normasAnalizadas.length,
      normas_alta_relevancia: normasAnalizadas.filter(n => n.relevancia_farma === "Alta").length,
    }, null, 2), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
}

export const config = { path: "/api/force-fetch" };
