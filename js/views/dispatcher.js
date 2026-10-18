// Диспетчер: карта рейсов, планирование (маршрут и транспорт), отклонения от графика, автопарк (D6).
import * as S from "../store.js";
import { icon, esc, badge, stages, orderLink, kg, fmtDT, fmtDate, empty, avatar } from "../ui.js";
import { buttons, bind } from "../actions.js";
import { mapSvg } from "../map.js";
import { kpiCard, rowLinks } from "./client.js";

const rides = () => S.orders().filter((o) => ["in_transit", "delayed"].includes(o.status) || (o.status === "ready" && o.driverId));

export function map([id], user) {
  const list = rides();
  const sel = (id && S.order(id)) || list.find((o) => o.status === "delayed" && !o.delay?.resolved) || list[0];
  const d = sel?.driverId ? S.driver(sel.driverId) : null;
  const html = `<div class="page-head"><div><h1>Карта рейсов</h1><p class="muted">Мониторинг рейсов и контроль отклонений ${stages([14, 18])}</p></div>
    <div class="legend"><span class="lg lg--plan">плановый маршрут</span><span class="lg lg--done">пройдено</span><span class="lg lg--replan">новый маршрут</span></div></div>
  ${!list.length ? empty("Рейсов в пути нет") : `
  <div class="cols cols--map">
    <section class="card card--flush">${mapSvg(list.map((o) => ({ dest: o.destination, progress: o.route?.progress ?? 0, tone: o.status === "delayed" ? "bad" : o.status === "ready" ? "plan" : "ok",
      label: `${S.code(o)}${o.status === "delayed" ? ` · +${S.fmtMin(o.delay?.minutes || 0)}` : ""}`, active: o === sel, replan: o.delay?.resolved })))}</section>
    <div class="stack">
      <section class="card"><h2>${icon("truck")} Рейсы</h2><ul class="rides">${list.map((o) => `<li class="${o === sel ? "is-sel" : ""}"><a href="#/map/${o.id}"><b>${S.code(o)}</b> → ${esc(o.destination)}
        <small>${esc(S.driver(o.driverId)?.plate || "")} · ${o.route?.progress ?? 0} % · ETA ${fmtDT(o.eta)}</small></a>${badge(o.status)}</li>`).join("")}</ul></section>
      ${sel ? `
      ${sel.status === "delayed" ? `<section class="card card--warn"><h2>${icon("alert")} Отклонение от графика: +${S.fmtMin(sel.delay?.minutes || 0)}</h2>
        <p>${esc(sel.delay?.reason || "")}. Прогноз прибытия сдвигается за пределы окна доставки ${esc(sel.window)}.</p>
        ${sel.delay?.resolved ? `<p class="t-ok">${icon("check", 14)} Перепланировано: ${esc(sel.route.variant)}, новый ETA ${fmtDT(sel.eta)}, клиент уведомлён.</p>` : ""}
        <div class="actions">${buttons(sel)}</div></section>` : ""}
      <section class="card"><h2>${icon("users")} Назначение</h2>${d ? `<div class="person">${avatar(d.id === 1 ? S.USERS.find((u) => u.role === "driver") : d, 44)}<div><b>${esc(d.name)}</b>
        <small>${esc(d.vehicle)} · ${esc(d.plate)} · ${kg(sel.weight)}${sel.temperature ? ` · ${sel.temperature}` : ""}</small></div>${badge(sel.status)}</div>` : ""}
        <div class="actions"><a class="btn btn--ghost" href="#/order/${sel.id}">Карточка заказа</a><a class="btn btn--ghost" href="#/doc/waybill/${sel.id}">${icon("file", 16)} Маршрутный лист</a></div></section>` : ""}
    </div>
  </div>`}`;
  return { title: "Карта рейсов", crumbs: ["Мониторинг"], html, mount: bind };
}

