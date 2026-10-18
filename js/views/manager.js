// Менеджер по логистике: обзор и KPI, очередь заявок (D3), договоры и счета, заказы в работе, претензии (D8).
import * as S from "../store.js";
import { icon, esc, badge, stages, orderLink, money, kg, fmtDT, fmtDate, left, ago, empty } from "../ui.js";
import { buttons, bind } from "../actions.js";
import { kpiCard, table, rowLinks } from "./client.js";

// ------------------------------------------------------------------ обзор и KPI
export function overview(params, user) {
  const all = S.orders();
  const k = S.kpi(all);
  const q = all.filter((o) => o.status === "new");
  const pay = all.filter((o) => o.status === "confirmed");
  const html = `
  <div class="page-head"><div><h1>Обзор и KPI</h1><p class="muted">Сквозной процесс по всем клиентам · данные обновляются при каждом действии</p></div>
    <div class="actions"><a class="btn btn--primary" href="#/queue">${icon("inbox", 16)} Очередь заявок</a></div></div>
  <div class="kpis">
    ${kpiCard("Новые заявки", q.length, q.length ? `старейшая ${ago(q.at(-1).createdAt, S.now())}` : "очередь пуста", q.length ? "warn" : "")}
    ${kpiCard("Ожидают оплаты", pay.length, (() => { const n = pay.filter((o) => new Date(o.payDeadline) - S.now() < 864e5).length; return !pay.length ? "нет" : n ? `у ${n} срок истекает в течение суток` : "сроки оплаты в норме"; })())}
    ${kpiCard("Заказы в работе", k.active, `выручка в работе ${money(k.revenue)}`)}
    ${kpiCard("OTIF (закрытые)", `${k.otif} %`, `цель 90 % · в срок ${k.onTime} %, в полном объёме ${k.inFull} %`, k.otif >= 90 ? "" : "warn", k.otif)}
  </div>
  ${flow(all)}
  <section class="card"><h2>${icon("layers")} Заказы по участкам процесса</h2>${board(all)}</section>
  <div class="cols">
    <section class="card"><h2>${icon("inbox")} Очередь на проверку</h2>${table(q, { client: true })}</section>
    <section class="card"><h2>${icon("alert")} Требуют внимания</h2><ul class="mini">${attention(all) || `<li class="muted">Отклонений нет</li>`}</ul></section>
  </div>`;
  return { title: "Обзор и KPI", html, mount: (r) => { bind(r); rowLinks(r); } };
}

function attention(all) {
  return all.flatMap((o) => {
    if (o.status === "delayed") return [`<li><a href="#/order/${o.id}">${S.code(o)} · задержка +${S.fmtMin(o.delay?.minutes || 0)}</a>${badge(o.status)}</li>`];
    if (o.status === "claim") return [`<li><a href="#/order/${o.id}">${S.code(o)} · претензия: ${esc(S.CLAIM_KINDS[o.claim.kind].toLowerCase())}</a>${badge(o.status)}</li>`];
    if (o.status === "confirmed" && new Date(o.payDeadline) - S.now() < 864e5) return [`<li><a href="#/order/${o.id}">${S.code(o)} · оплата истекает через ${left(o.payDeadline, S.now())}</a>${badge(o.status)}</li>`];
    if (o.status === "clarify") return [`<li><a href="#/order/${o.id}">${S.code(o)} · ждём уточнения от клиента</a>${badge(o.status)}</li>`];
    return [];
  }).join("");
}

// Поток процесса: участки BPMN слева направо, число заказов и выручка на каждом
export function flow(all) {
  const steps = [["Заявка", ["new", "clarify"], "inbox", "2–5"], ["Оплата", ["confirmed"], "card", "7–9"], ["Склад", ["paid", "picking"], "scan", "10–13"],
    ["Отгрузка", ["ready"], "boxes", "13–14"], ["В пути", ["in_transit", "delayed"], "truck", "15–18"], ["Приёмка", ["delivered", "claim"], "check", "19–24"], ["Выполнен", ["closed"], "flag", "25–26"]];
  const max = Math.max(1, ...steps.map(([, st]) => all.filter((o) => st.includes(o.status)).length));
  return `<section class="flow" aria-label="Поток процесса">${steps.map(([t, st, ic, bp], i) => {
    const l = all.filter((o) => st.includes(o.status));
    const bad = l.some((o) => ["delayed", "claim"].includes(o.status));
    return `<div class="flow__step${bad ? " is-bad" : ""}" style="--i:${i};--h:${(l.length / max) * 100}%">
      <span class="flow__ic">${icon(ic, 18)}</span><b>${l.length}</b><span class="flow__t">${t}</span>
      <small>${money(l.reduce((a, o) => a + o.total, 0))}</small><em>BPMN ${bp}</em><i class="flow__fill"></i></div>`;
  }).join("")}</section>`;
}

