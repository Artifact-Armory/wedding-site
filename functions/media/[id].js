// Photos uploaded through the admin panel. Only signed-in guests can see them.
export async function onRequestGet({ params, env }) {
  if (!env.SITE_KV || !/^[a-z0-9-]{6,64}$/.test(params.id)) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.SITE_KV.getWithMetadata(`media:${params.id}`, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: { "Content-Type": metadata?.type || "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
