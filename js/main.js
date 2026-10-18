// Оболочка приложения: маршрутизация по хэшу, навигация по ролям, верхняя панель, уведомления, демо-время.
import * as S from "./store.js";
import { icon, esc, avatar, toast, ago } from "./ui.js";
import * as login from "./views/login.js";
import * as common from "./views/common.js";
import * as client from "./views/client.js";
import * as manager from "./views/manager.js";
import * as warehouse from "./views/warehouse.js";
import * as dispatcher from "./views/dispatcher.js";
import * as driver from "./views/driver.js";
import * as analytics from "./views/analytics.js";
import * as docs from "./views/docs.js";

// Навигация по ролям: маршрут, подпись, иконка, этапы BPMN, счётчик
const NAV = {
  client: [
    ["overview", "Обзор", "grid", client.overview],
    ["new", "Новая заявка", "plus", client.newOrder],
    ["orders", "Мои заказы", "package", client.orders, () => S.visibleOrders().filter((o) => S.ACTIVE.includes(o.status) || ["new", "clarify"].includes(o.status)).length],
    ["track", "Трекинг", "pin", client.track],
    ["docs", "Счета и документы", "file", client.documents, () => S.visibleOrders().filter((o) => o.status === "confirmed").length],
    ["claims", "Приёмка и претензии", "alert", client.claims, () => S.visibleOrders().filter((o) => o.status === "delivered").length],
  ],
  manager: [
    ["overview", "Обзор и KPI", "grid", manager.overview],
    ["queue", "Очередь заявок", "inbox", manager.queue, () => S.orders().filter((o) => o.status === "new").length],
    ["contracts", "Договоры и счета", "file", manager.contracts, () => S.orders().filter((o) => o.status === "confirmed").length],
    ["work", "Заказы в работе", "package", manager.work],
    ["claims", "Претензии", "alert", manager.claims, () => S.orders().filter((o) => o.status === "claim").length],
    ["analytics", "Аналитика", "chart", analytics.view],
  ],
  warehouse: [
    ["picking", "Задания на сборку", "scan", warehouse.picking, () => S.orders().filter((o) => ["paid", "picking"].includes(o.status)).length],
    ["shipping", "ТТН и отгрузка", "boxes", warehouse.shipping],
  ],
  dispatcher: [
    ["map", "Карта рейсов", "route", dispatcher.map],
    ["plan", "Планирование", "layers", dispatcher.plan, () => S.orders().filter((o) => o.status === "ready" && !o.driverId).length],
    ["incidents", "Отклонения", "alert", dispatcher.incidents, () => S.orders().filter((o) => o.status === "delayed" && !o.delay?.resolved).length],
    ["drivers", "Водители и автопарк", "users", dispatcher.drivers],
  ],
  driver: [
    ["trip", "Мой рейс", "truck", driver.trip],
    ["trips", "Маршрутные листы", "file", driver.trips],
  ],
};
const COMMON = { order: common.order, process: common.process, notifications: common.notifications, about: common.about, doc: docs.view, more: common.more };

const app = document.getElementById("app");
let current = null;

function parse() {
  const [route, ...params] = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
  return { route: route || "", params };
}

function render() {
  S.tick();
  const user = S.session();
  const { route, params } = parse();
  if (!user) {
    if (route !== "login") return go("#/login");
    document.title = "Вход · ЛогиХаб";
    app.className = "app app--login";
    app.innerHTML = login.render();
    login.mount(app);
    return;
  }
  const nav = NAV[user.role];
  if (!route || route === "login") return go(`#/${nav[0][0]}`);
  const item = nav.find((n) => n[0] === route);
  const view = item?.[3] || COMMON[route];
  if (!view) return go(`#/${nav[0][0]}`);
  let page;
  try {
    page = view(params, user);
  } catch (e) {
    console.error(e);
    page = { title: "Ошибка", html: `<div class="card"><p>Не удалось открыть страницу: ${esc(e.message)}</p></div>` };
  }
  current = { route, params };
  document.title = `${page.title} · ЛогиХаб`;
  const scroll = app.querySelector(".main")?.scrollTop ?? 0;
  const same = app.dataset.route === location.hash;
  app.className = `app app--${user.role}`;
  app.dataset.route = location.hash;
  app.innerHTML = shell(user, nav, route, page);
  page.mount?.(app.querySelector(".content"));
  bindShell(user);
  if (same) app.querySelector(".main").scrollTop = scroll;
}

