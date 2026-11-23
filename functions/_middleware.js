// Runs on Cloudflare before any page, photo or data is sent.
// Guests: the day password shows the full site, the evening password the evening site.
// Day-only content is removed here on the server, so it never reaches an evening guest.
// Ellie & Callum: the admin password opens /admin, where everything can be edited.
import { loginPage } from "./_login.js";
import DEFAULT_CONTENT from "./_content.json";

const COOKIE = "ec_guest";
const MAX_AGE = 60 * 60 * 24 * 365;
const ROLES = ["day", "evening", "admin"];

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sign(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
export function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function readRole(request, secret) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [role, exp, sig] = decodeURIComponent(m[1]).split(".");
  if (!ROLES.includes(role) || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  return sameText(sig, await sign(secret, `${role}.${exp}`)) ? role : null;
}
async function cookieFor(role, secret) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const value = `${role}.${exp}.${await sign(secret, `${role}.${exp}`)}`;
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export const tidy = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

export async function getPasswords(env) {
  let day = env.DAY_PASSWORD, evening = env.EVENING_PASSWORD;
  if (env.SITE_KV) {
    const saved = await env.SITE_KV.get("passwords", "json");
    if (saved?.day) day = saved.day;
    if (saved?.evening) evening = saved.evening;
  }
  return { day: tidy(day), evening: tidy(evening) };
}

export async function getContent(env) {
  if (env.SITE_KV) {
    const saved = await env.SITE_KV.get("content", "json");
    if (saved && typeof saved === "object") {
      const rsvp = { ...DEFAULT_CONTENT.rsvp, ...(saved.rsvp || {}) };
      if (!rsvp.menu || !["starters", "mains", "desserts"].some((k) => rsvp.menu[k]?.length)) rsvp.menu = DEFAULT_CONTENT.rsvp.menu;
      if (!Array.isArray(rsvp.wines) || !rsvp.wines.length) rsvp.wines = DEFAULT_CONTENT.rsvp.wines;
      delete rsvp.meals;
      return { ...DEFAULT_CONTENT, ...saved, rsvp };
    }
  }
  return DEFAULT_CONTENT;
}

// Keep only what this guest type should see
export function forRole(content, role) {
  const keep = (x) => !x || typeof x !== "object" || !x.only || x.only === role;
  const clean = (v) => Array.isArray(v) ? v.filter(keep).map(clean)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => keep(x)).map(([k, x]) => [k, clean(x)]))
    : v;
  const out = clean(content);
  if (out.countdownTo) out.countdownTo = { [role]: out.countdownTo[role] || out.countdownTo.day };
  // Evening guests don't choose food or wine
  if (role !== "day" && out.rsvp) out.rsvp = { ...out.rsvp, menu: { starters: [], mains: [], desserts: [] }, wines: [] };
  return out;
}

const html = (body, status = 200, extra = {}) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...extra } });

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const secret = env.SESSION_SECRET;
  if (!secret || !env.DAY_PASSWORD || !env.EVENING_PASSWORD || !env.ADMIN_PASSWORD) {
    return html("<h1>Site not set up</h1><p>The passwords have not been added in the hosting settings yet.</p>", 500);
  }
  const isAdminArea = path === "/admin" || path.startsWith("/admin") || path.startsWith("/api/admin") || path === "/edit.js";

  // Guest sign in
  if (path === "/login" && request.method === "POST") {
    const typed = tidy((await request.formData()).get("password"));
    const pw = await getPasswords(env);
    const role = typed && sameText(typed, pw.day) ? "day" : typed && sameText(typed, pw.evening) ? "evening" : null;
    if (!role) { await new Promise((r) => setTimeout(r, 600)); return html(loginPage({ error: true }), 401); }
    return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": await cookieFor(role, secret), "Cache-Control": "no-store" } });
  }
  // Admin sign in
  if (path === "/admin/login" && request.method === "POST") {
    const typed = ((await request.formData()).get("password") || "").trim();
    if (!typed || !sameText(typed, String(env.ADMIN_PASSWORD).trim())) {
      await new Promise((r) => setTimeout(r, 900));
      return html(loginPage({ error: true, admin: true }), 401);
    }
    return new Response(null, { status: 303, headers: { Location: "/?edit=1", "Set-Cookie": await cookieFor("admin", secret), "Cache-Control": "no-store" } });
  }
  if (path === "/logout") {
    return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  const role = await readRole(request, secret);
  const wantsPage = (request.headers.get("Accept") || "").includes("text/html");

  if (isAdminArea) {
    if (role !== "admin") return wantsPage ? html(loginPage({ admin: true }), 401) : new Response("Admin only", { status: 401 });
    // The admin panel is the real page in edit mode
    if (path === "/admin" || path === "/admin/") return new Response(null, { status: 303, headers: { Location: "/?edit=1" } });
    if (path === "/admin/settings") {
      const res = await env.ASSETS.fetch(new URL("/admin.html", url));
      return new Response(res.body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return next();
  }
  if (path === "/admin.html") return new Response("Not found", { status: 404 });

  if (!role) return wantsPage ? html(loginPage({}), 401) : new Response("Password needed", { status: 401 });

  // Admins see the day site, or the evening site with ?view=evening
  const editing = role === "admin" && url.searchParams.has("edit") && (path === "/" || path === "/index.html");
  const view = role === "admin" ? (url.searchParams.get("view") === "evening" ? "evening" : "day") : role;
  context.data.role = view;
  const res = await next();
  const type = res.headers.get("Content-Type") || "";
  if (!type.includes("text/html")) return res;

  // In edit mode the page gets everything (day and evening items, each labelled)
  const all = await getContent(env);
  const content = editing ? all : forRole(all, view);
  const inject = (obj) => ({ element: (el) => el.setInnerContent(JSON.stringify(obj).replace(/</g, "\\u003c"), { html: true }) });
  let rw = new HTMLRewriter()
    .on("html", { element: (el) => el.setAttribute("data-role", editing ? "edit" : view) })
    .on("[data-only]", { element: (el) => { if (el.getAttribute("data-only") !== view) el.remove(); } })
    .on("script#site-data", inject(content))
    .on("script#rsvp-data", inject(content.rsvp || { menu: {}, wines: [], replyBy: "" }));
  if (editing) {
    rw = rw.on("body", { element: (el) => el.append(`<script src="/edit.js" defer></script>`, { html: true }) });
  } else if (role === "admin") {
    rw = rw.on("body", { element: (el) => el.append(`<a href="/?edit=1" style="position:fixed;right:12px;bottom:12px;z-index:9;background:#5a1630;color:#fff;font:700 14px Georgia,serif;padding:10px 14px;border-radius:999px;text-decoration:none">Viewing as ${view} guest · Edit page</a>`, { html: true }) });
  }
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-store");
  return rw.transform(new Response(res.body, { status: res.status, headers }));
}
