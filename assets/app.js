const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const NEW_DAYS = 14;

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} の読み込みに失敗しました (${res.status})`);
  return res.json();
}

async function loadData() {
  const [master, sub] = await Promise.all([loadJson("data/master.json"), loadJson("data/subsidies.json")]);
  sub.subsidies.forEach((s) => { s.status = statusOf(s); });
  return { master, subsidies: sub.subsidies };
}

function statusOf(s) {
  if (s.deadline && s.deadline !== "随時" && new Date(s.deadline) < TODAY) return "終了";
  if (s.startDate && new Date(s.startDate) > TODAY) return "公募前";
  return "公募中";
}
const statusClass = (st) => (st === "公募前" ? "pre" : st === "終了" ? "end" : "");
const isNew = (s) => (TODAY - new Date(s.postedAt)) / 86400000 <= NEW_DAYS;
const slash = (d) => d.replace(/-/g, "/");
const dotted = (d) => d.replace(/-/g, ".");
const jpDate = (d) => {
  if (!d || d === "随時") return d || "未設定";
  const [y, m, dd] = d.split("-").map(Number);
  return `${y}年${String(m).padStart(2, "0")}月${String(dd).padStart(2, "0")}日`;
};
function fmtAmount(man) {
  if (man == null) return "未設定";
  if (man >= 10000) return `${(man / 10000).toLocaleString()}億円`;
  return `${man.toLocaleString()}万`;
}
const regionLabel = (s) => [s.prefecture, s.city].filter(Boolean).join(" | ");

function fillPrefCity(master, prefSel, citySel, pref = "", city = "") {
  prefSel.innerHTML = `<option value="">都道府県:すべて</option>` +
    master.prefectures.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  prefSel.value = pref;
  const refresh = (keep) => {
    const cities = master.cities[prefSel.value] || [];
    citySel.innerHTML = `<option value="">区市町村:すべて</option>` +
      cities.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    citySel.disabled = cities.length === 0;
    citySel.value = keep || "";
  };
  prefSel.addEventListener("change", () => refresh(""));
  refresh(city);
}

/* ───────── top page ───────── */
async function initTop() {
  const { master, subsidies } = await loadData();
  fillPrefCity(master, $("#pref"), $("#city"));
  $("#industry").innerHTML = `<option value="">すべて</option>` +
    master.industryGroups.map((g) => `<optgroup label="${esc(g.group)}">${g.items.map((i) => `<option>${esc(i)}</option>`).join("")}</optgroup>`).join("");
  $("#category").innerHTML = `<option value="">すべて</option>` +
    master.categories.map((c) => `<option>${esc(c)}</option>`).join("");

  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    const set = (k, v) => v && p.set(k, v);
    set("pref", $("#pref").value); set("city", $("#city").value);
    set("ind", $("#industry").value); set("cat", $("#category").value);
    set("q", $("#keyword").value.trim());
    location.href = "search.html" + (p.toString() ? "?" + p : "");
  });

  const list = [...subsidies].sort((a, b) => b.postedAt.localeCompare(a.postedAt)).slice(0, 15);
  $("#new-list").innerHTML = list.map((s) => {
    const tag = isNew(s) && s.startDate < s.postedAt ? `<span class="tag new">新着</span>` : `<span class="tag start">公募開始</span>`;
    return `<a class="new-item" href="detail.html?id=${esc(s.id)}">${tag}<span class="date">${dotted(s.postedAt)}</span><span class="t">${esc(s.title)}</span><span class="chev">›</span></a>`;
  }).join("");
}

/* ───────── search page ───────── */
const SEARCH = { page: 1 };

function readQuery(master) {
  const p = new URLSearchParams(location.search);
  const multi = (k, all) => (p.has(k) ? p.get(k).split(",").filter(Boolean) : all);
  const allInd = master.industryGroups.flatMap((g) => g.items);
  return {
    pref: p.get("pref") || "", city: p.get("city") || "", q: p.get("q") || "",
    ind: multi("ind", []), cat: multi("cat", [...master.categories]),
    min: p.get("min") || "", status: multi("st", ["公募中", "公募前"]),
    sort: p.get("sort") || "new", per: Number(p.get("per")) || 10, allInd,
  };
}

function checkList(container, groups, selected, name) {
  container.innerHTML = groups.map((g) =>
    (g.group ? `<div class="grp">${esc(g.group)}</div>` : "") +
    g.items.map((i) => `<label><input type="checkbox" name="${name}" value="${esc(i)}"${selected.includes(i) ? " checked" : ""}>${esc(i)}</label>`).join("")
  ).join("");
}
const checked = (name) => $$(`input[name="${name}"]:checked`).map((e) => e.value);

function matches(s, f, master) {
  if (f.pref && s.prefecture !== "全国" && s.prefecture !== f.pref) return false;
  if (f.city && s.city && s.city !== f.city) return false;
  if (f.ind.length && s.industries.length && !s.industries.some((i) => f.ind.includes(i))) return false;
  if (f.cat.length < master.categories.length && !s.categories.some((c) => f.cat.includes(c))) return false;
  if (f.min && (s.maxAmount ?? 0) < Number(f.min)) return false;
  if (f.status.length && !f.status.includes(s.status)) return false;
  if (f.q) {
    const hay = [s.title, s.summary, s.agency, s.purpose, s.content, s.prefecture, s.city, ...s.categories, ...s.industries].join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function sortList(list, key) {
  const dl = (s) => (s.deadline === "随時" ? "9999-12-31" : s.deadline);
  const by = {
    new: (a, b) => b.postedAt.localeCompare(a.postedAt),
    amount: (a, b) => (b.maxAmount ?? -1) - (a.maxAmount ?? -1),
    deadline: (a, b) => dl(a).localeCompare(dl(b)),
  }[key] || (() => 0);
  return list.sort(by);
}

function cardHtml(s) {
  return `<article class="card">
    <div class="card-head">
      <span class="status ${statusClass(s.status)}">${esc(s.status)}</span>${isNew(s) ? `<span class="new-mark">NEW</span>` : ""}
      <a class="title" href="detail.html?id=${esc(s.id)}">${esc(s.title)}</a>
      <span class="posted">掲載日：${slash(s.postedAt)}</span>
    </div>
    <div class="card-body">
      <div class="stats">
        <div class="stat amt"><span class="k">上限金額</span><span class="v">${esc(fmtAmount(s.maxAmount))}</span></div>
        <div class="stat"><span class="k">申請期限</span><span class="v">${esc(jpDate(s.deadline))}</span></div>
      </div>
      <p class="desc">${esc(s.summary)}</p>
      <div class="chips">
        <span class="chip">📍 ${esc(regionLabel(s))}</span>
        <span class="chip">🏛 ${esc(s.agency)}</span>
        <span class="chip">公募開始:${esc(slash(s.startDate))}～</span>
      </div>
    </div>
  </article>`;
}

function renderResults(ctx) {
  const { master, subsidies } = ctx;
  const f = collectFilters(master);
  const hits = sortList(subsidies.filter((s) => matches(s, f, master)), f.sort);
  const pages = Math.max(1, Math.ceil(hits.length / f.per));
  SEARCH.page = Math.min(SEARCH.page, pages);
  const slice = hits.slice((SEARCH.page - 1) * f.per, SEARCH.page * f.per);

  $("#count").textContent = hits.length;
  $("#results").innerHTML = slice.length ? slice.map(cardHtml).join("") :
    `<div class="empty">条件に一致する補助金が見つかりませんでした。<br>条件を変更してもう一度お試しください。</div>`;

  const btn = (n, label, dis, cur) => `<button data-p="${n}"${dis ? " disabled" : ""}${cur ? ' class="cur"' : ""}>${label}</button>`;
  let html = btn(SEARCH.page - 1, "‹", SEARCH.page === 1);
  for (let i = 1; i <= pages; i++) html += btn(i, i, false, i === SEARCH.page);
  html += btn(SEARCH.page + 1, "›", SEARCH.page === pages);
  $("#pager").innerHTML = pages > 1 ? html : "";
}

function collectFilters(master) {
  return {
    pref: $("#pref").value, city: $("#city").value, q: $("#keyword").value.trim(),
    ind: checked("ind"), cat: checked("cat"), status: checked("st"),
    min: $("#min").value.trim(), sort: $("#sort").value, per: Number($("#per").value),
  };
}

function syncUrl(master) {
  const f = collectFilters(master);
  const p = new URLSearchParams();
  if (f.pref) p.set("pref", f.pref);
  if (f.city) p.set("city", f.city);
  if (f.q) p.set("q", f.q);
  if (f.ind.length) p.set("ind", f.ind.join(","));
  if (f.cat.length !== master.categories.length) p.set("cat", f.cat.join(","));
  if (f.min) p.set("min", f.min);
  p.set("st", f.status.join(","));
  history.replaceState(null, "", "?" + p);
}

async function initSearch() {
  const ctx = await loadData();
  const { master } = ctx;
  const f = readQuery(master);
  fillPrefCity(master, $("#pref"), $("#city"), f.pref, f.city);
  checkList($("#ind-list"), master.industryGroups, f.ind, "ind");
  checkList($("#cat-list"), [{ items: master.categories }], f.cat, "cat");
  checkList($("#st-list"), [{ items: ["公募中", "公募前", "終了"] }], f.status, "st");
  $("#keyword").value = f.q; $("#min").value = f.min; $("#sort").value = f.sort; $("#per").value = String(f.per);

  const run = (resetPage = true) => { if (resetPage) SEARCH.page = 1; syncUrl(master); renderResults(ctx); };
  $("#filter-form").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  $("#sort").addEventListener("change", () => run());
  $("#per").addEventListener("change", () => run());
  $("#reset").addEventListener("click", () => {
    $("#pref").value = ""; $("#pref").dispatchEvent(new Event("change"));
    $("#keyword").value = ""; $("#min").value = "";
    $$("input[name=ind]").forEach((e) => (e.checked = false));
    $$("input[name=cat]").forEach((e) => (e.checked = true));
    $$("input[name=st]").forEach((e) => (e.checked = e.value !== "終了"));
    run();
  });
  $$("[data-all]").forEach((b) => b.addEventListener("click", () => {
    $$(`input[name="${b.dataset.all}"]`).forEach((e) => (e.checked = b.dataset.on === "1"));
  }));
  $("#pager").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-p]");
    if (!b || b.disabled) return;
    SEARCH.page = Number(b.dataset.p);
    renderResults(ctx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  renderResults(ctx);
}

/* ───────── detail page ───────── */
async function initDetail() {
  const { subsidies } = await loadData();
  const id = new URLSearchParams(location.search).get("id");
  const s = subsidies.find((x) => x.id === id);
  const root = $("#detail");
  if (!s) { root.innerHTML = `<div class="empty">補助金が見つかりませんでした。<br><a href="search.html">検索結果に戻る</a></div>`; return; }
  document.title = `${s.title} | 補助金ポータル（サンプル）`;
  $("#crumb-title").textContent = s.title;

  const yen = s.maxAmount == null ? "未設定" : `${(s.maxAmount * 10000).toLocaleString()}円（${s.maxAmount.toLocaleString()}万円）`;
  const sections = [
    ["purpose", "目的", `<p>${esc(s.purpose)}</p>`],
    ["schedule", "申請スケジュール", `<table class="sched">${s.schedule.map((x) => `<tr><th>${esc(x.label)}</th><td>${esc(jpDate(x.date))}</td></tr>`).join("")}</table>`],
    ["target", "対象となる事業", `<p>${esc(s.targetBusiness)}</p>`],
    ["content", "補助内容", `<p class="big-amount">最大 ${esc(yen)}</p><p>補助率：${esc(s.subsidyRate)}</p><p>${esc(s.content)}</p>`],
    ["who", "対象者の詳細", `<ul>${s.targetDetail.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`],
    ["site", "公式サイト", `<p><a class="btn-link" href="${esc(s.officialUrl)}" target="_blank" rel="noopener noreferrer">公式サイトを開く</a></p>`],
    ["contact", "お問合せ窓口", `<p>${esc(s.contact.name)}<br>TEL：${esc(s.contact.tel)}</p>`],
  ];
  root.innerHTML = `
    <div class="detail-head">
      <div class="meta"><span class="status ${statusClass(s.status)}">${esc(s.status)}</span>掲載日：${slash(s.postedAt)}</div>
      <h1>${esc(s.title)}</h1>
      <button class="btn-print" onclick="window.print()">🖨 印刷</button>
    </div>
    <div class="detail-body">
      <nav class="toc"><div class="toc-in"><h2>☰ ページ内メニュー</h2>${sections.map(([k, t]) => `<a href="#${k}">${t}</a>`).join("")}</div></nav>
      <div class="main">
        <div class="top">
          <div class="stat amt"><span class="k">上限金額</span><span class="v">${esc(fmtAmount(s.maxAmount))}</span></div>
          <div class="stat"><span class="k">申請期限</span><span class="v">${esc(jpDate(s.deadline))}</span></div>
          <span class="chip">📍 ${esc(s.prefecture)}</span><span class="chip">🏛 ${esc(s.agency)}</span><span class="chip">公募開始:${esc(slash(s.startDate))}～</span>
        </div>
        <p class="note">※募集期間内であっても、募集を締め切っている場合があります。</p>
        ${sections.map(([k, t, body]) => `<h2 id="${k}">${t}</h2>${body}`).join("")}
      </div>
    </div>`;
}

const page = document.body.dataset.page;
const init = { top: initTop, search: initSearch, detail: initDetail }[page];
init?.().catch((err) => {
  const target = $("main") || document.body;
  target.insertAdjacentHTML("afterbegin", `<div class="wrap"><div class="empty">${esc(err.message)}<br>HTTPサーバー経由で開いてください（例: python3 -m http.server）。</div></div>`);
});