function shell(user, nav, route, page) {
  const unseen = S.unseen(user);
  const items = nav.map(([r, label, ic, , count]) => {
    const n = count?.() || 0;
    return `<a class="nav__item${r === route ? " is-active" : ""}" href="#/${r}">${icon(ic)}<span>${esc(label)}</span>${n ? `<b class="nav__count">${n}</b>` : ""}</a>`;
  }).join("");
  const crumbs = (page.crumbs || [S.ROLES[user.role].short]).map(esc).join(" / ");
  return `
  <aside class="side">
    <a class="brand" href="#/">${logo()}<span>ЛогиХаб</span></a>
    <nav class="nav" aria-label="Разделы">${items}
      <div class="nav__sep"></div>
      <a class="nav__item${route === "process" ? " is-active" : ""}" href="#/process">${icon("route")}<span>Процесс (BPMN)</span></a>
      <a class="nav__item${route === "about" ? " is-active" : ""}" href="#/about">${icon("book")}<span>О системе</span></a>
    </nav>
    <div class="me">${avatar(user, 38)}<div><b>${esc(user.name)}</b><small>${esc(S.ROLES[user.role].title)}</small></div>
      <button class="icon-btn" data-logout title="Выйти" aria-label="Выйти">${icon("logout")}</button></div>
  </aside>
  <div class="main">
    <header class="top">
      <a class="brand brand--top" href="#/">${logo()}</a>
      <div class="crumbs"><span class="crumbs__pre">${crumbs} / </span><b>${esc(page.title)}</b></div>
      <form class="search" data-search role="search"><span>${icon("search", 16)}</span><input name="q" placeholder="Номер заказа, например LH-15874" aria-label="Поиск заказа" autocomplete="off"></form>
      <button class="icon-btn demo-btn" data-demo title="Демо-время: проверка таймеров процесса" aria-label="Демо-время">${icon("fast")}</button>
      <div class="bell"><button class="icon-btn" data-bell aria-label="Уведомления">${icon("bell")}${unseen ? `<b class="dot">${unseen > 9 ? "9+" : unseen}</b>` : ""}</button></div>
      <a class="me-btn" href="#/more" title="${esc(user.name)} – профиль, смена роли, выход" aria-label="Профиль и выход">${avatar(user, 34)}</a>
    </header>
    <section class="content" id="content">${page.html}</section>
  </div>
  <nav class="tabs" aria-label="Разделы">${nav.slice(0, 4).map(([r, label, ic, , count]) => {
    const n = count?.() || 0;
    return `<a class="tabs__item${r === route ? " is-active" : ""}" href="#/${r}">${icon(ic, 20)}<span>${esc(label.length <= 11 ? label : label.split(" ")[0])}</span>${n ? `<b>${n}</b>` : ""}</a>`;
  }).join("")}<a class="tabs__item${["more", "notifications", "process", "about"].includes(route) ? " is-active" : ""}" href="#/more">${icon("menu", 20)}<span>Ещё</span>${unseen ? "<b></b>" : ""}</a></nav>`;
}

let logoN = 0;
export const logo = () => { const id = `lg${++logoN}`; return `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff7a2f"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#${id})"/><path d="M8 12h11v9H8zM19 15h3.5l2.5 3v3h-6z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="11.5" cy="22.5" r="1.8" fill="#fff"/><circle cx="21.5" cy="22.5" r="1.8" fill="#fff"/></svg>`; };

