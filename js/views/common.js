// Общие страницы: карточка заказа, процесс BPMN, уведомления, о системе.
import * as S from "../store.js";
import { icon, esc, badge, stages, money, kg, fmtDT, fmtDate, ago, left, avatar, empty } from "../ui.js";
import { buttons, bind } from "../actions.js";
import { mapSvg } from "../map.js";
import { shipPanel, lifecycle, startLive } from "../live.js";

const WHO = { client: "Клиент", manager: "Менеджер", warehouse: "Склад", dispatcher: "Диспетчер", driver: "Водитель", system: "Система" };

// ------------------------------------------------------------------ карточка заказа
export function order([id], user) {
  const o = S.order(id);
  if (!o || !S.visibleOrders(user).includes(o)) return { title: "Заказ не найден", html: empty("Заказ не найден или недоступен вашей роли") };
  const c = S.clientOf(o);
  const d = o.driverId ? S.driver(o.driverId) : null;
  const acts = buttons(o, user);
  const docs = documents(o);
  const moving = ["in_transit", "delayed", "delivered"].includes(o.status) || (o.status === "ready" && o.driverId);
  const live = ["in_transit", "delayed"].includes(o.status);
  const html = `
  <div class="page-head">
    <div><a class="back" href="javascript:history.back()">${icon("back", 16)} Назад</a>
      <h1>${S.code(o)} <small>${esc(o.from.split(",")[0])} → ${esc(o.destination)}</small></h1>
      <div class="row">${badge(o.status)} ${stages(S.stageOf(o))} <span class="muted">создан ${fmtDT(o.createdAt)}</span></div></div>
    <div class="actions">${acts || ""}</div>
  </div>
  ${lifecycle(o)}
  ${live ? shipPanel(o) : ""}
  ${o.status === "confirmed" ? `<div class="banner banner--warn">${icon("clock", 18)}<span>Оплатите счёт до <b>${fmtDT(o.payDeadline)}</b> – осталось ${left(o.payDeadline, S.now())}. Без оплаты заказ будет отменён автоматически (шлюз 9).</span></div>` : ""}
  ${o.status === "clarify" ? `<div class="banner banner--warn">${icon("info", 18)}<span>Комментарий менеджера: <b>${esc(o.managerComment)}</b></span></div>` : ""}
  ${o.status === "delayed" && !live ? `<div class="banner banner--bad">${icon("alert", 18)}<span>Отклонение от графика: +${S.fmtMin(o.delay?.minutes || 0)} – ${esc(o.delay?.reason || "")}. ${o.delay?.resolved ? `Маршрут перепланирован: ${esc(o.route?.variant)}, новый ETA ${fmtDT(o.eta)}.` : "Ожидает перепланирования диспетчером."}</span></div>` : ""}
  <div class="cols">
    <div class="stack">
      <section class="card">
        <h2>${icon("route")} Маршрут и груз</h2>
        <dl class="kv">
          <dt>Откуда</dt><dd>${esc(o.from)}</dd>
          <dt>Куда</dt><dd>${esc(o.address)}</dd>
          <dt>Получатель</dt><dd>${esc(o.recipient)}${o.phone ? ` · ${esc(o.phone)}` : ""}</dd>
          <dt>Клиент</dt><dd>${esc(c?.company)} · ${esc(c?.name)}</dd>
          <dt>Груз</dt><dd>${esc(o.cargo)}, ${kg(o.weight)}, ${o.places} мест${o.volume ? `, ${o.volume} м³` : ""}</dd>
          <dt>Режим</dt><dd>${o.temperature ? `${icon("thermo", 14)} ${o.temperature}` : "без температурного режима"}</dd>
          <dt>Транспорт</dt><dd>${esc(o.transport)}${d ? ` · ${esc(d.vehicle)}, ${esc(d.plate)} · водитель ${esc(d.name)}` : ""}</dd>
          <dt>Отгрузка</dt><dd>${fmtDate(o.shipDate)}</dd>
          <dt>Доставка</dt><dd>план ${fmtDate(o.plannedEta)}, окно ${esc(o.window)}${o.eta !== o.plannedEta ? ` · прогноз ${fmtDT(o.eta)}` : ""}${o.deliveredAt ? ` · факт ${fmtDT(o.deliveredAt)}` : ""}</dd>
          ${o.comment ? `<dt>Комментарий</dt><dd>${esc(o.comment)}</dd>` : ""}
        </dl>
      </section>
      ${moving ? `<section class="card card--flush"><h2 class="pad">${icon("pin")} Трекинг</h2>${mapSvg([{ id: o.id, dest: o.destination, progress: S.progress(o), tone: o.status === "delayed" ? "bad" : "ok", label: o.status === "delivered" ? "доставлен" : S.code(o), active: true, replan: o.delay?.resolved }], { compact: true })}</section>` : ""}
      ${o.picking ? picking(o) : ""}
      ${o.claim ? claim(o) : ""}
      <section class="card">
        <h2>${icon("clock")} История заказа</h2>
        <ol class="timeline">${o.history.slice().reverse().map((h) => `
          <li class="tl tl--${S.STATUSES[h.status]?.tone || "muted"}"><span class="tl__dot"></span>
            <div><b>${esc(h.note)}</b><small>${fmtDT(h.at)} · ${WHO[h.by] || h.by} · ${esc(S.statusText(h.status))}</small></div></li>`).join("")}</ol>
      </section>
    </div>
    <div class="stack">
      <section class="card card--dark">
        <h2>${icon("card")} Стоимость</h2>
        <b class="price">${money(o.total)}</b>
        <dl class="kv kv--dark">
          <dt>Перевозка</dt><dd>${money(o.price)}</dd>
          <dt>Страхование</dt><dd>${o.insurance ? money(o.insurance) : "—"}</dd>
          <dt>Расстояние</dt><dd>${o.distance} км</dd>
          <dt>Оплата</dt><dd>${o.paidAt ? `${fmtDate(o.paidAt)}, ${esc(o.payMethod)}` : o.status === "confirmed" ? `до ${fmtDT(o.payDeadline)}` : "—"}</dd>
          ${o.status === "closed" ? `<dt>OTIF</dt><dd>${o.otif ? "✓ в срок и в полном объёме" : `✗ ${!o.onTime ? "не в срок" : ""}${!o.onTime && !o.inFull ? ", " : ""}${!o.inFull ? "не в полном объёме" : ""}`}</dd>` : ""}
          ${o.rating ? `<dt>Оценка</dt><dd>${"★".repeat(o.rating)}${"☆".repeat(5 - o.rating)}</dd>` : ""}
        </dl>
      </section>
      ${progress(o)}
      <section class="card">
        <h2>${icon("file")} Документы</h2>
        ${docs.length ? `<ul class="docs">${docs.map(([k, t, sub]) => `<li><a href="#/doc/${k}/${o.id}">${icon("file", 18)}<span><b>${t}</b><small>${sub}</small></span>${icon("chevron", 16)}</a></li>`).join("")}</ul>` : `<p class="muted">Документы появятся после проверки заявки менеджером.</p>`}
      </section>
      <section class="card card--soft">
        <h2>${icon("telegram")} Telegram</h2>
        <p class="muted">Статус заказа доступен и в Telegram-боте: команда <code>/status ${S.code(o)}</code>.</p>
        <a class="btn btn--ghost btn--block" href="https://t.me/${user.role === "client" ? "logihub_logistics_bot" : "logihub_manager_bot"}" target="_blank" rel="noopener">${icon("telegram", 16)} Открыть бота</a>
      </section>
    </div>
  </div>`;
  return { title: S.code(o), crumbs: ["Заказы"], html, mount: (r) => { bind(r); startLive(r); } };
}

