import { getStore } from "@netlify/blobs";

export const config = {
  schedule: "0 7 * * 1-5",
};

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
  { nombre: "BOIB", label: "Baleares", rssUrl: "https://www.caib.es/govern/sac/fitxa.do?codi=3423&coduo=1&lang=es" },
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
    if (!res.ok) return [];
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
      const desc = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        block.match(/<description>([\s\S]*?)<\/description>/))?.[1]?.trim() || "";
      if (title && link) {
        items.push({ titulo: title, url: link, descripcion: desc, pubDate, boletin: boletin.nombre, label: boletin.label });
      }
    }
    return items;
  } catch (e) {
    console.error(`Error ${boletin.nombre}: ${e.message}`);
    return [];
  }
}

async function analizarConClaude(item) {
  const prompt = `Eres un experto jurídico y en regulación farmacéutica española y europea. Analiza esta norma y devuelve SOLO un JSON válido sin markdown ni explicaciones:
{
  "tipo": "tipo exacto de disposición (Ley, Real Decreto-ley, Real Decreto, Orden Ministerial, Resolución, Directiva, Reglamento UE, Decreto autonómico, etc.)",
  "resumen": "resumen ejecutivo claro en 3-4 frases, explicando qué regula, a quién afecta y cuándo entra en vigor si se menciona",
  "relevancia_farma": "Alta|No destacada",
  "motivo_farma": "si relevancia_farma es Alta: explica concretamente por qué y cómo afecta a una compañía farmacéutica. Si es No destacada: deja vacío."
}

Criterios para relevancia Alta en sector farmacéutico:
- Precios, financiación o reembolso de medicamentos
- Registro, autorización o renovación de medicamentos
- Ensayos clínicos o investigación clínica
- Farmacovigilancia o seguridad de medicamentos
- Distribución, dispensación o cadena de suministro
- Publicidad y promoción de medicamentos
- Normativa de residuos de medicamentos
- Inspecciones farmacéuticas o BPF/BPC
- Propiedad intelectual o patentes farmacéuticas
- Acceso anticipado o uso compasivo
- Normativa laboral específica del sector sanitario-farmacéutico

Norma: ${item.titulo}
Boletín: ${item.boletin} (${item.label})
Descripción: ${item.descripcion?.slice(0, 300) || "(sin descripción)"}`;

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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("Error Claude:", e.message);
    return { tipo: "Disposición", resumen: "No disponible.", relevancia_farma: "No destacada", motivo_farma: "" };
  }
}

export default async function handler() {
  console.log("Iniciando descarga de boletines...");
  const store = getStore("normas");

  const resultados = await Promise.all(BOLETINES.map(fetchRSS));
  const todosItems = resultados.flat();
  console.log(`Total normas encontradas: ${todosItems.length}`);

  if (todosItems.length === 0) {
    console.log("No hay normas hoy.");
    return;
  }

  const normasAnalizadas = [];
  let id = 1;
  for (let i = 0; i < todosItems.length; i += 5) {
    const lote = todosItems.slice(i, i + 5);
    const analizados = await Promise.all(lote.map(async (item) => {
      const analisis = await analizarConClaude(item);
      return {
        id: id++,
        fecha: new Date().toISOString().slice(0, 10),
        boletin: item.boletin,
        label: item.label,
        titulo: item.titulo,
        url: item.url,
        tipo: analisis.tipo || "Disposición",
        resumen: analisis.resumen,
        relevancia_farma: analisis.relevancia_farma || "No destacada",
        motivo_farma: analisis.motivo_farma || "",
      };
    }));
    normasAnalizadas.push(...analizados);
    if (i + 5 < todosItems.length) await new Promise(r => setTimeout(r, 800));
  }

  // Primero las de relevancia alta
  normasAnalizadas.sort((a, b) => {
    if (a.relevancia_farma === "Alta" && b.relevancia_farma !== "Alta") return -1;
    if (a.relevancia_farma !== "Alta" && b.relevancia_farma === "Alta") return 1;
    return 0;
  });

  const hoy = new Date().toISOString().slice(0, 10);
  await store.set(`normas-${hoy}`, JSON.stringify({
    fecha: hoy,
    total: normasAnalizadas.length,
    normas: normasAnalizadas,
    generadoEn: new Date().toISOString(),
  }));

  console.log(`Guardadas ${normasAnalizadas.length} normas para ${hoy}`);
}
