// Аналитика – интеграция дашборда: KPI, OTIF, выручка, регионы, затраты, релизы (по выгрузке logihub-dashboard)
// плюс OTIF живых заказов приложения (этап 25 «Закрыть заказ и пересчитать OTIF»).
import * as S from "../store.js";
import { icon, esc, stages, money, countUp } from "../ui.js";
import { lines, bars, hbars, donut, fmtN } from "../charts.js";
import { kpiCard } from "./client.js";

const C = { blue: "#2f5bea", orange: "#ff8a3d", green: "#1f9d62", navy: "#0b1b3f", gray: "#9aa6bd", red: "#e5484d" };
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
let cache = null;

export function view(params, user) {
  const live = S.kpi();
  const html = `
  <div class="page-head"><div><h1>Аналитика</h1><p class="muted">Дашборд ЛогиХаб: выгрузка заказов 2024–2026 гг. и живые заказы приложения ${stages([25])}</p></div>
    <div class="actions"><div class="seg" role="tablist" data-period>
      <button data-y="all" class="is-on">Весь период</button><button data-y="2024">2024</button><button data-y="2025">2025</button><button data-y="2026">2026</button></div>
      <a class="btn btn--ghost" href="https://github.com/starpxand/logihub-dashboard" target="_blank" rel="noopener">${icon("chart", 16)} Дашборд на Dash</a></div></div>
  <div data-dash><div class="kpis">${[1, 2, 3, 4].map(() => `<div class="kpi kpi--skel"></div>`).join("")}</div></div>
  <section class="card"><h2>${icon("refresh")} Живые заказы приложения</h2>
    <div class="kpis kpis--inline">${kpiCard("Закрыто заказов", live.closed, `из ${live.total}`)}${kpiCard("OTIF", `${live.otif} %`, "пересчитывается при закрытии заказа", live.otif >= 90 ? "" : "warn", live.otif)}
      ${kpiCard("On Time", `${live.onTime} %`, "доставлено в срок", "", live.onTime)}${kpiCard("In Full", `${live.inFull} %`, "в полном объёме", "", live.inFull)}</div></section>`;
  return { title: "Аналитика", crumbs: ["Отчёты"], html, mount };
}

async function mount(root) {
  const host = root.querySelector("[data-dash]");
  try {
    cache ??= await (await fetch("data/analytics.json")).json();
  } catch (e) {
    host.innerHTML = `<div class="card"><p>Не удалось загрузить выгрузку дашборда.</p></div>`;
    return;
  }
  const draw = (y) => {
    host.innerHTML = dashboard(cache, y);
    host.classList.remove("draw"); void host.offsetWidth; host.classList.add("draw");
    countUp(host);
  };
  root.querySelectorAll("[data-period] button").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("[data-period] button").forEach((x) => x.classList.toggle("is-on", x === b));
    draw(b.dataset.y);
  }));
  draw("all");
}

function sum(rows) {
  const t = rows.reduce((a, r) => ({ orders: a.orders + r.orders, cancelled: a.cancelled + r.cancelled, revenue: a.revenue + r.revenue, profit: a.profit + r.profit, cost: a.cost + r.cost,
    otif: a.otif + r.otif * r.orders, on_time: a.on_time + r.on_time * r.orders, in_full: a.in_full + r.in_full * r.orders }),
  { orders: 0, cancelled: 0, revenue: 0, profit: 0, cost: 0, otif: 0, on_time: 0, in_full: 0 });
  const n = t.orders || 1;
  return { ...t, otif: t.otif / n, on_time: t.on_time / n, in_full: t.in_full / n };
}