export function documents(o) {
  const out = [];
  if (o.contractAt) out.push(["contract", `Договор-счёт № ${o.id}`, `${money(o.total)} · ${fmtDate(o.contractAt)}`]);
  if (o.picking) out.push(["picklist", "Лист комплектации", `${o.picking.filter((i) => i.ok).length} из ${o.picking.length} позиций`]);
  if (o.ttnAt) out.push(["ttn", `ТТН № ${o.id}`, fmtDate(o.ttnAt)]);
  if (o.driverId && o.route) out.push(["waybill", "Маршрутный лист", `${S.driver(o.driverId).plate}`]);
  if (o.actAt) out.push(["act", "Акт приёмки", fmtDate(o.actAt)]);
  if (o.claim) out.push(["claim", "Претензия и решение", o.claim.decision ? S.CLAIM_DECISIONS[o.claim.decision] : "на рассмотрении"]);
  return out;
}

function picking(o) {
  const done = o.picking.filter((i) => i.ok).length;
  return `<section class="card"><h2>${icon("scan")} Комплектация <span class="muted">${done} из ${o.picking.length}</span></h2>
    <div class="bar"><i style="width:${(done / o.picking.length) * 100}%"></i></div>
    <ul class="checks">${o.picking.map((i) => `<li class="${i.ok ? "is-ok" : i.missing && i.checked ? "is-bad" : ""}">${icon(i.ok ? "check" : i.missing && i.checked ? "x" : "package", 16)}<span>${esc(i.name)}</span><small class="mono">${esc(i.code)} · ${esc(i.cell)}</small></li>`).join("")}</ul></section>`;
}