function bindShell(user) {
  app.querySelector("[data-logout]")?.addEventListener("click", () => { S.logout(); go("#/login"); });
  app.querySelector("[data-search]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get("q").trim();
    const id = (q.match(/\d{3,}/) || [])[0];
    const o = id && S.visibleOrders(user).find((x) => String(x.id) === id || String(x.id).endsWith(id));
    if (o) go(`#/order/${o.id}`); else toast(`Заказ «${q}» не найден среди доступных вам`, "bad");
  });
  app.querySelector("[data-bell]")?.addEventListener("click", (e) => { e.stopPropagation(); toggleBell(user); });
  app.querySelector("[data-demo]")?.addEventListener("click", () => demoPanel());
}

function toggleBell(user) {
  const host = app.querySelector(".bell");
  const open = host.querySelector(".bell__menu");
  if (open) return open.remove();
  const list = S.notesFor(user).slice(0, 8);
  const seen = S.seenAt(user);
  const menu = document.createElement("div");
  menu.className = "bell__menu";
  menu.innerHTML = `<header><b>Уведомления</b><a href="#/notifications">Все</a></header>${list.length ? list.map((n) => `
    <a class="note${n.at > seen ? " is-new" : ""}" href="${n.orderId ? `#/order/${n.orderId}` : "#/notifications"}"><span>${esc(n.text)}</span><small>${ago(n.at, S.now())}</small></a>`).join("") : `<p class="muted pad">Новых событий нет</p>`}`;
  host.append(menu);
  S.markSeen(user);
  host.querySelector(".dot")?.remove();
  const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", close); } };
  setTimeout(() => document.addEventListener("click", close), 0);
}

async function demoPanel() {
  const { modal } = await import("./ui.js");
  const shift = S.clockShift();
  const res = await modal({
    title: "Демо-время",
    ok: "Применить",
    body: `<p class="muted">Таймеры процесса работают от текущего времени: автоматическая отмена неоплаченного заказа через ${S.PAYMENT_DAYS} дня (шлюз 9)
      и напоминание за сутки. Чтобы показать их на защите, время приложения можно сдвинуть вперёд.</p>
      <p>Сейчас в приложении: <b>${S.now().toLocaleString("ru-RU")}</b>${shift ? ` (сдвиг +${Math.round(shift / 3600e3)} ч)` : ""}</p>
      <div class="radio-row">
        <label class="chip-radio"><input type="radio" name="d" value="3" checked><span>+3 часа</span></label>
        <label class="chip-radio"><input type="radio" name="d" value="24"><span>+1 день</span></label>
        <label class="chip-radio"><input type="radio" name="d" value="72"><span>+3 дня</span></label>
        <label class="chip-radio"><input type="radio" name="d" value="reset-clock"><span>Вернуть реальное время</span></label>
        <label class="chip-radio chip-radio--bad"><input type="radio" name="d" value="reset-all"><span>Сбросить демо-данные</span></label>
      </div>`,
  });
  if (!res) return;
  if (res.d === "reset-all") { S.reset(); toast("Демо-данные восстановлены"); go("#/login"); return; }
  if (res.d === "reset-clock") S.shiftClock(-S.clockShift());
  else S.shiftClock(Number(res.d) * 3600e3);
  toast(`Время приложения: ${S.now().toLocaleString("ru-RU")}`);
}

// Кнопка/жест «Назад» в Android-приложении: закрыть окно → на главный экран роли → выход из приложения
window.logihubBack = () => {
  const box = document.querySelector(".modal");
  if (box) { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); return true; }   // модальное окно закрывается как по Esc
  const menu = document.querySelector(".bell__menu");
  if (menu) { menu.remove(); return true; }
  const user = S.session();
  if (!user) return false;
  const home = `#/${NAV[user.role][0][0]}`;
  if (location.hash === home || location.hash === "#/" || location.hash === "") return false;
  location.replace(home);
  return true;
};

export function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

// ------------------------------------------------------------------ запуск
S.init();
S.subscribe(() => { if (current) render(); });
addEventListener("hashchange", render);
setInterval(() => S.tick(), 30000);
render();

if ("serviceWorker" in navigator && location.protocol === "https:" && !navigator.userAgent.includes("LogiHubApp")) {   // в APK файлы и так локальные
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
