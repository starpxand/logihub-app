// Схематичная карта сети ЛогиХаб (Дальний Восток): хаб, направления, дороги, паром Ванино – Холмск, положение рейсов.
import { HUB } from "./pricing.js";

const CITY = {   // [долгота, широта]
  [HUB]: [137.0, 50.55], "Хабаровск": [135.07, 48.48], "Биробиджан": [132.92, 48.79], "Владивосток": [131.89, 43.12],
  "Благовещенск": [127.53, 50.29], "Южно-Сахалинск": [142.74, 46.96],
};
const VIA = {
  "Хабаровск": [[136.4, 49.6]],
  "Биробиджан": [[136.4, 49.6], CITY["Хабаровск"]],
  "Владивосток": [[136.4, 49.6], CITY["Хабаровск"], [134.6, 47.2], [133.8, 45.9], [132.4, 44.6], [131.95, 43.8]],
  "Благовещенск": [[136.4, 49.6], CITY["Хабаровск"], CITY["Биробиджан"], [131.05, 49.0], [129.6, 50.2], [128.47, 50.92]],
  "Южно-Сахалинск": [[138.6, 50.1], [140.25, 49.09], [142.05, 47.04]],
};
const W = 760, H = 620;   // область: 125,5–144,5° в. д., 42,5–52,2° с. ш.
const px = ([lon, lat]) => [(lon - 125.5) * 40, (52.2 - lat) * 64];
const line = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
export const routePoints = (dest) => [CITY[HUB], ...(VIA[dest] || []), CITY[dest]].map(px);

// точка на ломаной по доле пути 0..1
export function along(pts, t) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = seg.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, t));
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const k = d / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; }
    d -= seg[i];
  }
  return pts.at(-1);
}

// Береговая линия и Сахалин – по реальным координатам (та же проекция px)
const COAST = [[141.6, 53.4], [141.0, 51.4], [140.25, 49.09], [139.2, 47.6], [137.9, 46.4], [136.3, 44.9], [135.1, 43.8], [133.2, 42.85], [132.3, 43.2], [131.89, 43.12], [131.3, 42.6], [130.7, 42.3], [130.4, 41.6]];
const SAKH_PTS = [[142.2, 53.4], [142.25, 51.0], [142.05, 49.1], [141.85, 47.9], [142.05, 46.6], [142.75, 46.1], [143.4, 46.6], [143.1, 48.6], [143.25, 51.0], [143.2, 53.4]];
const AMUR_PTS = [[124.8, 53.2], [126.5, 51.4], [127.53, 50.29], [129.6, 49.3], [131.0, 48.4], [132.9, 47.9], [134.4, 48.2], [135.07, 48.48], [136.0, 49.4], [137.0, 50.55], [138.6, 51.9], [140.4, 53.3]];
const poly = (pts) => line(pts.map(px));
const LAND = `${poly(COAST)} L-20 700 L-20 -40 Z`;
const SAKH = `${poly(SAKH_PTS)} Z`;
const AMUR = poly(AMUR_PTS);

/** Карта: rides – [{ dest, progress, tone, label, active, replan }] */
export function mapSvg(rides = [], { compact = false } = {}) {
  const routes = Object.keys(VIA).map((d) => `<path class="map__road" d="${line(routePoints(d))}"/>`).join("");
  const ferry = (() => { const a = px([140.25, 49.09]), b = px([142.05, 47.04]); return `<path class="map__ferry" d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}"/>`; })();
  const cities = Object.entries(CITY).map(([n, c]) => {
    const [x, y] = px(c);
    const hub = n === HUB;
    return `<g class="map__city${hub ? " map__city--hub" : ""}" transform="translate(${x} ${y})"><circle r="${hub ? 9 : 6}"/>
      <text x="${n === "Биробиджан" ? -12 : n === "Южно-Сахалинск" ? -12 : 12}" y="${n === "Владивосток" ? 20 : n === "Благовещенск" ? 22 : -10}" text-anchor="${n === "Биробиджан" || n === "Южно-Сахалинск" ? "end" : "start"}">${hub ? "Хаб · " : ""}${n}</text></g>`;
  }).join("");
  const rideEls = rides.map((r) => {
    const pts = routePoints(r.dest);
    const t = (r.progress ?? 0) / 100;
    const done = [];
    const total = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    let acc = 0;
    done.push(pts[0]);
    for (let i = 1; i < pts.length; i++) {
      const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if ((acc + s) / total <= t) { done.push(pts[i]); acc += s; } else { done.push(along(pts, t)); break; }
    }
    const [x, y] = along(pts, t);
    return `<g class="map__ride map__ride--${r.tone || "ok"}${r.active ? " is-active" : ""}">
      <path class="map__plan" d="${line(pts)}"/>${r.replan ? `<path class="map__replan" d="${line(pts.map((p, i) => i && i < pts.length - 1 ? [p[0] + 14, p[1] + 10] : p))}"/>` : ""}
      <path class="map__done" d="${line(done)}"/>
      <g class="map__truck" transform="translate(${x} ${y})"><circle r="11"/><path d="M-5 -3h6v6h-6zM1 0h3l1.5 1.5V3H1z" fill="#fff"/></g>
      ${r.label ? `<g class="map__tag" transform="translate(${x + 14} ${y - 26})"><rect width="${r.label.length * 6.6 + 16}" height="22" rx="11"/><text x="8" y="15">${r.label}</text></g>` : ""}
    </g>`;
  }).join("");
  return `<svg class="map${compact ? " map--compact" : ""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Карта рейсов">
    <rect width="${W}" height="${H}" class="map__sea"/>
    <path class="map__land" d="${LAND}"/><path class="map__land" d="${SAKH}"/>
    <path class="map__river" d="${AMUR}"/>
    <g class="map__grid">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 95} 0V${H}"/>`).join("")}${Array.from({ length: 7 }, (_, i) => `<path d="M0 ${i * 100}H${W}"/>`).join("")}</g>
    ${routes}${ferry}${rideEls}${cities}
    <text class="map__sea-label" x="560" y="520">Японское море</text><text class="map__sea-label" x="612" y="150" transform="rotate(-72 612 150)">Татарский пролив</text>
  </svg>`;
}