function claim(o) {
  const c = o.claim;
  return `<section class="card card--bad"><h2>${icon("alert")} Претензия: ${esc(S.CLAIM_KINDS[c.kind])}</h2>
    <blockquote class="quote">${esc(c.text)}</blockquote>
    ${c.photos?.length ? `<div class="photos">${c.photos.map((p) => `<img src="${p}" alt="Фото к претензии">`).join("")}</div>` : ""}
    ${c.decision ? `<p><b>Решение:</b> ${esc(S.CLAIM_DECISIONS[c.decision])}${c.compensation ? `, компенсация ${money(c.compensation)}` : ""}. ${esc(c.answer || "")}</p>` : `<p class="muted">Подано ${fmtDT(c.createdAt)} – на рассмотрении у менеджера.</p>`}</section>`;
}

function progress(o) {
  const cur = S.stageOf(o);
  const max = Math.max(...cur);
  const key = [[2, "Заявка"], [7, "Договор-счёт"], [9, "Оплата"], [13, "Склад и ТТН"], [15, "Рейс"], [19, "Доставка"], [22, "Приёмка"], [26, "Выполнен"]];
  return `<section class="card"><h2>${icon("layers")} Этапы процесса</h2><ol class="steps">${key.map(([n, t]) => {
    const st = o.status === "cancelled" ? (n <= 9 ? "is-off" : "is-off") : n < Math.min(...cur) ? "is-done" : n <= max ? "is-cur" : "";
    return `<li class="${st}"><span>${n < Math.min(...cur) && o.status !== "cancelled" ? icon("check", 12) : ""}</span><b>${t}</b><small>BPMN ${n}</small></li>`;
  }).join("")}</ol><a class="link small" href="#/process?o=${o.id}">Вся модель процесса →</a></section>`;
}

