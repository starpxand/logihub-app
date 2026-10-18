// Водитель (мобильный сценарий M1): текущий рейс и маршрутный лист, история рейсов.
import * as S from "../store.js";
import { HUB } from "../pricing.js";
import { icon, esc, badge, stages, orderLink, kg, fmtDT, fmtDate, empty } from "../ui.js";
import { buttons, bind } from "../actions.js";
import { startLive } from "../live.js";
import { mapSvg } from "../map.js";

const ROUTE = {
  "Хабаровск": ["Трасса А-376, Селихино", "Хабаровск, въезд с ул. Промышленной"],
  "Биробиджан": ["Трасса А-376", "Хабаровск, объезд", "Трасса Р-297 «Амур»"],
  "Владивосток": ["Трасса А-376", "Хабаровск", "Трасса А-370 «Уссури»", "Уссурийск"],
  "Благовещенск": ["Трасса А-376", "Хабаровск", "Биробиджан", "Трасса Р-297 «Амур»", "Белогорск"],
  "Южно-Сахалинск": ["Трасса Р-454 до Ванино", "Паром Ванино – Холмск", "Холмск"],
};

export function trip(params, user) {
  const mine = S.visibleOrders(user);
  const o = mine.find((x) => ["in_transit", "delayed"].includes(x.status)) || mine.find((x) => x.status === "ready");
  if (!o) {
    return { title: "Мой рейс", crumbs: ["Водитель"], html: `<div class="page-head"><div><h1>Мой рейс</h1></div></div>${empty("Назначенных рейсов нет", "Диспетчер назначит рейс – он появится здесь, придёт уведомление")}` };
  }
  const d = S.driver(o.driverId);
  const pts = [`Склад ЛогиХаб, ${HUB}`, ...ROUTE[o.destination], `Получатель: ${o.address}`];
  const pos = Math.round((S.progress(o) / 100) * (pts.length - 1));
  const html = `
  <div class="page-head"><div><h1>Рейс ${S.code(o)}</h1><p class="muted">${esc(d.vehicle)} · ${esc(d.plate)} ${stages([15, 16, 19])}</p></div><div>${badge(o.status)}</div></div>
  <div class="driver">
    <section class="card card--flush">${mapSvg([{ id: o.id, dest: o.destination, progress: S.progress(o), tone: o.status === "delayed" ? "bad" : o.status === "ready" ? "plan" : "ok", label: S.code(o), active: true, replan: o.delay?.resolved }], { compact: true })}</section>
    ${o.status === "delayed" ? `<div class="banner banner--bad">${icon("alert", 18)}<span>Отставание +${S.fmtMin(o.delay?.minutes || 0)}: ${esc(o.delay?.reason)}. ${o.delay?.resolved ? `Новый маршрут: ${esc(o.route.variant)}, ETA ${fmtDT(o.eta)}.` : "Диспетчер перепланирует маршрут."}</span></div>` : ""}
    <section class="card"><h2>${icon("route")} Маршрутный лист</h2>
      <ol class="route-list">${pts.map((p, i) => `<li class="${i < pos ? "is-done" : i === pos ? "is-cur" : ""}"><span></span><b>${esc(p)}</b>${i === 0 ? `<small>погрузка ${fmtDate(o.shipDate)}, ворота ${o.gate || 3}</small>` : i === pts.length - 1 ? `<small>окно ${esc(o.window)} · ETA ${fmtDT(o.eta)}</small>` : ""}</li>`).join("")}</ol></section>
    <section class="card"><h2>${icon("package")} Груз</h2><dl class="kv">
      <dt>Клиент</dt><dd>${esc(S.clientOf(o)?.company)}</dd><dt>Груз</dt><dd>${esc(o.cargo)}, ${o.places} мест, ${kg(o.weight)}</dd>
      ${o.temperature ? `<dt>Режим</dt><dd>${icon("thermo", 14)} ${o.temperature}</dd>` : ""}<dt>Получатель</dt><dd>${esc(o.recipient)} · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></dd>
      <dt>Документы</dt><dd><a class="link" href="#/doc/ttn/${o.id}">ТТН № ${o.id}</a> · <a class="link" href="#/doc/waybill/${o.id}">маршрутный лист</a></dd></dl></section>
    <div class="driver__actions">${buttons(o, user)}</div>
  </div>`;
  return { title: `Рейс ${S.code(o)}`, crumbs: ["Водитель"], html, mount: (r) => { bind(r); startLive(r); } };
}

export function trips(params, user) {
  const mine = S.visibleOrders(user);
  const html = `<div class="page-head"><div><h1>Маршрутные листы</h1><p class="muted">Все рейсы водителя</p></div></div>
  <section class="card">${mine.length ? `<ul class="tasks">${mine.map((o) => `<li><div>${orderLink(o)} ${badge(o.status)}<small>${esc(o.destination)} · ${fmtDate(o.shipDate)} · ${kg(o.weight)}</small></div>
    <div class="actions"><a class="btn btn--ghost" href="#/doc/waybill/${o.id}">${icon("file", 16)} Маршрутный лист</a></div></li>`).join("")}</ul>` : empty("Рейсов пока нет")}</section>`;
  return { title: "Маршрутные листы", crumbs: ["Водитель"], html };
}
