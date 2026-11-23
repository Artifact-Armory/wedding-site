// Sends a reply to the Google Sheet script and explains any problem in plain English.
export async function forward(env, reply) {
  if (!env.RSVP_WEBHOOK_URL || !env.RSVP_WEBHOOK_KEY) {
    return { ok: false, error: "RSVP_WEBHOOK_URL or RSVP_WEBHOOK_KEY is missing in the Cloudflare settings." };
  }
  let res, text;
  try {
    res = await fetch(env.RSVP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: env.RSVP_WEBHOOK_KEY, reply }),
      redirect: "follow",
    });
    text = await res.text();
  } catch (e) {
    return { ok: false, error: `Couldn't reach Google (${e.message}). Check RSVP_WEBHOOK_URL is the full link ending in /exec.` };
  }
  let out;
  try { out = JSON.parse(text); } catch {
    if (res.status === 404) return { ok: false, error: "Google says that link doesn't exist. Check RSVP_WEBHOOK_URL is the latest web app link ending in /exec." };
    return { ok: false, error: `Google sent back a web page instead of an answer (status ${res.status}). Usually the deployment's "Who has access" isn't set to "Anyone", or the script needs authorising again: run testSetup once in the Apps Script editor.` };
  }
  if (out.ok) return { ok: true };
  if (out.error === "bad key") return { ok: false, error: "The secret phrase doesn't match. RSVP_WEBHOOK_KEY in Cloudflare must be exactly the same as SECRET_KEY in the Apps Script." };
  return { ok: false, error: `The Google script hit an error: ${out.error || "unknown"}` };
}