function dashboard(d, y) {
  const months = d.months.filter((m) => y === "all" || m.month.startsWith(y));
  const t = sum(months);
  const lbl = months.map((m) => `${MONTHS[Number(m.month.slice(5)) - 1]} ${m.month.slice(2, 4)}`);
  const otifOk = t.otif >= d.otif_target;
  return `
  <div class="kpis">
    ${kpiCard("Заказов выполнено", t.orders.toLocaleString("ru-RU"), `отменено ${t.cancelled} (${((t.cancelled / (t.orders + t.cancelled)) * 100).toFixed(1).replace(".", ",")} %)`)}
    ${kpiCard("Выручка", `${fmtN(t.revenue)} ₽`, `прибыль ${fmtN(t.profit)} ₽`)}
    ${kpiCard("Рентабельность", `${((t.profit / t.revenue) * 100).toFixed(1).replace(".", ",")} %`, `затраты ${fmtN(t.cost)} ₽`)}
    ${kpiCard("OTIF", `${t.otif.toFixed(1).replace(".", ",")} %`, `цель ${d.otif_target} % · в срок ${t.on_time.toFixed(1).replace(".", ",")} %, в полном объёме ${t.in_full.toFixed(1).replace(".", ",")} %`, otifOk ? "" : "warn", t.otif)}
  </div>
  <div class="cols cols--2">
    <section class="card"><h2>${icon("chart")} OTIF по месяцам</h2>
      ${lines({ labels: lbl, unit: " %", target: d.otif_target, series: [
        { name: "OTIF", values: months.map((m) => m.otif), color: C.orange },
        { name: "On Time", values: months.map((m) => m.on_time), color: C.blue, dash: "4 4" },
        { name: "In Full", values: months.map((m) => m.in_full), color: C.green, dash: "2 4" }] })}
      <div class="chart-legend"><span style="--c:${C.orange}">OTIF</span><span style="--c:${C.blue}">On Time</span><span style="--c:${C.green}">In Full</span></div></section>
    <section class="card"><h2>${icon("chart")} Выручка и прибыль</h2>
      ${bars({ labels: lbl, series: [{ name: "Выручка", values: months.map((m) => m.revenue), color: C.blue }, { name: "Прибыль", values: months.map((m) => m.profit), color: C.orange }] })}
      <div class="chart-legend"><span style="--c:${C.blue}">Выручка, ₽</span><span style="--c:${C.orange}">Прибыль, ₽</span></div></section>
  </div>
  <div class="cols cols--3">
    <section class="card"><h2>${icon("pin")} Регионы по выручке</h2>${hbars({ items: d.regions.map((r) => ({ name: r.name, value: r.revenue })), unit: " ₽" })}</section>
    <section class="card"><h2>${icon("card")} Структура затрат</h2>${donut({ items: d.costs, colors: [C.navy, C.blue, C.orange, C.gray, C.red], label: "₽ затрат" })}</section>
    <section class="card"><h2>${icon("layers")} OTIF по релизам платформы</h2>${hbars({ items: d.releases.map((r) => ({ name: r.name, value: r.otif, color: r.otif >= d.otif_target ? C.green : C.orange })), unit: " %", fmt: (v) => v.toFixed(1).replace(".", ",") })}
      <p class="muted small">Каждый релиз автоматизирует новые этапы процесса: v2.0 – Telegram-боты и это приложение.</p></section>
  </div>
  <section class="card"><h2>${icon("truck")} По типам транспорта</h2><div class="table-wrap"><table class="table"><thead><tr><th>Транспорт</th><th>Заказов</th><th>Выручка</th><th>Прибыль</th><th>OTIF</th></tr></thead><tbody>
    ${d.transport.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.orders.toLocaleString("ru-RU")}</td><td class="num">${money(r.revenue)}</td><td class="num">${money(r.profit)}</td><td class="num ${r.otif >= d.otif_target ? "t-ok" : "t-warn"}">${String(r.otif).replace(".", ",")} %</td></tr>`).join("")}
  </tbody></table></div><p class="muted small">Источник: ${esc(d.source)} · ${d.total_rows.toLocaleString("ru-RU")} заказов, ${d.period.map((p) => p.split("-").reverse().join(".")).join(" – ")}. Отменённые заказы в KPI не входят – как в дашборде.</p></section>`;
}
