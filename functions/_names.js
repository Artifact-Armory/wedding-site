// Scoreboard names: arcade style, and no swearing (silly words like POO or BUM are fine).
// The same check runs in the game (public/game.html) so players get told straight away.

// Squash a name so tricks like "F U C K", "fuuuck", "sh1t" or "f*ck" are still caught
export const squash = (s) => String(s || "").toLowerCase()
  .replace(/[0@4]/g, (c) => ({ 0: "o", "@": "a", 4: "a" })[c]).replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[5$]/g, "s").replace(/7/g, "t").replace(/8/g, "b")
  .replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");

// Blocked anywhere in the name
const ANYWHERE = ["fuck", "fuk", "fck", "fcuk", "phuck", "shit", "cunt", "twat", "bitch", "bastard", "bollock", "arsehole", "asshole", "dickhead",
  "motherf", "slut", "whore", "nigga", "faggot", "retard", "piss", "bellend", "tosser", "dildo", "nazi", "spastic", "wanker"].map(squash);
// Blocked only as a whole word, because they hide inside ordinary names (Hancock, Cumbria, Grape, Swanky...)
const WHOLE = ["cock", "prick", "tit", "tits", "spunk", "cum", "jizz", "slag", "pussy", "fag", "wank", "knobhead", "nob", "minge", "clit", "porn", "sex", "anal",
  "rape", "rapist", "paki", "kike", "chink", "nigger", "spaz"].map(squash);

export function isRude(name) {
  const all = squash(name);
  if (ANYWHERE.some((w) => all.includes(w))) return true;
  const words = String(name || "").split(/[\s'.-]+/).map(squash).filter(Boolean);
  return words.some((w) => WHOLE.includes(w)) || WHOLE.includes(all);
}

export const cleanName = (s) =>
  String(s ?? "").normalize("NFC").toUpperCase().replace(/[^\p{L}\p{N} '.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 12) || "GUEST";
