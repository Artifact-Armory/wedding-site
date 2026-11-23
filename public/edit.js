// Edit mode for Ellie & Callum. Only sent to someone signed in with the admin password.
// Tap any text on the page to change it. Use the small buttons to add, move or remove boxes.
(() => {
  const S = window.SITE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let dirty = false;

  // ---------- styles for edit mode ----------
  document.head.insertAdjacentHTML("beforeend", `<style>
  .ed{outline:2px dashed transparent;outline-offset:3px;border-radius:6px;cursor:text;min-width:1.5em;display:inline-block}
  .ed:hover{outline-color:rgba(204,45,134,.45)}
  .ed:focus{outline:2px solid #cc2d86;background:rgba(255,255,255,.6)}
  .ed:empty::before{content:attr(data-ph);opacity:.45;font-style:italic}
  .edtext{display:block;white-space:pre-wrap;margin-bottom:10px}
  .card.rose .ed:focus,.card[style*="--red"] .ed:focus{background:rgba(255,255,255,.15)}
  .sumx{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:18px 22px 8px;font:800 22px/1.2 var(--serif);color:var(--red)}
  .edmeta{font-size:13px;color:#8a3a5c;margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
  .edmeta svg{width:14px;height:14px}
  .whobadge{display:inline-block;font:700 12px var(--serif);border-radius:999px;padding:2px 10px;background:#f6d3e3;color:#b0202a;margin-left:6px;vertical-align:middle}
  .whobadge.evening{background:#b0202a;color:#fff}
  [data-item]{position:relative}
  .tools{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap;margin:0 0 6px}
  .timeline .tools,.taxis .tools{grid-column:1/-1;margin:0}
  .tools button,.tools select,.addbtn,.ebar button,.ebar a{font:700 13px var(--serif);border:2px solid #f6d3e3;background:#fff;color:#5a1630;border-radius:999px;min-height:34px;padding:0 10px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
  .tools .del{color:#b0202a}
  .addbtn{width:100%;justify-content:center;min-height:46px;border:2px dashed #e86aa8;background:rgba(255,255,255,.7);color:#b0202a;font-size:15px;margin-top:10px}
  .tag.off{opacity:.35;text-decoration:line-through}
  button.tag{border:0;cursor:pointer;font-family:var(--serif)}
  .timeline .dot[data-toggle]{cursor:pointer}
  img[data-photo]{cursor:pointer;outline:3px dashed transparent;outline-offset:-3px}
  img[data-photo]:hover{outline-color:#fff}
  .carousel{-webkit-mask:none!important;mask:none!important;overflow:visible!important}
  .track{animation:none!important;flex-wrap:wrap;width:auto!important;justify-content:center}
  .track figure{width:min(40vw,200px)!important}
  .ebar{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#5a1630;color:#fff;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
  .ebar .msg{font:600 14px var(--serif);flex-basis:100%;text-align:center}
  .ebar .save{background:#cc2d86;border-color:#cc2d86;color:#fff;font-size:16px;min-height:44px;padding:0 22px}
  .ebar .save[disabled]{opacity:.5}
  .etip{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:50;background:#5a1630;color:#fff;font:600 14px var(--serif);padding:10px 16px;border-radius:999px;max-width:92vw;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.2)}
  footer{padding-bottom:140px!important}
  .ehint{font-size:13px;color:#fff;text-align:center;margin:6px 0 0;opacity:.9}
  </style>`);

  // ---------- helpers ----------
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), S);
  const set = (path, v) => { const ks = path.split("."); const last = ks.pop(); const o = ks.reduce((o, k) => o[k], S); o[last] = v; };
  const listOf = (itemPath) => { const ks = itemPath.split("."); const i = +ks.pop(); return { list: get(ks.join(".")), i, listPath: ks.join(".") }; };
  const changed = () => { dirty = true; $("#esave").disabled = false; $("#emsg").textContent = "Unsaved changes"; };
  const tip = (t, ms = 2400) => { const e = $(".etip") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "etip" })); e.textContent = t; e.hidden = false; clearTimeout(tip.t); tip.t = setTimeout(() => (e.hidden = true), ms); };
  const redraw = () => { const y = scrollY; window.renderSite(); decorate(); scrollTo(0, y); };

  const BLANK = {
    timeline: () => ({ time: "", title: "", note: "" }),
    details: () => ({ title: "", text: "" }),
    travel: () => ({ title: "", text: "" }),
    hotels: () => ({ area: "New area", list: [] }),
  };

  // ---------- add controls to everything on the page ----------
  function decorate() {
    $$(".ed").forEach((el) => { el.contentEditable = "plaintext-only"; if (el.contentEditable !== "plaintext-only") el.contentEditable = "true"; el.spellcheck = true; });
    $$("[data-item]").forEach((el) => {
      if (el.querySelector(":scope > .tools")) return;
      const path = el.dataset.item;
      const top = path.split(".")[0];
      const canWho = ["timeline", "details", "travel"].includes(top) && path.split(".").length === 2;
      const item = get(path);
      const t = document.createElement("div");
      t.className = "tools";
      t.innerHTML =
        (canWho ? `<select data-who="${path}" aria-label="Who sees this"><option value="">Everyone</option><option value="day" ${item.only === "day" ? "selected" : ""}>Day only</option><option value="evening" ${item.only === "evening" ? "selected" : ""}>Evening only</option></select>` : "") +
        (/\.(details|travel)\.\d+$/.test("." + path) ? `<button type="button" data-phone="${path}">+ Phone number</button>` : "") +
        `<button type="button" data-move="${path}" data-dir="-1" aria-label="Move up">↑</button><button type="button" data-move="${path}" data-dir="1" aria-label="Move down">↓</button><button type="button" class="del" data-del="${path}">Remove</button>`;
      el.prepend(t);
    });
    const addAfter = (sel, label, fn) => { const el = $(sel); if (!el || el.nextElementSibling?.classList.contains("addbtn")) return; const b = Object.assign(document.createElement("button"), { type: "button", className: "addbtn", textContent: label }); b.onclick = fn; el.after(b); };
    addAfter("#timeline", "+ Add a time", () => { S.timeline.push(BLANK.timeline()); changed(); redraw(); focusLast("#timeline li"); });
    addAfter("#details-list", "+ Add a box", () => { S.details.push(BLANK.details()); changed(); redraw(); focusLast("#details-list > .box"); });
    addAfter("#travel-list", "+ Add a box", () => { S.travel.push(BLANK.travel()); changed(); redraw(); focusLast("#travel-list > .box"); });
    addAfter("#hotel-list", "+ Add an area", () => { S.hotels.push(BLANK.hotels()); changed(); redraw(); focusLast("#hotel-list > .box"); });
    $$("#hotel-list > .box").forEach((d, i) => { const body = d.querySelector(".body"); if (body.querySelector(":scope > .addbtn")) return; const b = Object.assign(document.createElement("button"), { type: "button", className: "addbtn", textContent: "+ Add a hotel" }); b.onclick = () => { const gi = +d.dataset.item.split(".")[1]; S.hotels[gi].list.push({ name: "", sub: "", dist: "", q: "" }); changed(); redraw(); }; body.append(b); });
    const car = $(".carousel");
    if (car && !car.querySelector(".addbtn")) { const lab = document.createElement("label"); lab.className = "addbtn"; lab.innerHTML = '+ Add photos<input type="file" accept="image/*" multiple hidden data-addphoto>'; car.append(lab); car.insertAdjacentHTML("beforeend", '<p class="ehint">Tap a photo to replace it.</p>'); }
  }
  const focusLast = (sel) => { const all = $$(sel); const el = all[all.length - 1]; el?.scrollIntoView({ block: "center" }); el?.querySelector(".ed")?.focus(); };

  // ---------- typing ----------
  document.addEventListener("input", (e) => {
    const el = e.target.closest?.(".ed");
    if (el) { set(el.dataset.path, el.innerText.replace(/ /g, " ").replace(/\n$/, "")); changed(); }
  });
  // keep single-line fields single-line, and stop summary/links reacting while typing
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest?.(".ed");
    if (el && e.key === "Enter" && !el.classList.contains("edtext")) { e.preventDefault(); el.blur(); }
  });
  document.addEventListener("paste", (e) => {
    const el = e.target.closest?.(".ed");
    if (!el) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData.getData("text/plain") || ""));
  });

  // ---------- buttons ----------
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button,[data-toggle],img[data-photo],summary,a");
    if (!t) return;
    if (t.closest(".ebar")) return;
    if (t.matches("a") && t.closest("main")) { e.preventDefault(); return; } // links don't navigate while editing
    if (t.dataset.toggle) { set(t.dataset.toggle, !get(t.dataset.toggle)); changed(); redraw(); return; }
    if (t.dataset.move) { const { list, i } = listOf(t.dataset.move); const n = i + +t.dataset.dir; if (n < 0 || n >= list.length) return; [list[i], list[n]] = [list[n], list[i]]; changed(); redraw(); return; }
    if (t.dataset.del) {
      if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = "Tap again to remove"; setTimeout(() => { if (t.isConnected) { delete t.dataset.sure; t.textContent = "Remove"; } }, 2500); return; }
      const { list, i } = listOf(t.dataset.del); list.splice(i, 1); changed(); redraw(); return;
    }
    if (t.dataset.phone) { const d = get(t.dataset.phone); (d.phones = d.phones || []).push({ name: "", number: "" }); changed(); redraw(); return; }
    if (t.matches("img[data-photo]")) { pickPhoto(t.dataset.photo); return; }
  });
  document.addEventListener("change", (e) => {
    const s = e.target;
    if (s.dataset.who) { const it = get(s.dataset.who); if (s.value) it.only = s.value; else delete it.only; changed(); redraw(); }
    if (s.matches("[data-addphoto]")) uploadMany([...s.files], (src) => S.photos.carousel.push(src));
  });

  // ---------- photos ----------
  const shrink = (f) => new Promise((res, rej) => { const img = new Image(); img.onload = () => { const m = 1600, k = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that photo"))), "image/jpeg", 0.84); }; img.onerror = () => rej(new Error("Couldn't read that photo")); img.src = URL.createObjectURL(f); });
  async function uploadMany(files, put) {
    try {
      for (const f of files) {
        tip("Uploading photo…", 60000);
        const r = await fetch("/api/admin/photo", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: await shrink(f) });
        const d = await r.json(); if (!r.ok) throw new Error(d.error || "Upload failed");
        put(d.src);
      }
      changed(); redraw(); tip("Photo added. Press Save to publish it.");
    } catch (x) { tip(x.message); }
  }
  function pickPhoto(path) {
    const inp = Object.assign(document.createElement("input"), { type: "file", accept: "image/*" });
    inp.onchange = () => uploadMany([...inp.files], (src) => set(path, src));
    inp.click();
  }

  // ---------- bottom bar ----------
  document.body.insertAdjacentHTML("beforeend", `<div class="ebar" role="region" aria-label="Edit mode">
    <span class="msg" id="emsg">Edit mode: tap any text to change it</span>
    <a href="/" target="_blank" rel="noopener">Day view</a>
    <a href="/?view=evening" target="_blank" rel="noopener">Evening view</a>
    <a href="/admin/settings">Settings</a>
    <button type="button" class="save" id="esave" disabled>Save changes</button></div>`);
  $("#esave").onclick = async () => {
    const b = $("#esave"); b.disabled = true; $("#emsg").textContent = "Saving…";
    try {
      const r = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(S) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Couldn't save");
      dirty = false; $("#emsg").textContent = "Saved. It's live for guests now."; tip("Saved");
    } catch (x) { $("#emsg").textContent = x.message; b.disabled = false; }
  };
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // links inside the page shouldn't navigate while editing (the nav menu still works)
  decorate();
  tip("Edit mode: tap any text to change it", 3500);
})();