// ------------------------------------------------------------------ процесс BPMN
const LANES = { client: "Клиент", manager: "Менеджер", warehouse: "Склад", dispatcher: "Диспетчер / система", driver: "Водитель", system: "Система (сервисы)" };
export function process(params, user) {
  const oid = Number((location.hash.split("o=")[1] || "").split("&")[0]);
  const o = oid ? S.order(oid) : null;
  const cur = o ? S.stageOf(o) : [];
  const counts = {};
  S.visibleOrders(user).forEach((x) => S.stageOf(x).forEach((n) => (counts[n] = (counts[n] || 0) + 1)));
  const html = `
  <div class="page-head"><div><h1>Процесс управления логистикой</h1>
    <p class="muted">BPMN-модель из wiki продукта: 26 этапов, 5 участников. ${o ? `Подсвечен текущий этап заказа <b>${S.code(o)}</b>.` : "Число – сколько ваших заказов сейчас на этапе."}</p></div>
    <div class="actions"><a class="btn btn--ghost" href="https://starpxand.github.io/logihub-wiki/process/" target="_blank" rel="noopener">${icon("book", 16)} Модель в wiki</a></div></div>
  <div class="lanes">${Object.entries(LANES).map(([role, title]) => {
    const st = S.BPMN.filter((b) => b[2] === role || (role === "dispatcher" && b[2] === "dispatcher"));
    if (!st.length) return "";
    return `<section class="lane${role === user.role ? " is-mine" : ""}"><h3>${title}</h3><div class="lane__row">${st.map(([n, t, , kind]) =>
      `<div class="bp bp--${kind || "task"}${cur.includes(n) ? " is-cur" : ""}"><span>${n}</span><b>${esc(t)}</b>${counts[n] && !o ? `<em>${counts[n]}</em>` : ""}</div>`).join("")}</div></section>`;
  }).join("")}</div>
  <section class="card"><h2>${icon("info")} Как экраны приложения покрывают процесс</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th>Экран (макет ЛР4)</th><th>Роль</th><th>Этапы BPMN</th></tr></thead><tbody>
    ${[["D1 · Вход в систему", "все роли", "точка входа"], ["D2 · Новая заявка", "Клиент", "1–2, 5–6"], ["D3 · Очередь заявок, договор-счёт", "Менеджер", "3–4, 6–7, 9"],
      ["D4 · Согласование и оплата счёта", "Клиент", "7–9"], ["D5 · Комплектация, маркировка, ТТН", "Кладовщик", "10–13"], ["D6 · Маршрутизация и отклонения", "Диспетчер", "14, 16–18"],
      ["M1 · Маршрутный лист", "Водитель", "15–16, 19"], ["M2 · Трекинг и уведомления", "Клиент", "15–18"], ["D7 · Приёмка, акт или претензия", "Клиент", "20–22"],
      ["D8 · Претензии, закрытие, OTIF", "Менеджер", "23–26"]].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="mono">${r[2]}</td></tr>`).join("")}
    </tbody></table></div></section>`;
  return { title: "Процесс (BPMN)", crumbs: ["Справка"], html };
}

// ------------------------------------------------------------------ уведомления
export function notifications(params, user) {
  const list = S.notesFor(user);
  const seen = S.seenAt(user);
  const html = `<div class="page-head"><div><h1>Уведомления</h1><p class="muted">События по заказам, которые касаются вашей роли.</p></div>
    <div class="actions"><a class="btn btn--ghost" href="#/process">${icon("route", 16)} Процесс</a><a class="btn btn--ghost" href="#/about">${icon("book", 16)} О системе</a></div></div>
  <section class="card">${list.length ? `<ul class="notes">${list.map((n) => `<li class="${n.at > seen ? "is-new" : ""}"><a href="${n.orderId ? `#/order/${n.orderId}` : "#/"}">${icon("bell", 16)}<span>${esc(n.text)}</span><small>${ago(n.at, S.now())}</small></a></li>`).join("")}</ul>` : empty("Событий пока нет")}</section>`;
  return { title: "Уведомления", html, mount: () => S.markSeen(user) };
}

