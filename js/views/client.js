// Клиент: обзор, новая заявка (D2), мои заказы, трекинг (M2), счета и документы (D4), приёмка и претензии (D7).
import * as S from "../store.js";
import { quote, DESTINATIONS, CARGO, TEMPERATURE, HUB_ADDRESS, PricingError } from "../pricing.js";
import { icon, esc, badge, stages, orderLink, money, kg, fmtDate, fmtDT, left, empty, toast } from "../ui.js";
import { buttons, bind } from "../actions.js";
import { mapSvg } from "../map.js";
import { shipPanel, lifecycle, rail, startLive, hms } from "../live.js";

const mine = () => S.visibleOrders();

// ------------------------------------------------------------------ обзор
export function overview(params, user) {
  const list = mine();
  const k = S.kpi(list);
  const need = list.filter((o) => ["clarify", "confirmed", "delivered"].includes(o.status));
  const moving = list.filter((o) => ["in_transit", "delayed"].includes(o.status));
  const html = `
  <div class="page-head"><div><h1>Добрый день, ${esc(user.name.split(" ")[0])}</h1><p class="muted">${esc(user.company)}, ИНН ${esc(user.inn)}</p></div>
    <div class="actions"><a class="btn btn--accent" href="#/new">${icon("plus", 16)} Новая заявка</a></div></div>
  ${moving.map(shipPanel).join("")}
  <div class="kpis">
    ${kpiCard("Активные заказы", k.active, "в работе у ЛогиХаб")}
    ${kpiCard("Требуют действия", need.length, need.length ? "уточнение, оплата или приёмка" : "всё под контролем", need.length ? "warn" : "")}
    ${kpiCard("Выполнено", k.closed, `из ${k.total} заказов`)}
    ${kpiCard("OTIF ваших поставок", `${k.otif} %`, `в срок ${k.onTime} % · в полном объёме ${k.inFull} %`, "", k.otif)}
  </div>
  <div class="cols">
    <div class="stack">
      ${need.length ? `<section class="card"><h2>${icon("bell")} Нужно ваше действие</h2><ul class="tasks">${need.map((o) => `<li>
        <div>${orderLink(o)} ${badge(o.status)}<small>${o.status === "confirmed" ? `оплатите ${money(o.total)} до ${fmtDT(o.payDeadline)} – иначе заказ отменится автоматически` : o.status === "clarify" ? esc(o.managerComment) : "груз доставлен – подпишите акт или оформите претензию"}</small>
          ${o.status === "confirmed" ? due(o) : ""}</div>
        <div class="actions">${buttons(o)}</div></li>`).join("")}</ul></section>` : ""}
      <section class="card"><h2>${icon("package")} Последние заказы</h2>${table(list.slice(0, 6))}<a class="link small" href="#/orders">Все заказы →</a></section>
    </div>
    <div class="stack">
      <section class="card card--flush"><h2 class="pad">${icon("pin")} Грузы в пути</h2>
        ${mapSvg(moving.map((o) => ({ id: o.id, dest: o.destination, progress: S.progress(o), tone: o.status === "delayed" ? "bad" : "ok", label: S.code(o) })), { compact: true })}
        <ul class="mini pad">${moving.map((o) => `<li><a href="#/track/${o.id}">${S.code(o)} → ${esc(o.destination)}</a><span>прибытие ${fmtDT(o.eta)}</span></li>`).join("") || `<li class="muted">Сейчас грузов в пути нет</li>`}</ul></section>
      <section class="card card--soft"><h2>${icon("info")} Как это работает</h2><ol class="list">
        <li>Оформите заявку – стоимость и срок рассчитаются сразу.</li><li>Менеджер проверит её в течение 30 минут и выставит договор-счёт.</li>
        <li>Оплатите счёт в течение 3 дней – груз уйдёт на склад и в рейс.</li><li>Следите за грузом на карте, примите его и подпишите акт.</li></ol></section>
    </div>
  </div>`;
  return { title: "Обзор", html, mount: (r) => { bind(r); rowLinks(r); startLive(r); } };
}

