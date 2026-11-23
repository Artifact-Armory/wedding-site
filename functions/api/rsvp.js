// RSVP: find a guest's party, and save their reply.
// Day guests only ever see day parties, evening guests only evening parties.
// Replies go to the Google Sheet (via a small Google Apps Script) which also emails you.
import GUESTS from "../_guests.json";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s'-]/g, " ").replace(/['-]/g, "").replace(/\s+/g, " ").trim();

// allow one small typo in longer words (e.g. "Shelia" / "Sheila")
function close(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : Infinity);
  return d[a.length][b.length] <= 1;
}

function matches(query, name) {
  const q = norm(query).split(" ").filter(Boolean), n = norm(name).split(" ").filter(Boolean);
  if (!q.length) return false;
  // single-name guests (nicknames): must type that name
  if (n.length === 1) return q.length === 1 && close(q[0], n[0]);
  // everyone else: first and last name both needed
  if (q.length < 2) return false;
  return close(q[0], n[0]) && close(q[q.length - 1], n[n.length - 1]);
}

async function guestList(env) {
  // The admin panel (step 4) can save an edited guest list; otherwise use the built-in one.
  if (env.SITE_KV) {
    const saved = await env.SITE_KV.get("guests", "json");
    if (Array.isArray(saved)) return saved;
  }
  return GUESTS;
}

const publicParty = (p) => ({ id: p.id, members: p.members.map((m) => ({ name: m.name, plusOne: !!m.plusOne, eveningOnly: !!m.eveningOnly })) });

export async function onRequestGet({ request, env, data }) {
  const role = data.role;
  const q = new URL(request.url).searchParams.get("name") || "";
  if (norm(q).length < 2) return json({ parties: [] });
  const list = (await guestList(env)).filter((p) => p.type === role);
  const found = list.filter((p) => p.members.some((m) => !m.plusOne && matches(q, m.name)));
  await new Promise((r) => setTimeout(r, 250)); // gentle brake on guessing
  return json({ parties: found.slice(0, 3).map(publicParty) });
}

const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

export async function onRequestPost({ request, env, data }) {
  const role = data.role;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Something went wrong. Please try again." }, 400); }

  const list = (await guestList(env)).filter((p) => p.type === role);
  const party = body.partyId ? list.find((p) => p.id === body.partyId) : null;
  const responses = Array.isArray(body.responses) ? body.responses.slice(0, 12) : [];
  if (!responses.length) return json({ error: "Please tell us who is coming." }, 400);

  const rows = [];
  for (const r of responses) {
    let name = clip(r.name, 80);
    if (party) {
      const m = party.members[r.index];
      if (!m) continue;
      name = m.plusOne ? clip(r.plusOneName, 80) || m.name : m.name;
    } else if (!name) continue; // guest wasn't on the list: they typed names themselves
    const attending = r.attending === "yes" ? "Yes" : r.attending === "no" ? "No" : "";
    if (!attending) return json({ error: `Please say whether ${name} can come.` }, 400);
    const eveningOnly = party ? !!party.members[r.index]?.eveningOnly : false;
    rows.push({
      name,
      attending,
      meal: role === "day" && attending === "Yes" && !eveningOnly ? clip(r.meal, 80) : "",
      dietary: attending === "Yes" ? clip(r.dietary, 300) : "",
      eveningOnly,
    });
  }
  if (!rows.length) return json({ error: "Please tell us who is coming." }, 400);

  const reply = {
    receivedAt: new Date().toISOString(),
    guestType: role === "day" ? "Day" : "Evening",
    partyId: party?.id || "not on list",
    partyNames: party ? party.members.map((m) => m.name).join(" / ") : rows.map((r) => r.name).join(" / "),
    onList: !!party,
    rows,
    message: clip(body.message, 1000),
    email: clip(body.email, 120),
  };

  // Keep a backup copy on Cloudflare too, if storage is switched on
  if (env.SITE_KV) {
    await env.SITE_KV.put(`rsvp:${reply.receivedAt}:${reply.partyId}`, JSON.stringify(reply));
  }

  if (!env.RSVP_WEBHOOK_URL || !env.RSVP_WEBHOOK_KEY) {
    return json({ error: "RSVPs aren't switched on yet. Please try again later." }, 503);
  }
  try {
    const res = await fetch(env.RSVP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: env.RSVP_WEBHOOK_KEY, reply }),
      redirect: "follow",
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `status ${res.status}`);
  } catch (e) {
    console.log("RSVP forward failed", e.message);
    if (!env.SITE_KV) return json({ error: "Sorry, we couldn't save that just now. Please try again in a minute." }, 502);
    // saved in backup storage, so the guest doesn't need to retry
  }
  return json({ ok: true });
}
