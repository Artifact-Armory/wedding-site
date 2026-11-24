// High scores for the "Callum's canapés" game.
// Only signed-in guests reach this (the password check in _middleware.js runs first).
// Scores are kept in the same Cloudflare storage as the admin panel (SITE_KV).
import { cleanName, isRude } from "../_names.js";

const KEY = "game:scores";
const KEEP = 10;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function load(env) {
  if (!env.SITE_KV) return [];
  const list = await env.SITE_KV.get(KEY, "json");
  return Array.isArray(list) ? list : [];
}

export async function onRequestGet({ env }) {
  return json({ shared: !!env.SITE_KV, scores: await load(env) });
}

export async function onRequestPost({ request, env }) {
  if (!env.SITE_KV) return json({ error: "Scores can't be saved yet" }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  const score = Math.floor(Number(body.score));
  const level = Math.floor(Number(body.level)) || 1;
  // canapés are 10, cake 25, staff 50, doors 100: every real score is a multiple of 5
  if (!Number.isFinite(score) || score <= 0 || score > 100000 || score % 5) return json({ error: "Bad score" }, 400);
  if (isRude(body.name) || isRude(cleanName(body.name))) return json({ error: "rude" }, 400);
  const entry = { name: cleanName(body.name), score, level: Math.min(5, Math.max(1, level)), at: new Date().toISOString() };
  const list = (await load(env)).concat(entry).sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)).slice(0, KEEP);
  await env.SITE_KV.put(KEY, JSON.stringify(list));
  return json({ shared: true, scores: list, rank: list.indexOf(entry) + 1 || null });
}
