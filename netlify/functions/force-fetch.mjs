import { getStore } from "@netlify/blobs";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const BOLETINES = [
  { nombre: "BOE", label: "Estado", rssUrl: "https://www.boe.es/rss/canal.php?c=1" },
  { nombre: "DOGC", label: "Cataluña", rssUrl: "https://portaldogc.gencat.cat/utilsEADOP/RSS/RSS.do?tipo=01" },
  { nombre: "BOCM", label: "Madrid", rssUrl: "https://www.bocm.es/rss/bocm_rss.xml" },
  { nombre: "BOPV", label: "País Vasco", rssUrl: "https://www.euskadi.eus/bopv2/datos/rss/rss_bopv.xml" },
  { nombre: "BOJA", label: "Andalucía", rssUrl: "https://www.juntadeandalucia.es/boja/rss.xml" },
  { nombre: "DOG", label: "Galicia", rssUrl: "https://www.xunta.gal/dog/Publicados/Rss/rss.xml" },
];

async function fetchRSS(boletin) {
  try {
    const res = await fetch(boletin.rssUrl, {
      headers: { "User-Agent": "MonitorLegislativoFarma/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { nombre: boletin.nombre, error: `HTTP ${res.status}`, items: [] };
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || "";
      const link = (block.match(/<link>(.*?)<\/link>/) ||
        block.match(/<guid>(.*?)<\/guid>/))?.[1]?.trim() || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/))?.[1]?.trim() || "";
      if (title && link) items.push({ title, link, pubDate });
    }
    return { nombre: boletin.nombre, items: items.slice(0, 5), total: items.length };
  } catch (e) {
    return { nombre: boletin.nombre, error: e.message, items: [] };
  }
}

async function analizarConClaude(item, boletin) {
  const prompt = `Eres un experto en regulación farmacéutica española. Analiza esta norma y devuelve SOLO un JSON válido sin markdown:
{"tipo":"tipo de disposición","resumen":"resumen ejecutivo en 2-3 frases","impacto":"Alto|Medio|Bajo|Sin impacto","impacto_farma":"explicación del impacto para una compañía farmacéutica"}

Norma: ${item.title}
Boletín: ${boletin}`;

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
    return { tipo: "Disposición", resumen: "No disponible", impacto: "Sin impacto", impacto_farma: "No disponible" };
  }
}

export default async function handler() {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  try {
    const store = getStore("normas");
    const hoy = new Date().toISOString().slice(0, 10);

    // Descarga todos los boletines
    const resultados = await Promise.all(BOLETINES.map(fetchRSS));
    const diagnostico = resultados.map(r => ({
      boletin: r.nombre,
      total_items: r.total || 0,
      error: r.error || null,
      muestra: r.items.slice(0, 2).map(i => ({ title: i.title, pubDate: i.pubDate }))
    }));

    // Coge hasta 20 items en total para analizar
    const todosItems = resultados.flatMap(r =>
      r.items.map(i => ({ ...i, boletin: r.nombre }))
    ).slice(0, 20);

    // Analiza con Claude
    const normasAnalizadas = [];
    let id = 1;
    for (const item of todosItems) {
      const analisis = await analizarConClaude(item, item.boletin);
      normasAnalizadas.push({
        id: id++,
        fecha: hoy,
        boletin: item.boletin,
        titulo: item.title,
        url: item.link,
        tipo: analisis.tipo || "Disposición",
        resumen: analisis.resumen,
        impacto: analisis.impacto,
        impacto_farma: analisis.impacto_farma,
      });
    }

    const orden = { Alto: 0, Medio: 1, Bajo: 2, "Sin impacto": 3 };
    normasAnalizadas.sort((a, b) => (orden[a.impacto] ?? 4) - (orden[b.impacto] ?? 4));

    // Guarda en Blobs
    await store.set(`normas-${hoy}`, JSON.stringify({
      fecha: hoy,
      total: normasAnalizadas.length,
      normas: normasAnalizadas,
      generadoEn: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
      ok: true,
      fecha: hoy,
      diagnostico,
      normas_guardadas: normasAnalizadas.length,
    }, null, 2), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
}

export const config = { path: "/api/force-fetch" };
