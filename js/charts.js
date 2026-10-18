// Лёгкие SVG-графики для раздела «Аналитика» (без внешних библиотек – работают офлайн и в APK).
const NS = "http://www.w3.org/2000/svg";
const fmtN = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} тыс` : `${v}`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function ticks(min, max, n = 4) {
  const step0 = (max - min) / n;
  const p = 10 ** Math.floor(Math.log10(step0 || 1));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= step0) || p;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Линии: series = [{ name, values, color, dash }], labels – подписи по оси X. */
export function lines({ labels, series, unit = "", target = null, height = 260, min = null, max = null }) {
  const W = 720, H = height, L = 48, R = 12, T = 14, B = 30;
  const all = series.flatMap((s) => s.values).concat(target ?? []);
  const yt = ticks(min ?? Math.min(...all), max ?? Math.max(...all));
  const y0 = yt[0], y1 = yt.at(-1);
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const every = Math.ceil(labels.length / 8);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  s += yt.map((v) => `<g class="chart__grid"><line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtN(v)}${unit}</text></g>`).join("");
  s += labels.map((l, i) => (i % every === 0 || i === labels.length - 1 ? `<text class="chart__x" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : "")).join("");
  if (target !== null) s += `<g class="chart__target"><line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/><text x="${W - R}" y="${y(target) - 6}" text-anchor="end">цель ${target}${unit}</text></g>`;
  for (const se of series) {
    const d = se.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    s += se.dash ? `<path class="chart__line chart__line--dash" d="${d}" stroke="${se.color}" stroke-dasharray="${se.dash}"/>`
      : `<path class="chart__line" pathLength="1" d="${d}" stroke="${se.color}"/>`;
    s += se.values.map((v, i) => `<circle class="chart__pt" cx="${x(i)}" cy="${y(v)}" r="3" fill="${se.color}"><title>${esc(labels[i])}: ${v}${unit} · ${esc(se.name)}</title></circle>`).join("");
  }
  return s + "</svg>";
}

/** Столбцы: группы по X, каждая с несколькими значениями. */
export function bars({ labels, series, unit = "", height = 260 }) {
  const W = 720, H = height, L = 56, R = 12, T = 14, B = 30;
  const yt = ticks(Math.min(0, ...series.flatMap((s) => s.values)), Math.max(...series.flatMap((s) => s.values)));
  const y0 = yt[0], y1 = yt.at(-1);
  const y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const gw = (W - L - R) / labels.length, bw = Math.min(26, (gw * 0.75) / series.length);
  const every = Math.ceil(labels.length / 10);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  s += yt.map((v) => `<g class="chart__grid"><line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtN(v)}${unit}</text></g>`).join("");
  labels.forEach((l, i) => {
    const cx = L + gw * i + gw / 2;
    series.forEach((se, k) => {
      const v = se.values[i], x0 = cx - (bw * series.length) / 2 + k * bw;
      s += `<rect class="chart__bar" x="${x0 + 1}" y="${Math.min(y(v), y(0))}" width="${bw - 2}" height="${Math.abs(y(v) - y(0))}" rx="2" fill="${se.color}"><title>${esc(l)} · ${esc(se.name)}: ${v.toLocaleString("ru-RU")}${unit}</title></rect>`;
    });
    if (i % every === 0) s += `<text class="chart__x" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>`;
  });
  return s + "</svg>";
}

/** Горизонтальные полосы со значениями (рейтинг). */
export function hbars({ items, unit = "", color = "#2f5bea", fmt = fmtN }) {
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return `<ul class="hbars">${items.map((i) => `<li><span>${esc(i.name)}</span><i><b style="width:${(i.value / max) * 100}%;background:${i.color || color}"></b></i><em>${fmt(i.value)}${unit}</em></li>`).join("")}</ul>`;
}

/** Кольцевая диаграмма. */
export function donut({ items, colors, size = 200, label = "" }) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const r = 70, c = 2 * Math.PI * r;
  let off = 0;
  const segs = items.map((it, k) => {
    const len = (it.value / total) * c;
    const seg = `<circle r="${r}" cx="100" cy="100" fill="none" stroke="${colors[k % colors.length]}" stroke-width="28" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(it.name)}: ${Math.round((it.value / total) * 100)} %</title></circle>`;
    off += len;
    return seg;
  }).join("");
  return `<div class="donut"><svg viewBox="0 0 200 200" width="${size}" height="${size}" role="img">${segs}<text x="100" y="96" text-anchor="middle" class="donut__v">${fmtN(total)}</text><text x="100" y="116" text-anchor="middle" class="donut__l">${esc(label)}</text></svg>
    <ul>${items.map((it, k) => `<li><i style="background:${colors[k % colors.length]}"></i>${esc(it.name)}<b>${Math.round((it.value / total) * 100)} %</b></li>`).join("")}</ul></div>`;
}
export { fmtN };