// ------------------------------------------------------------------ о системе
export function about(params, user) {
  const html = `
  <div class="page-head"><div><h1>О системе «ЛогиХаб»</h1><p class="muted">Веб-приложение платформы управления логистикой: заявка, договор-счёт, склад, рейс, приёмка и OTIF – в одном окне.</p></div></div>
  <div class="grid-cards">
    ${[["book", "Wiki продукта", "Описание, роли, BPMN-модель и требования", "https://starpxand.github.io/logihub-wiki/"],
      ["chart", "Дашборд", "Plotly Dash: KPI, OTIF, выручка и затраты", "https://github.com/starpxand/logihub-dashboard"],
      ["telegram", "Бот для клиентов", "@logihub_logistics_bot – заявки и статусы", "https://t.me/logihub_logistics_bot"],
      ["telegram", "Бот для сотрудников", "@logihub_manager_bot – очередь, склад, рейсы", "https://t.me/logihub_manager_bot"],
      ["layers", "UX/UI-макет", "10 экранов, по которым сделано приложение", "https://github.com/starpxand/logihub-design"],
      ["file", "Исходный код", "github.com/starpxand/logihub-app", "https://github.com/starpxand/logihub-app"]].map(([ic, t, s, href]) =>
      `<a class="tile" href="${href}" target="_blank" rel="noopener">${icon(ic, 22)}<b>${t}</b><small>${s}</small></a>`).join("")}
  </div>
  <section class="card"><h2>${icon("info")} Как устроено</h2>
    <ul class="list">
      <li>Статусы заказа и допустимые переходы – те же, что в Telegram-боте; каждому статусу соответствуют этапы BPMN-модели.</li>
      <li>Стоимость и срок доставки (этап 6) считаются по единой тарифной модели бота и дашборда: расстояние × тариф ТС × коэффициент груза + вес + оформление.</li>
      <li>Таймер оплаты (шлюз 9): неоплаченный за 3 дня заказ отменяется автоматически; таймер отклонения от графика (событие 17) – при отставании более 2 часов.</li>
      <li>При закрытии заказа фиксируются On Time и In Full, OTIF пересчитывается (этап 25); аналитика за 2024–2026 годы – по выгрузке дашборда.</li>
      <li>Работает офлайн как PWA и как Android-приложение; данные демо-режима хранятся в браузере устройства.</li>
    </ul></section>
  <section class="card card--soft"><p>Учебный проект по дисциплине «Современные программные средства», ФКТ ФГБОУ ВО «КнАГУ», 2026. Разработчик – Попов А.С., группа 5ИТб-2.</p></section>`;
  return { title: "О системе", crumbs: ["Справка"], html };
}

// ------------------------------------------------------------------ «Ещё»: профиль, смена роли, выход, справка (главное меню на телефоне)
export function more(params, user) {
  const unseen = S.unseen(user);
  const html = `
  <section class="card profile">${avatar(user, 56)}<div><b>${esc(user.name)}</b><span>${esc(S.ROLES[user.role].title)}</span><small>${esc(user.company)} · ${esc(user.email)}</small></div></section>
  <section class="card card--flush"><ul class="menu">
    <li><a href="#/notifications">${icon("bell", 20)}<span>Уведомления</span>${unseen ? `<b class="nav__count">${unseen}</b>` : ""}${icon("chevron", 16)}</a></li>
    <li><a href="#/process">${icon("route", 20)}<span>Процесс (BPMN)</span>${icon("chevron", 16)}</a></li>
    <li><a href="#/about">${icon("book", 20)}<span>О системе</span>${icon("chevron", 16)}</a></li>
    <li><button type="button" data-demo-more>${icon("fast", 20)}<span>Демо-время</span>${icon("chevron", 16)}</button></li>
  </ul></section>
  <section class="card"><h2>${icon("users")} Сменить роль</h2><div class="roles">${S.USERS.filter((u) => u.id !== user.id).map((u) => `
    <button type="button" class="role" data-switch="${u.id}">${avatar(u, 40)}<span><b>${esc(S.ROLES[u.role].title)}</b><small>${esc(u.name)}</small></span>${icon("chevron", 16)}</button>`).join("")}</div></section>
  <button type="button" class="btn btn--danger btn--block btn--lg" data-logout-more>${icon("logout", 18)} Выйти</button>`;
  return { title: "Ещё", html, mount: (root) => {
    root.querySelectorAll("[data-switch]").forEach((b) => b.addEventListener("click", () => { S.login(b.dataset.switch); location.replace("#/"); }));
    root.querySelector("[data-logout-more]").addEventListener("click", () => { S.logout(); location.replace("#/login"); });
    root.querySelector("[data-demo-more]").addEventListener("click", () => document.querySelector("[data-demo]")?.click());
  } };
}
