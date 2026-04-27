import { getStore } from "@netlify/blobs";

export const config = {
  schedule: "0 7 * * 1-5",
};

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const BOLETINES = [
  {
    id: "boe",
    nombre: "BOE",
    label: "Estado",
    rssUrl: "https://www.boe.es/rss/canal.php?c=1",
  },
  {
    id: "dogc",
    nombre: "DOGC",
    label: "Cataluña",
    rssUrl: "https://portaldogc.gencat.cat/utilsEADOP/RSS/RSS.do?tipo=01",
  },
  {
    id: "bocm",
    nombre: "BOCM",
    label: "Madrid",
    rssUrl: "https://www.bocm.es/rss/bocm_rss.xml",
  },
  {
    id: "bopv",
    nombre: "BOPV",
    label: "País Vasco",
    rssUrl: "https://www.euskadi.eus/bopv2/datos/rss/rss_bopv.xml",
  },
  {
    id: "boja",
    nombre: "BOJA",
    label: "Andalucía",
    rssUrl: "https://www.juntadeandalucia.es/boja/rss.xml",
  },
  {
    id: "docv",
    nombre: "DOCV",
    label: "C. Valenciana",
    rssUrl: "https://dogv.gva.es/portal/ficha_disposicion_pc.jsp?rss=1",
  },
  {
    id: "dog",
    nombre: "DOG",
    label: "Galicia",
    rssUrl: "https://www.xunta.gal/dog/Publicados/Rss/rss.xml",
  },
  {
    id: "borm",
    nombre: "BORM",
    label: "Murcia",
    rssUrl: "https://www.borm.es/borm/rss.do",
  },
];

async function fetchRSS(boletin) {
  try {
    const res = await fetch(boletin.rssUrl, {
      headers: { "User-Agent": "MonitorLegislativoFarma/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    const today = new Date().toISOString().slice(0, 10);

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || "";
      const link = (block.match(/<link>(.*?)<\/link>/) ||
        block.match(/<guid>(.*?)<\/guid>/))?.[1]?.trim() || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || "";
      const desc = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        block.match(/<description>([\s\S]*?)<\/description>/))?.[1]?.trim() || "";

      let isToday = true;
      if (pubDate) {
        const itemDate = new Date(pubDate).toISOString().slice(0, 10);
        isToday = itemDate === today;
      }

      if (isToday && title && link) {
        items.push({
          titulo: title,
          url: link,
          descripcion: desc,
          boletin: boletin.nombre,
          label: boletin.label,
        });
      }
    }
    return items;
  } catch (e) {
    console.error(`Error fetching ${boletin.nombre}:`, e.message);
    return [];
  }
}

async function analizarConClaude(item) {
  const prompt = `Eres un experto en regulación farmacéutica española. Analiza esta norma publicada en ${item.boletin} (${item.label}) y devuelve SOLO un JSON válido sin markdown:
{
  "tipo": "tipo de disposición (Ley, Real Decreto, Orden, Resolución, etc.)",
  "resumen": "resumen ejecutivo en 2-3 frases claras para un directivo",
  "impacto": "Alto|Medio|Bajo|Sin impacto",
  "impacto_farma": "explicación de cómo y en qué medida afecta a una compañía farmacéutica. Si no aplica, indica brevemente por qué."
}

Norma: ${item.titulo}
Descripción: ${item.descripcion || "(sin descripción)"}

Criterios de impacto para sector farmacéutico:
- Alto: afecta directamente a precios, registro, comercialización, ensayos clínicos, farmacovigilancia o financiación pública
- Medio: afecta a distribución, residuos, publicidad, dispensación o normativa laboral sanitaria
- Bajo: afecta indirectamente (contratación pública general, medioambiente, etc.)
- Sin impacto: no tiene relación con el sector farmacéutico`;

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
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("Error Claude:", e.message);
    return {
      tipo: "Disposición",
      resumen: "No se pudo generar el resumen automático.",
      impacto: "Sin impacto",
      impacto_farma: "Análisis no disponible.",
    };
  }
}

export default async function handler() {
  console.log("Iniciando descarga de boletines...");
  const store = getStore("normas");

  const resultados = await Promise.all(BOLETINES.map(fetchRSS));
  const todosItems = resultados.flat();
  console.log(`Total de normas encontradas: ${todosItems.length}`);

  if (todosItems.length === 0) {
    console.log("No hay normas hoy.");
    return;
  }

  const normasAnalizadas = [];
  let id = 1;
  for (let i = 0; i < todosItems.length; i += 5) {
    const lote = todosItems.slice(i, i + 5);
    const analizados = await Promise.all(
      lote.map(async (item) => {
        const analisis = await analizarConClaude(item);
        return {
          id: id++,
          fecha: new Date().toISOString().slice(0, 10),
          boletin: item.boletin,
          titulo: item.titulo,
          url: item.url,
          tipo: analisis.tipo || "Disposición",
          resumen: analisis.resumen,
          impacto: analisis.impacto,
          impacto_farma: analisis.impacto_farma,
        };
      })
    );
    normasAnalizadas.push(...analizados);
    if (i + 5 < todosItems.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const orden = { Alto: 0, Medio: 1, Bajo: 2, "Sin impacto": 3 };
  normasAnalizadas.sort((a, b) => (orden[a.impacto] ?? 4) - (orden[b.impacto] ?? 4));

  const hoy = new Date().toISOString().slice(0, 10);
  await store.set(`normas-${hoy}`, JSON.stringify({
    fecha: hoy,
    total: normasAnalizadas.length,
    normas: normasAnalizadas,
    generadoEn: new Date().toISOString(),
  }));

  console.log(`Guardadas ${normasAnalizadas.length} normas para ${hoy}`);
}