// срок оплаты: живой отсчёт и доля оставшихся 3 дней
function due(o) {
  const ms = new Date(o.payDeadline) - S.now();
  const share = Math.max(0, Math.min(100, (ms / (S.PAYMENT_DAYS * 864e5)) * 100));
  return `<span class="due${ms < 864e5 ? " due--hot" : ""}"><span class="due__bar"><i style="width:${share.toFixed(1)}%"></i></span><span>до автоотмены <b data-until="${o.payDeadline}">${hms(ms)}</b></span></span>`;
}

export function kpiCard(label, value, sub, tone = "", bar = null) {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}"><span>${esc(label)}</span><b>${value}</b><small>${esc(sub)}</small>${bar !== null ? `<div class="bar"><i style="width:${Math.min(100, bar)}%"></i></div>` : ""}</div>`;
}

export function table(list, { client = false } = {}) {
  if (!list.length) return empty("Заказов пока нет", "Оформите первую заявку – это займёт пару минут");
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Заказ</th>${client ? "<th>Клиент</th>" : ""}<th>Куда</th><th>Груз</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>
  ${list.map((o) => `<tr data-href="#/order/${o.id}"><td>${orderLink(o)}</td>${client ? `<td>${esc(S.clientOf(o)?.company)}</td>` : ""}<td>${esc(o.destination)}</td><td>${esc(o.cargo)}, ${kg(o.weight)}</td><td class="num">${money(o.total)}</td><td><div class="st">${badge(o.status, true)}${lifecycle(o, { compact: true })}</div></td></tr>`).join("")}
  </tbody></table></div>`;
}
export function rowLinks(root) {
  root.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", (e) => { if (!e.target.closest("a, button")) location.hash = tr.dataset.href; }));
}

// ------------------------------------------------------------------ D2 · новая заявка
export function newOrder(params, user) {
  const tomorrow = new Date(S.now()); tomorrow.setDate(tomorrow.getDate() + 1);
  const d = tomorrow.toISOString().slice(0, 10);
  const html = `
  <div class="page-head"><div><h1>Заявка на перевозку</h1><p class="muted">Черновик сохраняется автоматически · ${stages([1, 2, 5, 6])}</p></div>
    <ol class="wizard"><li class="is-cur" data-step-dot="1"><span>1</span>Маршрут</li><li data-step-dot="2"><span>2</span>Груз</li><li data-step-dot="3"><span>3</span>Подтверждение</li></ol></div>
  <form class="cols" data-new novalidate>
    <div class="stack">
      <section class="card" data-step="1">
        <h2>${icon("route")} Маршрут</h2>
        <div class="grid2">
          <label class="field"><span>Откуда</span><span class="input">${icon("boxes", 16)}<input value="${esc(HUB_ADDRESS)}" disabled></span></label>
          <label class="field"><span>Город доставки</span><select name="destination" required>${Object.entries(DESTINATIONS).map(([c, [r, km]]) => `<option value="${c}">${c} · ${r}, ${km} км</option>`).join("")}</select></label>
          <label class="field"><span>Адрес доставки</span><span class="input">${icon("pin", 16)}<input name="address" required placeholder="ул. Промышленная, 12"></span></label>
          <label class="field"><span>Получатель</span><input name="recipient" required placeholder="РЦ «ДальФуд», Хабаровск"></label>
          <label class="field"><span>Телефон ответственного</span><input name="phone" type="tel" required placeholder="+7 914 000-00-00"></label>
          <label class="field"><span>Дата отгрузки</span><input name="shipDate" type="date" required min="${d}" value="${d}"></label>
          <label class="field"><span>Окно доставки</span><select name="window"><option>09:00–13:00</option><option>13:00–18:00</option><option>09:00–18:00</option></select></label>
        </div>
      </section>
      <section class="card" data-step="2">
        <h2>${icon("package")} Груз</h2>
        <div class="field"><span>Категория груза</span><div class="chips">${Object.keys(CARGO).map((c, i) => `<label class="chip-radio"><input type="radio" name="cargo" value="${c}"${i ? "" : " checked"}><span>${c}${TEMPERATURE[c] ? ` ${icon("thermo", 14)}` : ""}</span></label>`).join("")}</div></div>
        <div class="grid3">
          <label class="field"><span>Вес, кг</span><input name="weight" type="number" min="1" max="24000" step="1" required value="3200"></label>
          <label class="field"><span>Объём, м³</span><input name="volume" type="number" min="0" step="0.1" value="14.5"></label>
          <label class="field"><span>Грузовых мест</span><input name="places" type="number" min="1" step="1" required value="24"></label>
          <label class="field"><span>Объявленная стоимость, ₽</span><input name="declared" type="number" min="0" step="1000" value="680000"></label>
          <label class="field field--span2"><span>Комментарий для склада</span><input name="comment" placeholder="Хрупкое, не штабелировать выше 2 ярусов"></label>
        </div>
        <p class="hint" data-temp></p>
      </section>
    </div>
    <div class="stack sticky">
      <section class="card card--dark">
        <h2>${icon("card")} Предварительный расчёт</h2>
        <div class="calc-route" data-route></div>
        <span class="muted">Стоимость перевозки</span><b class="price" data-total>—</b>
        <dl class="kv kv--dark" data-calc></dl>
        <p class="err" data-err hidden></p>
        <button class="btn btn--accent btn--block" type="submit">${icon("send", 16)} Отправить заявку менеджеру</button>
      </section>
      <section class="card card--soft"><h2>${icon("info")} Что дальше?</h2><p class="muted">Менеджер проверит заявку в течение 30 минут. Если данных не хватит – заявка вернётся к вам на уточнение.</p></section>
      <img class="card-img" src="assets/img/truck_reefer.jpg" alt="Рефрижератор ЛогиХаб на трассе">
    </div>
  </form>`;
  return { title: "Новая заявка", crumbs: ["Мои заказы"], html, mount: mountNew };
}

const DRAFT = "logihub-app/draft";
function mountNew(root) {
  const f = root.querySelector("[data-new]");
  try { const dr = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (dr) for (const [k, v] of Object.entries(dr)) { const el = f.elements[k]; if (!el) continue; if (el instanceof RadioNodeList) [...el].forEach((r) => (r.checked = r.value === v)); else if (!el.disabled) el.value = v; } } catch (e) { /* без черновика */ }
  const data = () => {
    const x = Object.fromEntries(new FormData(f));
    return { ...x, weight: Number(x.weight), volume: Number(x.volume), places: Number(x.places), declared: Number(x.declared || 0) };
  };
  const calc = () => {
    const x = data();
    try { localStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(new FormData(f)))); } catch (e) { /* */ }
    const err = root.querySelector("[data-err]");
    root.querySelector("[data-temp]").innerHTML = TEMPERATURE[x.cargo] ? `${icon("thermo", 14)} Требуется температурный режим ${TEMPERATURE[x.cargo]} – будет назначен рефрижератор.` : "";
    try {
      const q = quote(x);
      err.hidden = true;
      tween(root.querySelector("[data-total]"), q.total);
      if (routeFor !== x.destination) {   // маршрут прорисовывается заново только при смене города
        routeFor = x.destination;
        root.querySelector("[data-route]").innerHTML = `${rail(x.destination, q.distance)}<p class="calc-route__eta">${q.distance} км, в пути около ${q.days} дн</p>`;
      }
      root.querySelector("[data-calc]").innerHTML = `
        <dt>Транспорт</dt><dd>${q.transport}${q.temperature ? `, ${q.temperature}` : ""}</dd>
        <dt>Расстояние</dt><dd>${q.distance} км</dd>
        <dt>Тариф за расстояние</dt><dd>${money(q.distanceFee)}</dd>
        <dt>За вес (${kg(q.weight)})</dt><dd>${money(q.weightFee)}</dd>
        <dt>Погрузка и документы</dt><dd>${money(q.baseFee)}</dd>
        <dt>Страхование 0,3 %</dt><dd>${q.insurance ? money(q.insurance) : "—"}</dd>
        <dt>Прогноз доставки</dt><dd>${fmtDate(q.eta)} (${q.days} дн)</dd>`;
      const filled = ["address", "recipient", "phone"].every((k) => x[k]?.trim());
      const done = [filled, filled && x.weight > 0 && x.places > 0];
      const cur = !done[0] ? 1 : !done[1] ? 2 : 3;
      root.querySelectorAll("[data-step-dot]").forEach((li) => {
        const n = Number(li.dataset.stepDot);
        li.classList.toggle("is-done", n < cur);
        li.classList.toggle("is-cur", n === cur);
      });
      return q;
    } catch (e) {
      err.textContent = e instanceof PricingError ? e.message : "Проверьте данные заявки";
      err.hidden = false;
      const tot = root.querySelector("[data-total]");
      tot.textContent = "—"; tot.dataset.v = "";
      return null;
    }
  };
  let routeFor = null;
  f.addEventListener("input", calc);
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!f.reportValidity() || !calc()) return;
    const o = S.createOrder(data());
    try { localStorage.removeItem(DRAFT); } catch (e2) { /* */ }
    toast(`Заявка ${S.code(o)} отправлена менеджеру`);
    location.hash = `#/order/${o.id}`;
  });
  calc();
}

