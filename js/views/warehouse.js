// Кладовщик: задания на сборку – комплектация, маркировка, сверка In Full, ТТН (D5); отгрузка.
import * as S from "../store.js";
import { icon, esc, badge, stages, orderLink, money, kg, fmtDT, fmtDate, ago, empty, toast, modal } from "../ui.js";
import { buttons, bind } from "../actions.js";
import { kpiCard, rowLinks } from "./client.js";

export function picking([id], user) {
  const tasks = S.orders().filter((o) => ["paid", "picking"].includes(o.status));
  const sel = (id && S.order(id)) || tasks.find((o) => o.status === "picking") || tasks[0];
  const html = `
  <div class="page-head"><div><h1>Задания на сборку</h1><p class="muted">Комплектация, маркировка и сверка сканированием ${stages([10, 13])}</p></div>
    <form class="search search--wide" data-scan><span>${icon("scan", 16)}</span><input name="code" placeholder="Отсканируйте штрихкод или введите номер места" autocomplete="off"></form></div>
  ${!tasks.length && !sel ? empty("Заданий на сборку нет", "Оплаченные заказы появятся здесь автоматически") : `
  <div class="cols cols--wide">
    <div class="stack">
      <section class="card card--flush"><div class="tasks-tabs">${tasks.map((o) => `<a class="task-tab${o === sel ? " is-sel" : ""}" href="#/picking/${o.id}"><b>${S.code(o)}</b><small>${esc(S.clientOf(o)?.company)}</small>${badge(o.status)}</a>`).join("")}</div></section>
      ${sel ? sheet(sel) : ""}
    </div>
    ${sel ? side(sel) : ""}
  </div>`}`;
  return { title: "Задания на сборку", crumbs: ["Склад"], html, mount: (r) => mountPicking(r, sel) };
}

