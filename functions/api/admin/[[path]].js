// Admin API. The middleware only lets this run for someone signed in with the admin password.
import { getContent, getPasswords } from "../../_middleware.js";
import GUESTS from "../../_guests.json";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const str = (v, n = 2000) => String(v ?? "").slice(0, n);
const only = (v) => (v === "day" || v === "evening" ? v : undefined);
const tidyObj = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));

// Accept only the shape the site understands, so a bad save can't break the page
function cleanContent(c) {
  const box = (d) => tidyObj({
    title: str(d.title, 80), text: str(d.text, 3000), map: str(d.map, 200), mapLabel: str(d.mapLabel, 60),
    phones: Array.isArray(d.phones) ? d.phones.slice(0, 20).map((p) => ({ name: str(p.name, 60), number: str(p.number, 30) })).filter((p) => p.name || p.number) : undefined,
    only: only(d.only),
  });
  const photo = (s) => (typeof s === "string" && /^\/(img|media)\/[a-zA-Z0-9._-]+$/.test(s) ? s : undefined);
  return {
    story: { text: str(c.story?.text, 6000) },
    photos: tidyObj({
      heroLeft: photo(c.photos?.heroLeft), heroRight: photo(c.photos?.heroRight), story: photo(c.photos?.story), footer: photo(c.photos?.footer),
      carousel: (c.photos?.carousel || []).map(photo).filter(Boolean).slice(0, 20),
    }),
    countdownTo: { day: str(c.countdownTo?.day, 40), evening: str(c.countdownTo?.evening, 40) },
    timeline: (c.timeline || []).slice(0, 40).map((t) => tidyObj({ time: str(t.time, 12), title: str(t.title, 80), note: str(t.note, 160), eve: t.eve ? true : undefined, only: only(t.only) })),
    details: (c.details || []).slice(0, 30).map(box),
    travel: (c.travel || []).slice(0, 30).map(box),
    hotels: (c.hotels || []).slice(0, 10).map((g) => ({
      area: str(g.area, 60),
      list: (g.list || []).slice(0, 30).map((h) => tidyObj({ name: str(h.name, 100), sub: str(h.sub, 160), dist: str(h.dist, 20), q: str(h.q, 200), rec: h.rec ? true : undefined, deal: h.deal ? true : undefined })),
    })),
    rsvp: { meals: (c.rsvp?.meals || []).map((m) => str(m, 80).trim()).filter(Boolean).slice(0, 12), replyBy: str(c.rsvp?.replyBy, 60) },
  };
}

function cleanGuests(list) {
  const seen = new Set();
  return (list || []).slice(0, 400).map((p, i) => {
    const type = p.type === "evening" ? "evening" : "day";
    let id = /^[a-z0-9]{2,12}$/.test(p.id || "") && !seen.has(p.id) ? p.id : `${type[0]}${Date.now().toString(36)}${i}`;
    seen.add(id);
    const members = (p.members || []).slice(0, 12).map((m) => tidyObj({ name: str(m.name, 80).trim(), plusOne: m.plusOne ? true : undefined, eveningOnly: type === "day" && m.eveningOnly ? true : undefined })).filter((m) => m.name);
    return { id, type, members };
  }).filter((p) => p.members.length);
}

export async function onRequest({ request, env, params }) {
  const what = (params.path || []).join("/");
  const method = request.method;
  if (!env.SITE_KV && method !== "GET") return json({ error: "Storage isn't switched on yet (SITE_KV)." }, 503);

  if (what === "content") {
    if (method === "GET") return json(await getContent(env));
    if (method === "PUT") {
      const c = cleanContent(await request.json());
      await env.SITE_KV.put("content", JSON.stringify(c));
      return json({ ok: true, content: c });
    }
  }

  if (what === "passwords") {
    if (method === "GET") return json(await getPasswords(env));
    if (method === "PUT") {
      const b = await request.json();
      const day = str(b.day, 60).trim(), evening = str(b.evening, 60).trim();
      if (day.length < 4 || evening.length < 4) return json({ error: "Passwords need at least 4 characters." }, 400);
      if (day.toLowerCase() === evening.toLowerCase()) return json({ error: "The day and evening passwords must be different." }, 400);
      await env.SITE_KV.put("passwords", JSON.stringify({ day, evening }));
      return json({ ok: true });
    }
  }

  if (what === "guests") {
    if (method === "GET") {
      const saved = env.SITE_KV ? await env.SITE_KV.get("guests", "json") : null;
      return json(Array.isArray(saved) ? saved : GUESTS);
    }
    if (method === "PUT") {
      const g = cleanGuests(await request.json());
      await env.SITE_KV.put("guests", JSON.stringify(g));
      return json({ ok: true, guests: g });
    }
  }

  if (what === "rsvps" && method === "GET") {
    if (!env.SITE_KV) return json([]);
    const out = [];
    let cursor;
    do {
      const page = await env.SITE_KV.list({ prefix: "rsvp:", cursor });
      for (const k of page.keys) { const v = await env.SITE_KV.get(k.name, "json"); if (v) out.push(v); }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && out.length < 1000);
    out.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
    return json(out);
  }

  if (what === "photo" && method === "POST") {
    const type = request.headers.get("Content-Type") || "";
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return json({ error: "Please upload a JPG, PNG or WebP photo." }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) return json({ error: "That photo is too big (5 MB max)." }, 400);
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    await env.SITE_KV.put(`media:${id}`, buf, { metadata: { type } });
    return json({ ok: true, src: `/media/${id}` });
  }

  return json({ error: "Not found" }, 404);
}