// цена перетекает к новому значению, когда клиент меняет параметры заявки
function tween(el, to) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (!from || from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = money(to); return; }
  const t0 = performance.now();
  const go = (now) => {
    if (el.dataset.v !== String(to)) return;   // уже пересчитано заново
    const k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3);
    el.textContent = money(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(go);
  };
  requestAnimationFrame(go);
}

// ------------------------------------------------------------------ мои заказы
export function orders(params, user) {
  const list = mine();
  const groups = [["Активные", list.filter((o) => !["closed", "cancelled"].includes(o.status))], ["Завершённые", list.filter((o) => ["closed", "cancelled"].includes(o.status))]];
  const html = `<div class="page-head"><div><h1>Мои заказы</h1><p class="muted">${list.length} заказов · нажмите на строку, чтобы открыть карточку</p></div>
    <div class="actions"><a class="btn btn--accent" href="#/new">${icon("plus", 16)} Новая заявка</a></div></div>
    ${groups.map(([t, l]) => `<section class="card"><h2>${t} <span class="muted">${l.length}</span></h2>${table(l)}</section>`).join("")}`;
  return { title: "Мои заказы", html, mount: rowLinks };
}

// ------------------------------------------------------------------ M2 · трекинг
export function track([id], user) {
  const list = mine().filter((o) => ["ready", "in_transit", "delayed", "delivered"].includes(o.status));
  const o = (id && S.order(id)) || list.find((x) => ["in_transit", "delayed"].includes(x.status)) || list[0];
  const live = o && ["in_transit", "delayed"].includes(o.status);
  const d = o?.driverId ? S.driver(o.driverId) : null;
  const html = `<div class="page-head"><div><h1>Трекинг</h1><p class="muted">Положение рейсов передаёт водитель из приложения ${stages([15, 18])}</p></div></div>
  ${!o ? empty("Сейчас нет грузов в пути", "Здесь появится карта, когда заказ уйдёт в рейс") : `
  ${live ? shipPanel(o) : ""}
  <div class="cols cols--map">
    <section class="card card--flush">${mapSvg(list.map((x) => ({ id: x.id, dest: x.destination, progress: S.progress(x), tone: x.status === "delayed" ? "bad" : "ok", label: S.code(x), active: x.id === o.id, replan: x.delay?.resolved })))}</section>
    <div class="stack">
      <section class="card"><div class="row-between"><h2>${S.code(o)}</h2>${badge(o.status)}</div>
        <p class="muted">${esc(o.from.split(",")[0])} → ${esc(o.address)}</p>
        ${live ? "" : `<div class="bar bar--lg"><i style="width:${S.progress(o)}%"></i></div>`}
        <dl class="kv">${live ? "" : `<dt>Пройдено</dt><dd>${Math.round(S.progress(o))} % из ${o.distance} км</dd>`}
          <dt>Прогноз прибытия</dt><dd><b>${fmtDT(o.eta)}</b>${o.eta !== o.plannedEta ? ` <span class="muted">(план ${fmtDate(o.plannedEta)})</span>` : ""}</dd>
          ${live ? "" : d ? `<dt>Водитель</dt><dd>${esc(d.name)}, ${esc(d.vehicle)}, ${esc(d.plate)}</dd>` : "<dt>Транспорт</dt><dd>назначается диспетчером</dd>"}
          <dt>Этап</dt><dd>${lifecycle(o, { compact: true })} ${esc(S.statusText(o.status))}</dd></dl>
        ${o.status === "delayed" && !live ? `<div class="note-box note-box--bad">${icon("alert", 16)}<span>Задержка: ${esc(o.delay?.reason)}. ${o.delay?.resolved ? "Маршрут перепланирован, новый прогноз указан выше." : "Диспетчер перепланирует маршрут."}</span></div>` : ""}
        <div class="actions">${buttons(o)}<a class="btn btn--ghost" href="#/order/${o.id}">Карточка заказа</a></div></section>
      ${list.length > 1 ? `<section class="card"><h2>Другие рейсы</h2><ul class="mini">${list.filter((x) => x !== o).map((x) => `<li><a href="#/track/${x.id}">${S.code(x)} → ${esc(x.destination)}</a>${badge(x.status)}</li>`).join("")}</ul></section>` : ""}
      <section class="card"><h2>${icon("bell")} Уведомления</h2><ul class="mini">${o.history.slice(-4).reverse().map((h) => `<li><span>${esc(h.note)}</span><small>${fmtDT(h.at)}</small></li>`).join("")}</ul></section>
    </div>
  </div>`}`;
  return { title: "Трекинг", html, mount: (r) => { bind(r); startLive(r); } };
}

