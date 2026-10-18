// Живой рейс для клиента: полоса маршрута, отсчёт до окна доставки, телеметрия рефрижератора, жизненный цикл заказа.
// Телеметрия детерминирована по времени приложения – после перезагрузки и в других ролях показания те же.
import * as S from "./store.js";
import { icon, esc, avatar, kg } from "./ui.js";
import { stopsOn, placeRide } from "./map.js";
import { HUB } from "./pricing.js";

// ------------------------------------------------------------------ телеметрия
const wave = (t, seed) => Math.sin(t / 7.3e5 + seed) * 0.55 + Math.sin(t / 2.1e5 + seed * 2.7) * 0.3 + Math.sin(t / 4.4e4 + seed * 5.1) * 0.15;
export function band(o) {
  const m = /([+-]?\d+)\D+?([+-]?\d+)/.exec(o.temperature || "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}
export function temp(o, t = +S.now()) {
  const b = band(o);
  if (!b) return null;
  return (b[0] + b[1]) / 2 + wave(t, o.id % 97) * ((b[1] - b[0]) / 2) * 0.6;
}
export function speed(o, t = +S.now()) {
  if (o.status === "delayed" && !o.delay?.resolved) return Math.max(0, Math.round(4 + wave(t, o.id) * 5));
  return Math.round(S.AVG_SPEED + 9 + wave(t, o.id + 3) * 14);
}
const gpsAge = (t = +S.now()) => Math.floor(t / 1000) % 30;   // водитель передаёт отметку каждые 30 с

const deg = (v) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")} °C`;
const kmFmt = (v) => `${v.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`;
const pad = (n) => String(n).padStart(2, "0");
export function hms(ms) {
  if (ms <= 0) return "сейчас";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  return `${d ? `${d} д ` : ""}${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}
// начало окна доставки (после перепланирования – новый прогноз)
function deliveryAt(o) {
  if (o.eta !== o.plannedEta) return new Date(o.eta);
  const x = new Date(o.eta);
  const [h, m] = (o.window || "09:00–18:00").split("–")[0].split(":");
  x.setHours(Number(h), Number(m), 0, 0);
  return x;
}

function spark(o) {
  const b = band(o);
  const W = 132, H = 38, n = 31, t = +S.now();
  const vals = Array.from({ length: n }, (_, i) => temp(o, t - (n - 1 - i) * 120000));   // час, отметка раз в 2 мин
  const lo = b[0] - 1, hi = b[1] + 1;
  const y = (v) => (H - ((v - lo) / (hi - lo)) * H).toFixed(1);
  const pts = vals.map((v, i) => `${((i / (n - 1)) * W).toFixed(1)},${y(v)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <rect class="spark__band" x="0" y="${y(b[1])}" width="${W}" height="${(y(b[0]) - y(b[1])).toFixed(1)}"/>
    <polyline points="${pts}"/><circle r="3" cx="${W}" cy="${y(vals.at(-1))}"/></svg>`;
}

// ------------------------------------------------------------------ полоса маршрута
/** Полоса маршрута хаб → город; p – пройдено, % (null – маршрут ещё не начат, например в расчёте заявки). */
export function rail(dest, distance, p = null) {
  const stops = stopsOn(dest);
  const on = p !== null;
  return `<div class="rail${on ? " rail--live" : ""}" style="--p:${on ? p : 100}%">
    <div class="rail__ends"><span>${esc(HUB)}</span><span>${esc(dest)}</span></div>
    <div class="rail__track"><i class="rail__done"></i>
      ${stops.map((s, i) => `<span class="rail__stop${on && s.frac * 100 <= p ? " is-passed" : ""}${i % 2 && s.frac - stops[i - 1].frac < 0.18 ? " is-low" : ""}" style="left:${(s.frac * 100).toFixed(1)}%"><em>${esc(s.name)}</em></span>`).join("")}
      ${on ? `<span class="rail__truck">${icon("truck", 15)}</span>` : ""}</div>
    ${on ? `<div class="rail__scale"><span>0 км</span><span class="rail__km" data-km>${kmFmt((p / 100) * distance)}</span><span>${distance} км</span></div>` : ""}
  </div>`;
}

// ------------------------------------------------------------------ панель «Рейс сейчас»
export function shipPanel(o) {
  const d = o.driverId ? S.driver(o.driverId) : null;
  const du = d && S.USERS.find((u) => u.driverId === d.id);
  const p = S.progress(o);
  const late = o.status === "delayed";
  const t = temp(o);
  return `<section class="ship${late ? " ship--late" : ""}" data-ship="${o.id}" aria-label="Рейс ${S.code(o)} сейчас">
    <header class="ship__head">
      <div><a class="ship__code" href="#/order/${o.id}">${S.code(o)}</a><span class="ship__cargo">${esc(o.cargo)}, ${kg(o.weight)}, ${o.places} мест</span></div>
      <span class="ship__live"><i></i>${late ? (o.delay?.resolved ? "Едет по новому маршруту" : "Задержка в пути") : "В пути"}<small>GPS <b data-gps>${gpsAge()}</b> с назад</small></span>
    </header>
    ${rail(o.destination, o.distance, p)}
    ${late ? `<p class="ship__note">${icon("alert", 15)} ${esc(o.delay?.reason || "Отклонение от графика")}${o.delay?.resolved ? ` – маршрут перепланирован (${esc(o.route?.variant || "")})` : " – диспетчер перепланирует маршрут"}</p>` : ""}
    <dl class="ship__stats">
      <div><dt>${o.eta !== o.plannedEta ? "До прибытия по новому прогнозу" : `До окна доставки ${esc(o.window)}`}</dt><dd class="ship__big" data-until="${deliveryAt(o).toISOString()}">${hms(deliveryAt(o) - S.now())}</dd></div>
      ${t !== null ? `<div><dt>Температура в кузове</dt><dd class="ship__temp"><span class="ship__big" data-temp>${deg(t)}</span><span data-spark>${spark(o)}</span></dd><dd class="ship__sub">норма ${esc(o.temperature)}</dd></div>` : ""}
      <div><dt>Скорость</dt><dd class="ship__big"><span data-speed>${speed(o)}</span> км/ч</dd></div>
      ${d ? `<div class="ship__driver"><dt>Водитель</dt><dd>${avatar(du || { name: d.name }, 40)}<span><b>${esc(d.name)}</b><small>${esc(d.vehicle)}</small><span class="plate">${esc(d.plate)}</span></span></dd></div>` : ""}
    </dl>
  </section>`;
}

// ------------------------------------------------------------------ жизненный цикл заказа (последовательность этапов)
const LIFE = ["Заявка", "Договор", "Оплата", "Склад", "В пути", "Доставлен", "Приёмка"];
const AT = { new: 0, clarify: 0, confirmed: 1, paid: 2, picking: 3, ready: 3, in_transit: 4, delayed: 4, delivered: 5, claim: 6, closed: 7, cancelled: -1 };
export function lifecycle(o, { compact = false } = {}) {
  const cur = AT[o.status] ?? 0;
  if (cur < 0) return compact ? `<span class="life life--off" title="Заказ отменён"></span>` : "";
  const bad = o.status === "delayed" || o.status === "claim";
  const cells = LIFE.map((name, i) => {
    const st = i < cur ? "is-done" : i === cur ? `is-cur${bad ? " is-bad" : ""}` : "";
    return compact ? `<i class="${st}"></i>` : `<li class="${st}"><span></span>${name}</li>`;
  }).join("");
  return compact ? `<span class="life${cur > 6 ? " life--done" : ""}" title="${esc(LIFE[Math.min(cur, 6)])}: ${esc(S.statusText(o.status))}">${cells}</span>` : `<ol class="life-steps" aria-label="Этапы заказа">${cells}</ol>`;
}

// ------------------------------------------------------------------ секундный тикер экрана
/** Обновляет каждую секунду панели рейсов, отсчёты [data-until] и фуры на картах [data-oid]. Останавливается сам, когда экран сменился. */
export function startLive(root) {
  let n = 0;
  const step = () => {
    if (!root.isConnected) return clearInterval(timer);
    const t = S.now();
    root.querySelectorAll("[data-until]").forEach((el) => { el.textContent = hms(new Date(el.dataset.until) - t); });
    root.querySelectorAll("[data-ship]").forEach((el) => {
      const o = S.order(el.dataset.ship);
      if (!o) return;
      const p = S.progress(o, t);
      el.querySelector(".rail")?.style.setProperty("--p", `${p}%`);
      el.querySelectorAll(".rail__stop").forEach((s) => s.classList.toggle("is-passed", parseFloat(s.style.left) <= p));
      const set = (sel, v) => { const x = el.querySelector(sel); if (x) x.textContent = v; };
      set("[data-km]", kmFmt((p / 100) * o.distance));
      set("[data-gps]", gpsAge(+t));
      set("[data-speed]", speed(o, +t));
      const tv = temp(o, +t);
      if (tv !== null) set("[data-temp]", deg(tv));
      if (n % 30 === 0 && tv !== null) { const sp = el.querySelector("[data-spark]"); if (sp) sp.innerHTML = spark(o); }
    });
    root.querySelectorAll(".map__ride[data-oid]").forEach((g) => {
      const o = S.order(g.dataset.oid);
      if (o) placeRide(g, g.dataset.dest, S.progress(o, t));
    });
    n++;
  };
  const timer = setInterval(step, 1000);
  step();
}