function sheet(o) {
  if (o.status === "paid") {
    return `<section class="card"><h2>${icon("scan")} ${S.code(o)} · ${esc(S.clientOf(o)?.company)}</h2>
      <p>Оплата поступила ${fmtDT(o.paidAt)}. Зарезервируйте груз и начните комплектацию: ${o.places} грузовых мест, ${kg(o.weight)}.</p>
      <div class="actions">${buttons(o)}</div></section>`;
  }
  if (o.status !== "picking") return `<section class="card"><p>${S.code(o)}: ${badge(o.status)}</p></section>`;
  const items = o.picking;
  const ok = items.filter((i) => i.ok).length;
  const bad = items.filter((i) => i.missing && i.checked);
  const all = ok === items.length;
  return `<section class="card">
    <div class="row-between"><h2>${icon("scan")} Лист комплектации · ${esc(S.clientOf(o)?.company)}</h2><span class="pill pill--${all ? "ok" : "warn"}">Собрано ${ok} из ${items.length}</span></div>
    <div class="bar"><i style="width:${(ok / items.length) * 100}%"></i></div>
    <div class="table-wrap"><table class="table"><thead><tr><th></th><th>Позиция</th><th>Штрихкод</th><th>Место</th><th></th></tr></thead><tbody>
      ${items.map((i, k) => `<tr class="${i.ok ? "is-ok" : i.missing && i.checked ? "is-bad" : ""}"><td>${i.ok ? `<span class="tick tick--ok">${icon("check", 14)}</span>` : i.missing && i.checked ? `<span class="tick tick--bad">${icon("x", 14)}</span>` : `<span class="tick"></span>`}</td>
        <td>${esc(i.name)}${i.missing && i.checked ? `<small class="t-bad">не найдено в ячейке</small>` : ""}</td><td class="mono">${esc(i.code)}</td><td class="mono">${esc(i.cell)}</td>
        <td>${!i.ok ? `<button class="btn btn--ghost btn--sm" data-scan-item="${k}">${icon("scan", 14)} Сканировать</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
    ${bad.length ? `<div class="note-box note-box--bad">${icon("alert", 16)}<span><b>Груз укомплектован не полностью.</b> Недостаёт ${bad.length} поз. – создано задание на докомплектование из резервной ячейки C-07; отгрузка заблокирована до повторного сканирования (шлюз 11 → этап 12).</span></div>` : ""}
    <div class="actions">
      ${bad.length ? `<button class="btn btn--danger" data-restock>${icon("refresh", 16)} Докомплектовать</button>` : ""}
      ${!all ? `<button class="btn btn--ghost" data-scan-all>${icon("scan", 16)} Сканировать все</button>` : ""}
      <a class="btn btn--ghost" href="#/doc/picklist/${o.id}">${icon("printer", 16)} Печать маркировки</a>
      <button class="btn btn--accent" data-ttn${all ? "" : " disabled"}>${icon("file", 16)} Оформить ТТН и передать к отгрузке</button>
    </div></section>`;
}

function side(o) {
  return `<div class="stack">
    <img class="card-img" src="assets/img/warehouse_scan.jpg" alt="Кладовщик сканирует маркировку грузовых мест">
    <section class="card"><h2>${icon("boxes")} Параметры отгрузки</h2><dl class="kv">
      <dt>Температурный режим</dt><dd>${o.temperature || "не требуется"}</dd><dt>Ворота отгрузки</dt><dd>№ ${o.gate || 3}</dd>
      <dt>Плановая погрузка</dt><dd>${fmtDate(o.shipDate)}, 16:00</dd><dt>Транспорт</dt><dd>${esc(o.transport)}</dd>
      <dt>Груз</dt><dd>${o.places} мест, ${kg(o.weight)}</dd>${o.comment ? `<dt>Особые отметки</dt><dd>${esc(o.comment)}</dd>` : ""}</dl></section>
    <section class="card"><h2>${icon("file")} Документы</h2><ul class="docs">
      <li><a href="#/doc/picklist/${o.id}">${icon("file", 18)}<span><b>Лист комплектации</b><small>формируется автоматически</small></span>${icon("chevron", 16)}</a></li>
      <li class="${o.ttnAt ? "" : "is-off"}"><a href="${o.ttnAt ? `#/doc/ttn/${o.id}` : "javascript:void 0"}">${icon("file", 18)}<span><b>ТТН № ${o.id}</b><small>${o.ttnAt ? fmtDT(o.ttnAt) : "доступна после полной сборки"}</small></span>${icon("chevron", 16)}</a></li></ul></section>
  </div>`;
}

function mountPicking(root, o) {
  bind(root);
  if (!o) return;
  const scanOne = (k) => {
    const res = S.scan(o.id, k);
    toast(res ? `Место отсканировано: ${o.picking[k].name}` : `Не найдено в ячейке ${o.picking[k].cell}: ${o.picking[k].name}`, res ? "ok" : "bad");
  };
  root.querySelectorAll("[data-scan-item]").forEach((b) => b.addEventListener("click", () => scanOne(Number(b.dataset.scanItem))));
  root.querySelector("[data-scan-all]")?.addEventListener("click", () => {
    o.picking.forEach((i, k) => { if (!i.ok) S.scan(o.id, k); });
    const bad = o.picking.filter((i) => i.missing).length;
    toast(bad ? `Сверка завершена: не найдено ${bad} поз. – нужна докомплектация` : "Все места отсканированы – груз укомплектован полностью", bad ? "bad" : "ok");
  });
  root.querySelector("[data-restock]")?.addEventListener("click", () => { S.restock(o.id); toast("Груз докомплектован – отсканируйте места повторно"); });
  root.querySelector("[data-ttn]")?.addEventListener("click", async () => {
    const f = await modal({ title: `ТТН № ${o.id}`, ok: "Оформить ТТН", tone: "accent", body: `
      <p>Груз собран полностью: ${o.places} мест, ${kg(o.weight)}. Передать в зону отгрузки:</p>
      <label class="field"><span>Ворота отгрузки</span><select name="g"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>` });
    if (!f) return;
    try { S.issueTtn(o.id, f.g); toast("ТТН оформлена, груз передан к отгрузке"); location.hash = "#/shipping"; } catch (e) { toast(e.message, "bad"); }
  });
  root.querySelector("[data-scan]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = new FormData(e.target).get("code").trim();
    const k = o.picking?.findIndex((i) => !i.ok && (i.code.includes(v) || i.name.toLowerCase().includes(v.toLowerCase())));
    if (o.status === "picking" && k >= 0 && v) scanOne(k); else toast(`Штрихкод «${v}» не найден в листе ${S.code(o)}`, "bad");
  });
}

export function shipping(params, user) {
  const all = S.orders();
  const ready = all.filter((o) => o.status === "ready");
  const gone = all.filter((o) => o.ttnAt && !["ready"].includes(o.status)).slice(0, 10);
  const html = `<div class="page-head"><div><h1>ТТН и отгрузка</h1><p class="muted">Грузы в зоне отгрузки ждут назначения транспорта диспетчером ${stages([13, 14])}</p></div></div>
  <div class="kpis">${kpiCard("В зоне отгрузки", ready.length, ready.filter((o) => !o.driverId).length + " без транспорта")}${kpiCard("На сборке", all.filter((o) => o.status === "picking").length, "в работе")}
    ${kpiCard("Ждут сборки", all.filter((o) => o.status === "paid").length, "оплачены")}${kpiCard("Отгружено", gone.length, "с ТТН")}</div>
  <section class="card"><h2>${icon("boxes")} Зона отгрузки</h2>${ready.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Заказ</th><th>ТТН</th><th>Куда</th><th>Ворота</th><th>Транспорт</th></tr></thead><tbody>
    ${ready.map((o) => `<tr data-href="#/order/${o.id}"><td>${orderLink(o)}</td><td><a class="link" href="#/doc/ttn/${o.id}">№ ${o.id}</a></td><td>${esc(o.destination)}</td><td>${o.gate || 3}</td>
      <td>${o.driverId ? `${esc(S.driver(o.driverId).plate)} · ${esc(S.driver(o.driverId).name)}` : `<span class="t-warn">ожидает диспетчера</span>`}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Зона отгрузки свободна.</p>`}</section>
  <section class="card"><h2>${icon("truck")} Отгруженные</h2><div class="table-wrap"><table class="table"><thead><tr><th>Заказ</th><th>ТТН</th><th>Оформлена</th><th>Статус</th></tr></thead><tbody>
    ${gone.map((o) => `<tr data-href="#/order/${o.id}"><td>${orderLink(o)}</td><td><a class="link" href="#/doc/ttn/${o.id}">№ ${o.id}</a></td><td>${fmtDT(o.ttnAt)}</td><td>${badge(o.status)}</td></tr>`).join("")}</tbody></table></div></section>`;
  return { title: "ТТН и отгрузка", crumbs: ["Склад"], html, mount: rowLinks };
}