const COLS = [["Проверка", ["new", "clarify"]], ["Оплата", ["confirmed"]], ["Склад", ["paid", "picking"]], ["Отгрузка", ["ready"]], ["В пути", ["in_transit", "delayed"]], ["Приёмка", ["delivered", "claim"]]];
export function board(all) {
  return `<div class="board">${COLS.map(([t, st]) => {
    const l = all.filter((o) => st.includes(o.status));
    return `<div class="board__col"><h3>${t}<span>${l.length}</span></h3>${l.map((o) => `<a class="board__card board__card--${S.STATUSES[o.status].tone}" href="#/order/${o.id}">
      <b>${S.code(o)}</b><span>${esc(S.clientOf(o)?.company)}</span><small>${esc(o.destination)} · ${kg(o.weight)}</small></a>`).join("") || `<p class="muted small">—</p>`}</div>`;
  }).join("")}</div>`;
}

// ------------------------------------------------------------------ D3 · очередь заявок
export function queue([id], user) {
  const list = S.orders().filter((o) => ["new", "clarify"].includes(o.status));
  const sel = (id && S.order(id)) || list.find((o) => o.status === "new") || list[0];
  const busyRef = S.DRIVERS.filter((d) => d.transport === sel?.transport).length;
  const checks = sel ? [
    [true, `Адреса найдены, расстояние ${sel.distance} км`],
    [busyRef > 0, `${sel.transport}${sel.temperature ? `, ${sel.temperature}` : ""}: ${busyRef} машин этого типа в автопарке`],
    [sel.weight <= 24000, `Вес ${kg(sel.weight)} в пределах грузоподъёмности`],
    [Boolean(sel.phone && sel.phone.replace(/\D/g, "").length >= 10 && !sel.phone.includes("000-00-00")), "Указан контакт получателя"],
  ] : [];
  const html = `
  <div class="page-head"><div><h1>Очередь на проверку</h1><p class="muted">Проверка заявки, договор-счёт ${stages([3, 4, 6, 7])}</p></div></div>
  ${!list.length ? empty("Новых заявок нет", "Новые заявки клиентов появятся здесь автоматически") : `
  <div class="cols cols--wide">
    <section class="card card--flush"><div class="table-wrap"><table class="table table--select"><thead><tr><th>Заявка</th><th>Клиент</th><th>Куда</th><th>Груз</th><th>Поступила</th><th>Статус</th></tr></thead><tbody>
      ${list.map((o) => `<tr class="${o === sel ? "is-sel" : ""}" data-href="#/queue/${o.id}"><td class="mono">${S.code(o)}</td><td>${esc(S.clientOf(o)?.company)}</td><td>${esc(o.destination)}</td>
        <td>${esc(o.cargo)}, ${kg(o.weight)}</td><td>${ago(o.history.at(-1).at, S.now())}</td><td><span class="badge badge--${S.STATUSES[o.status].tone}">${o.status === "new" ? "На проверке" : "Уточнение"}</span></td></tr>`).join("")}</tbody></table></div></section>
    <div class="stack">
      <section class="card"><h2>${icon("check")} Проверка ${S.code(sel)}</h2>
        <ul class="checklist">${checks.map(([ok, t]) => `<li class="${ok ? "is-ok" : "is-warn"}">${icon(ok ? "check" : "alert", 14)}<span>${esc(t)}</span></li>`).join("")}</ul>
        <dl class="kv"><dt>Маршрут</dt><dd>${esc(sel.destination)}, ${esc(sel.address)}</dd><dt>Получатель</dt><dd>${esc(sel.recipient)} · ${esc(sel.phone || "—")}</dd>
          <dt>Груз</dt><dd>${esc(sel.cargo)}, ${kg(sel.weight)}, ${sel.places} мест</dd><dt>Отгрузка</dt><dd>${fmtDate(sel.shipDate)}</dd>${sel.comment ? `<dt>Комментарий</dt><dd>${esc(sel.comment)}</dd>` : ""}</dl>
        ${sel.status === "clarify" ? `<div class="note-box note-box--warn">${icon("clock", 16)}<span>Ждём уточнения: ${esc(sel.managerComment)}</span></div>` : ""}
        <div class="actions">${buttons(sel)}</div></section>
      <section class="card card--dark"><h2>${icon("file")} Договор-счёт</h2><b class="price">${money(sel.total)}</b>
        <p class="muted">перевозка ${money(sel.price)}${sel.insurance ? ` + страхование ${money(sel.insurance)}` : ""} · срок оплаты ${S.PAYMENT_DAYS} дня после выставления</p></section>
    </div>
  </div>`}`;
  return { title: "Очередь заявок", crumbs: ["Заявки"], html, mount: (r) => { bind(r); rowLinks(r); } };
}

