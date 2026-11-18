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
  const points = [`Склад ЛогиХаб, ${HUB}`, ...(ROUTE[o.destination] || []), `Получатель: ${o.address || o.destination}`];
  const progress = S.progress(o);
  const pos = Math.round((progress / 100) * (points.length - 1));
  const controls = buttons(o, user);
  const rides = [{ id: o.id, dest: o.destination, progress, tone: o.status === "delayed" ? "bad" : o.status === "ready" ? "plan" : "ok", active: true, replan: o.delay?.resolved }];
  const html = `
  <article class="driver">
    <header class="driver__hero">
      <div class="driver__id"><h1>Рейс ${S.code(o)}</h1>${badge(o.status)}</div>
      <p class="driver__direction"><span>${HUB}</span><span aria-hidden="true">→</span><span>${esc(o.destination)}</span></p>
      <div class="driver__vehicle">${icon("truck", 17)}<span>${esc(d?.vehicle)}</span>${d?.plate ? `<span class="driver__plate">${esc(d.plate)}</span>` : ""} ${stages([15, 16, 19])}</div>
    </header>
    ${o.status === "delayed" ? `<aside class="driver__incident banner banner--bad">${icon("alert", 19)}<span><strong>Задержка +${S.fmtMin(o.delay?.minutes || 0)}</strong> · ${esc(o.delay?.reason || "Отклонение от графика")}. ${o.delay?.resolved ? `Новый маршрут: ${esc(o.route?.variant)}. Прибытие: ${fmtDT(o.eta)}.` : "Диспетчер перепланирует маршрут."}</span></aside>` : ""}
    <div class="driver__layout">
      <section class="card card--flush driver__map">
        <div class="driver__section-head"><h2>${icon("pin", 19)} Карта маршрута</h2><span>Схема рейса</span></div>
        ${mapSvg(rides, { focus: o.destination })}
        <div class="driver__progress">
          <div><span>Пройдено</span><strong data-driver-km>${Math.round(o.distance * progress / 100).toLocaleString("ru-RU")} из ${o.distance.toLocaleString("ru-RU")} км</strong></div>
          <progress data-driver-progress="${o.id}" value="${progress}" max="100" aria-label="Пройденная часть маршрута"></progress>
        </div>
      </section>

      <section class="card driver__arrival">
        <div class="driver__section-head"><h2>${icon("clock", 19)} Прибытие</h2></div>
        <p class="driver__eta">${fmtDT(o.eta)}</p>
        ${o.window ? `<p class="driver__window">Окно доставки <strong>${esc(o.window)}</strong></p>` : ""}
        ${o.route?.at && o.status !== "ready" ? `<p class="driver__gps">Последняя отметка <time datetime="${esc(o.route.at)}">${fmtDT(o.route.at)}</time></p>` : ""}
        ${controls ? `<div class="driver__actions" role="group" aria-label="Действия по рейсу">${controls}</div>` : ""}
      </section>

      <section class="card driver__route">
        <div class="driver__section-head"><h2>${icon("route", 19)} Маршрутный лист</h2><span>${points.length} точки</span></div>
        <ol class="route-list" data-driver-stops>${points.map((point, i) => `<li class="${i < pos ? "is-done" : i === pos ? "is-cur" : ""}"${i === pos ? ' aria-current="step"' : ""}><span aria-hidden="true"></span><b>${esc(point)}</b>${i === 0 ? `<small>Погрузка ${fmtDate(o.shipDate)} · ворота ${o.gate || 3}</small>` : ""}</li>`).join("")}</ol>
      </section>

      <section class="card driver__cargo">
        <div class="driver__section-head"><h2>${icon("package", 19)} Груз и документы</h2></div>
        <p class="driver__cargo-name">${esc(o.cargo)} <span>${o.places} мест · ${kg(o.weight)}</span></p>
        <dl class="driver__details">
          <dt>Клиент</dt><dd>${esc(S.clientOf(o)?.company)}</dd>
          ${o.temperature ? `<dt>Режим</dt><dd>${icon("thermo", 15)} ${esc(o.temperature)}</dd>` : ""}
          <dt>Получатель</dt><dd>${esc(o.recipient)}${o.phone ? `<br><a class="link" href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : ""}</dd>
        </dl>
        <div class="driver__docs">
          <a class="btn btn--ghost" href="#/doc/ttn/${o.id}">${icon("file", 16)} ТТН № ${o.id}</a>
          <a class="btn btn--ghost" href="#/doc/waybill/${o.id}">${icon("file", 16)} Маршрутный лист</a>
        </div>
      </section>
    </div>
  </article>`;
  return { title: `Рейс ${S.code(o)}`, crumbs: ["Водитель"], html, mount: (r) => { bind(r); startLive(r); } };
}

export function trips(params, user) {
  const mine = S.visibleOrders(user);
  const html = `<div class="page-head"><div><h1>Маршрутные листы</h1><p class="muted">Все рейсы водителя</p></div></div>
  <section class="card">${mine.length ? `<ul class="tasks">${mine.map((o) => `<li><div>${orderLink(o)} ${badge(o.status)}<small>${esc(o.destination)} · ${fmtDate(o.shipDate)} · ${kg(o.weight)}</small></div>
    <div class="actions"><a class="btn btn--ghost" href="#/doc/waybill/${o.id}">${icon("file", 16)} Маршрутный лист</a></div></li>`).join("")}</ul>` : empty("Рейсов пока нет")}</section>`;
  return { title: "Маршрутные листы", crumbs: ["Водитель"], html };
}
