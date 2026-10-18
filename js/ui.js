// Общие элементы интерфейса: иконки (в стиле Lucide, как в макете), экранирование, тосты, модальные окна, бейджи.
import { STATUSES, statusText, code, money } from "./store.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  boxes: '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85M7 16.5l5-3M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3M17 16.5l4.74-2.85M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15M12 8l4.74-2.85M12 13.5V8"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  nav: '<path d="m3 11 19-9-9 19-2-8-8-2z"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  bank: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l9 5H3z"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  thermo: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  telegram: '<path d="m22 3-20 8 7 2 2 7 4-5 5 4z"/><path d="m9 13 6-5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  fast: '<path d="M13 19 22 12 13 5v14zM2 19l9-7-9-7v14z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
};
export const icon = (name, size = 18, cls = "") =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

export const badge = (status, short = false) => `<span class="badge badge--${STATUSES[status]?.tone || "muted"}" title="${esc(statusText(status))}">${esc(short ? STATUSES[status]?.short || statusText(status) : statusText(status))}</span>`;
export const stages = (list) => list?.length ? `<span class="bpmn-chip" title="Этапы BPMN-модели «Процесс управления логистикой»">BPMN ${list.length > 1 ? `${list[0]}–${list.at(-1)}` : list[0]}</span>` : "";
export const orderLink = (o) => `<a class="mono link" href="#/order/${o.id}">${code(o)}</a>`;
export const kg = (w) => (w >= 1000 ? `${(w / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} т` : `${w} кг`);
export { money };

export function avatar(user, size = 36) {
  if (user?.avatar) return `<img class="avatar" src="${user.avatar}" width="${size}" height="${size}" alt="">`;
  const ini = (user?.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2);
  return `<span class="avatar avatar--ini" style="width:${size}px;height:${size}px">${esc(ini)}</span>`;
}

export function empty(text, sub = "") {
  return `<div class="empty"><img src="assets/img/empty_parcels.jpg" alt="" width="160" height="107"><p>${esc(text)}</p>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
}

// ------------------------------------------------------------------ тосты
export function toast(text, tone = "ok") {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast toast--${tone}`;
  el.setAttribute("role", "status");
  el.innerHTML = `${icon(tone === "bad" ? "alert" : "check", 18)}<span>${esc(text)}</span>`;
  host.append(el);
  setTimeout(() => el.classList.add("is-out"), 3600);
  setTimeout(() => el.remove(), 4000);
}

// ------------------------------------------------------------------ модальное окно (возвращает Promise с данными формы или null)
export function modal({ title, body, ok = "Сохранить", tone = "primary", wide = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<form class="modal__box${wide ? " modal__box--wide" : ""}" novalidate>
      <header class="modal__head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Закрыть">${icon("x")}</button></header>
      <div class="modal__body">${body}</div>
      <footer class="modal__foot"><button type="button" class="btn btn--ghost" data-close>Отмена</button>
        <button type="submit" class="btn btn--${tone}">${esc(ok)}</button></footer></form>`;
    document.body.append(wrap);
    const form = wrap.querySelector("form");
    const close = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => e.key === "Escape" && close(null);
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) close(null); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      close({ ...Object.fromEntries(fd), _form: fd });
    });
    requestAnimationFrame(() => (form.querySelector("input, select, textarea, button[type=submit]"))?.focus());
  });
}

export const fmtDate = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
export const fmtDT = (d) => new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export function ago(d, nowD) {
  const m = Math.round((nowD - new Date(d)) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} ч назад`;
  return fmtDate(d);
}
export function left(deadline, nowD) {
  const ms = new Date(deadline) - nowD;
  if (ms <= 0) return "срок истёк";
  const h = Math.floor(ms / 3600e3), d = Math.floor(h / 24);
  return d ? `${d} дн ${h % 24} ч` : `${h} ч ${Math.floor(ms / 60000) % 60} мин`;
}

/** Числа в элементах [data-count] (и в .kpi b, .price) отсчитываются от нуля – формат (пробелы, запятая, единицы) сохраняется. */
export function countUp(root, sel = "[data-count], .kpi b, .price") {
  if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll(sel).forEach((el) => {
    const text = el.textContent;
    const m = text.match(/\d+(?:[\s  ]\d{3})*(?:[.,]\d+)?/);
    if (!m) return;
    const raw = m[0];
    const dec = (raw.match(/[.,](\d+)$/) || [, ""])[1].length;
    const sep = raw.includes(".") ? "." : ",";
    const target = parseFloat(raw.replace(/[\s  ]/g, "").replace(",", "."));
    if (!(target > 0)) return;
    const grouped = /[\s  ]/.test(raw);
    const fmt = (v) => {
      let s2 = dec ? v.toFixed(dec) : String(Math.round(v));
      if (grouped) s2 = Number(s2).toLocaleString("ru-RU", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      else if (dec) s2 = s2.replace(".", sep);
      return text.slice(0, m.index) + s2 + text.slice(m.index + raw.length);
    };
    const t0 = performance.now(), dur = 900 + Math.min(600, target / 50);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? fmt(target * e) : text;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