// ------------------------------------------------------------------ договоры и счета
export function contracts(params, user) {
  const list = S.orders().filter((o) => o.contractAt).sort((a, b) => (a.status === "confirmed" ? -1 : 0) - (b.status === "confirmed" ? -1 : 0));
  const html = `<div class="page-head"><div><h1>Договоры и счета</h1><p class="muted">Контроль срока оплаты: неоплаченный за ${S.PAYMENT_DAYS} дня заказ отменяется автоматически ${stages([7, 9])}</p></div></div>
  <section class="card card--flush"><div class="table-wrap"><table class="table"><thead><tr><th>Договор-счёт</th><th>Клиент</th><th>Сумма</th><th>Выставлен</th><th>Оплата</th><th>Статус</th><th></th></tr></thead><tbody>
  ${list.map((o) => `<tr data-href="#/order/${o.id}"><td><a class="link" href="#/doc/contract/${o.id}">№ ${o.id}</a></td><td>${esc(S.clientOf(o)?.company)}</td><td class="num">${money(o.total)}</td>
    <td>${fmtDate(o.contractAt)}</td><td>${o.paidAt ? `${fmtDate(o.paidAt)}` : o.status === "confirmed" ? `<span class="${new Date(o.payDeadline) - S.now() < 864e5 ? "t-bad" : "t-warn"}">осталось ${left(o.payDeadline, S.now())}</span>` : "—"}</td>
    <td>${badge(o.status)}</td><td class="actions actions--sm">${o.status === "confirmed" ? buttons(o) : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
  return { title: "Договоры и счета", html, mount: (r) => { bind(r); rowLinks(r); } };
}

// ------------------------------------------------------------------ заказы в работе
export function work(params, user) {
  const all = S.orders();
  const html = `<div class="page-head"><div><h1>Заказы в работе</h1><p class="muted">Канбан по участкам процесса – от проверки до приёмки</p></div></div>
  <section class="card">${board(all)}</section>
  <section class="card"><h2>Все заказы</h2>${table(all, { client: true })}</section>`;
  return { title: "Заказы в работе", html, mount: rowLinks };
}

// ------------------------------------------------------------------ D8 · претензии, закрытие, OTIF
export function claims(params, user) {
  const all = S.orders();
  const open = all.filter((o) => o.status === "claim");
  const done = all.filter((o) => o.claim?.decision);
  const closed = all.filter((o) => o.status === "closed").slice(0, 8);
  const k = S.kpi(all);
  const html = `<div class="page-head"><div><h1>Претензии и закрытие заказов</h1><p class="muted">Урегулирование, объединение ветвей приёмки, пересчёт OTIF ${stages([23, 26])}</p></div></div>
  <div class="kpis">${kpiCard("Открытые претензии", open.length, open.length ? "ждут решения" : "нет", open.length ? "bad" : "")}${kpiCard("Урегулировано", done.length, "за всё время")}
    ${kpiCard("OTIF", `${k.otif} %`, "по закрытым заказам", k.otif >= 90 ? "" : "warn", k.otif)}${kpiCard("In Full", `${k.inFull} %`, "в полном объёме", "", k.inFull)}</div>
  <section class="card"><h2>${icon("alert")} Открытые претензии</h2>${open.length ? `<ul class="tasks">${open.map((o) => `<li><div>${orderLink(o)} ${badge(o.status)}
    <small><b>${esc(S.CLAIM_KINDS[o.claim.kind])}</b> · ${esc(S.clientOf(o)?.company)} · «${esc(o.claim.text)}»</small></div><div class="actions">${buttons(o)}</div></li>`).join("")}</ul>` : `<p class="muted">Открытых претензий нет 👍</p>`}</section>
  <section class="card"><h2>${icon("check")} Последние закрытые заказы</h2><div class="table-wrap"><table class="table"><thead><tr><th>Заказ</th><th>Клиент</th><th>On Time</th><th>In Full</th><th>OTIF</th><th>Оценка</th></tr></thead><tbody>
    ${closed.map((o) => `<tr data-href="#/order/${o.id}"><td>${orderLink(o)}</td><td>${esc(S.clientOf(o)?.company)}</td><td>${o.onTime ? "✓" : "✗"}</td><td>${o.inFull ? "✓" : "✗"}</td>
      <td><b class="${o.otif ? "t-ok" : "t-bad"}">${o.otif ? "1" : "0"}</b></td><td>${o.rating ? "★".repeat(o.rating) : "—"}</td></tr>`).join("")}</tbody></table></div></section>`;
  return { title: "Претензии", html, mount: (r) => { bind(r); rowLinks(r); } };
}