export function plan(params, user) {
  const all = S.orders();
  const wait = all.filter((o) => o.status === "ready" && !o.driverId);
  const planned = all.filter((o) => o.status === "ready" && o.driverId);
  const html = `<div class="page-head"><div><h1>Планирование</h1><p class="muted">Построить маршрут и назначить транспорт по типу ТС, грузоподъёмности и режиму ${stages([14])}</p></div></div>
  <section class="card"><h2>${icon("layers")} Ждут назначения транспорта</h2>${wait.length ? `<ul class="tasks">${wait.map((o) => `<li><div>${orderLink(o)} ${badge(o.status)}
    <small>${esc(S.clientOf(o)?.company)} · ${esc(o.destination)}, ${o.distance} км · ${esc(o.transport)} · ${kg(o.weight)}${o.temperature ? ` · ${o.temperature}` : ""} · отгрузка ${fmtDate(o.shipDate)}</small></div>
    <div class="actions">${buttons(o)}</div></li>`).join("")}</ul>` : `<p class="muted">Все готовые грузы распределены по рейсам.</p>`}</section>
  <section class="card"><h2>${icon("route")} Назначены, ждут погрузки</h2>${planned.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Заказ</th><th>Водитель</th><th>Машина</th><th>Куда</th><th></th></tr></thead><tbody>
    ${planned.map((o) => { const d = S.driver(o.driverId); return `<tr data-href="#/order/${o.id}"><td>${orderLink(o)}</td><td>${esc(d.name)}</td><td>${esc(d.vehicle)}, ${esc(d.plate)}</td><td>${esc(o.destination)}</td>
      <td><a class="link" href="#/doc/waybill/${o.id}">Маршрутный лист</a></td></tr>`; }).join("")}</tbody></table></div>` : `<p class="muted">Нет.</p>`}</section>`;
  return { title: "Планирование", crumbs: ["Мониторинг"], html, mount: (r) => { bind(r); rowLinks(r); } };
}

export function incidents(params, user) {
  const all = S.orders().filter((o) => o.delay);
  const open = all.filter((o) => !o.delay.resolved && o.status === "delayed");
  const html = `<div class="page-head"><div><h1>Отклонения от графика</h1><p class="muted">Граничный таймер срабатывает при отставании более 2 часов; рейс продолжается, клиент получает новый ETA ${stages([17, 18])}</p></div></div>
  <div class="kpis">${kpiCard("Открытые инциденты", open.length, open.length ? "требуют перепланирования" : "нет", open.length ? "bad" : "")}${kpiCard("Рейсов в пути", rides().length, "под мониторингом")}</div>
  <section class="card">${all.length ? `<ul class="tasks">${all.map((o) => `<li><div>${orderLink(o)} ${badge(o.status)}<small>+${S.fmtMin(o.delay.minutes)} · ${esc(o.delay.reason)} ·
    ${o.delay.resolved ? `перепланировано: ${esc(o.route?.variant)}, ETA ${fmtDT(o.eta)}` : "ждёт решения"}</small></div><div class="actions">${buttons(o)}<a class="btn btn--ghost" href="#/map/${o.id}">${icon("pin", 16)} На карте</a></div></li>`).join("")}</ul>` : empty("Отклонений нет", "Все рейсы идут по графику")}</section>`;
  return { title: "Отклонения", crumbs: ["Мониторинг"], html, mount: bind };
}

export function drivers(params, user) {
  const all = S.orders();
  const html = `<div class="page-head"><div><h1>Водители и автопарк</h1><p class="muted">${S.DRIVERS.length} машин · подбор по типу ТС и грузоподъёмности</p></div></div>
  <section class="card card--flush"><div class="table-wrap"><table class="table"><thead><tr><th>Водитель</th><th>Тип ТС</th><th>Машина</th><th>Госномер</th><th>Сейчас</th></tr></thead><tbody>
  ${S.DRIVERS.map((d) => { const cur = all.find((o) => o.driverId === d.id && ["ready", "in_transit", "delayed"].includes(o.status));
    return `<tr${cur ? ` data-href="#/map/${cur.id}"` : ""}><td>${esc(d.name)}</td><td>${esc(d.transport)}</td><td>${esc(d.vehicle)}</td><td class="mono">${esc(d.plate)}</td>
      <td>${cur ? `${S.code(cur)} → ${esc(cur.destination)} ${badge(cur.status)}` : `<span class="t-ok">свободен</span>`}</td></tr>`; }).join("")}</tbody></table></div></section>`;
  return { title: "Водители и автопарк", crumbs: ["Мониторинг"], html, mount: rowLinks };
}
