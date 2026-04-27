import { getStore } from "@netlify/blobs";

export default async function handler(req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const store = getStore("normas");
    const url = new URL(req.url, "https://placeholder.com");
    const fechaParam = url.searchParams.get("fecha");
    const fecha = fechaParam || new Date().toISOString().slice(0, 10);

    const raw = await store.get(`normas-${fecha}`);

    if (!raw) {
      return new Response(JSON.stringify({
        fecha,
        total: 0,
        normas: [],
        mensaje: "No hay normas disponibles para esta fecha. Los boletines se actualizan automáticamente en días laborables a las 8:00h.",
      }), { status: 200, headers });
    }

    return new Response(raw, { status: 200, headers });

  } catch (e) {
    console.error("Error get-normas:", e);
    return new Response(JSON.stringify({ error: "Error interno", normas: [] }), {
      status: 500,
      headers,
    });
  }
}

export const config = { path: "/api/normas" };