// ------------------------------------------------------------------ D4 · счета и документы
export function documents(params, user) {
  const list = mine().filter((o) => o.contractAt);
  const pay = list.filter((o) => o.status === "confirmed");
  const html = `<div class="page-head"><div><h1>Счета и документы</h1><p class="muted">Договоры-счета, ТТН, маршрутные листы и акты ${stages([7, 9])}</p></div></div>
  ${pay.map((o) => `<div class="banner banner--warn">${icon("clock", 18)}<span>Оплатите счёт № ${o.id} на <b>${money(o.total)}</b> до ${fmtDT(o.payDeadline)} – осталось ${left(o.payDeadline, S.now())}. Без оплаты заказ будет отменён автоматически.</span>
    <span class="actions">${buttons(o)}</span></div>`).join("")}
  <section class="card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Заказ</th><th>Документы</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>
    ${list.map((o) => `<tr><td>${orderLink(o)}</td><td class="doclinks">${docLinks(o)}</td><td class="num">${money(o.total)}</td><td>${badge(o.status, true)}</td></tr>`).join("")}</tbody></table></div>` : empty("Документов пока нет", "Договор-счёт появится после проверки заявки")}</section>`;
  return { title: "Счета и документы", html, mount: bind };
}
function docLinks(o) {
  const d = [["contract", "Договор-счёт"]];
  if (o.ttnAt) d.push(["ttn", "ТТН"]);
  if (o.actAt) d.push(["act", "Акт"]);
  if (o.claim) d.push(["claim", "Претензия"]);
  return d.map(([k, t]) => `<a class="doc-pill" href="#/doc/${k}/${o.id}">${icon("file", 14)} ${t}</a>`).join("");
}

// ------------------------------------------------------------------ D7 · приёмка и претензии
export function claims(params, user) {
  const list = mine();
  const wait = list.filter((o) => o.status === "delivered");
  const cl = list.filter((o) => o.claim);
  const html = `<div class="page-head"><div><h1>Приёмка и претензии</h1><p class="muted">Проверьте груз: при замечаниях – претензия, без замечаний – акт приёмки ${stages([20, 22])}</p></div></div>
  <section class="card"><h2>${icon("package")} Ожидают приёмки</h2>${wait.length ? `<ul class="tasks">${wait.map((o) => `<li><div>${orderLink(o)} ${badge(o.status)}
    <small>доставлен ${fmtDT(o.deliveredAt)} · ${o.places} мест, ${kg(o.weight)}${o.temperature ? `, режим ${o.temperature}` : ""}</small></div><div class="actions">${buttons(o)}</div></li>`).join("")}</ul>` : `<p class="muted">Все доставленные грузы приняты.</p>`}</section>
  <section class="card"><h2>${icon("alert")} Мои претензии</h2>${cl.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Заказ</th><th>Замечание</th><th>Решение</th><th>Статус</th></tr></thead><tbody>
    ${cl.map((o) => `<tr data-href="#/order/${o.id}"><td>${orderLink(o)}</td><td>${esc(S.CLAIM_KINDS[o.claim.kind])}</td><td>${o.claim.decision ? esc(S.CLAIM_DECISIONS[o.claim.decision]) + (o.claim.compensation ? `, ${money(o.claim.compensation)}` : "") : "на рассмотрении"}</td><td>${badge(o.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="muted">Претензий нет.</p>`}</section>`;
  return { title: "Приёмка и претензии", html, mount: (r) => { bind(r); rowLinks(r); } };
}
