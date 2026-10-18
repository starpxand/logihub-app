// Документы процесса для печати/PDF: договор-счёт, лист комплектации, ТТН, маршрутный лист, акт приёмки, претензия.
import * as S from "../store.js";
import { HUB } from "../pricing.js";
import { icon, esc, money, kg, fmtDate, fmtDT, empty } from "../ui.js";

const SELLER = { name: "ООО «ЛогиХаб»", inn: "2703000015", addr: "681000, Комсомольск-на-Амуре, ул. Заводская, 1", bank: "р/с 40702810000000015874, АО «Дальневосточный банк»" };
const TITLES = { contract: "Договор-счёт", picklist: "Лист комплектации", ttn: "Товарно-транспортная накладная", waybill: "Маршрутный лист", act: "Акт приёмки", claim: "Претензия и решение" };

export function view([kind, id], user) {
  const o = S.order(id);
  if (!o || !S.visibleOrders(user).includes(o) || !TITLES[kind]) return { title: "Документ не найден", html: empty("Документ не найден или недоступен") };
  const c = S.clientOf(o);
  const body = { contract, picklist, ttn, waybill, act, claim }[kind](o, c);
  const html = `
  <div class="page-head noprint"><div><a class="back" href="#/order/${o.id}">${icon("back", 16)} ${S.code(o)}</a><h1>${TITLES[kind]}</h1></div>
    <div class="actions"><button class="btn btn--primary" data-print>${icon("printer", 16)} Печать / PDF</button></div></div>
  <article class="paper">
    <header class="paper__head"><div class="paper__brand"><span class="paper__logo">ЛХ</span><div><b>ЛогиХаб</b><small>${SELLER.addr}</small></div></div>
      <div class="paper__no"><b>${TITLES[kind]} № ${o.id}</b><small>от ${fmtDate(docDate(kind, o))}</small></div></header>
    ${body}
    <footer class="paper__foot"><span>Сформировано в веб-приложении «ЛогиХаб» ${fmtDT(S.now())}</span><span>Заказ ${S.code(o)}</span></footer>
  </article>`;
  return { title: TITLES[kind], crumbs: ["Документы"], html, mount: (r) => r.querySelector("[data-print]").addEventListener("click", () => (window.LogiHubAndroid ? window.LogiHubAndroid.print(`${TITLES[kind]} № ${o.id}`) : print())) };
}

function docDate(kind, o) {
  return { contract: o.contractAt, picklist: o.history.find((h) => h.status === "picking")?.at, ttn: o.ttnAt, waybill: o.departedAt || o.ttnAt, act: o.actAt || o.deliveredAt, claim: o.claim?.createdAt }[kind] || o.createdAt;
}
const parties = (c) => `<div class="paper__parties"><div><small>Исполнитель</small><b>${SELLER.name}</b><span>ИНН ${SELLER.inn}</span><span>${SELLER.bank}</span></div>
  <div><small>Заказчик</small><b>${esc(c?.company)}</b>${c?.inn ? `<span>ИНН ${esc(c.inn)}</span>` : ""}<span>${esc(c?.name)}</span></div></div>`;
const sign = (a, b) => `<div class="paper__sign"><div><span>${a}</span><i></i></div><div><span>${b}</span><i></i></div></div>`;

function contract(o, c) {
  const vat = Math.round(o.total * 20 / 120);
  const rows = [[`Перевозка (${o.transport.toLowerCase()}), ${HUB} → ${o.destination}, ${o.distance} км`, 1, o.price - 3000 - Math.round(o.weight * 0.8 / 10) * 10],
    ["Погрузочно-разгрузочные работы и оформление документов", 1, 3000], [`Тариф за вес груза, ${kg(o.weight)}`, 1, Math.round(o.weight * 0.8 / 10) * 10]];
  if (o.insurance) rows.push([`Страхование груза, 0,3 % от ${money(o.declared)}`, 1, o.insurance]);
  return `${parties(c)}
    <table class="paper__table"><thead><tr><th>Услуга</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>
    ${rows.map(([n, q, p]) => `<tr><td>${esc(n)}</td><td>${q}</td><td>${money(p)}</td><td>${money(p * q)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="3">Итого, в т. ч. НДС 20 % – ${money(vat)}</td><td><b>${money(o.total)}</b></td></tr></tfoot></table>
    <p>Груз: ${esc(o.cargo)}, ${o.places} мест, ${kg(o.weight)}${o.temperature ? `, температурный режим ${o.temperature}` : ""}. Отгрузка ${fmtDate(o.shipDate)}, доставка до ${fmtDate(o.plannedEta)} по адресу: ${esc(o.address)}.</p>
    <p><b>Срок оплаты – ${S.PAYMENT_DAYS} дня</b>${o.payDeadline ? ` (до ${fmtDT(o.payDeadline)})` : ""}. Без оплаты в срок заказ отменяется автоматически. Подписывая документ, заказчик принимает условия договора перевозки; документ подписан простой электронной подписью исполнителя.</p>
    ${o.paidAt ? `<p class="paper__stamp">Оплачено ${fmtDate(o.paidAt)} (${esc(o.payMethod)})</p>` : ""}
    ${sign("Исполнитель: менеджер А. Васильева", "Заказчик")}`;
}
function picklist(o, c) {
  return `<p>Заказчик: <b>${esc(c?.company)}</b> · груз ${esc(o.cargo)}, ${o.places} мест, ${kg(o.weight)}${o.temperature ? ` · режим ${o.temperature}` : ""}</p>
    <table class="paper__table"><thead><tr><th>№</th><th>Позиция</th><th>Штрихкод</th><th>Ячейка</th><th>Отметка</th></tr></thead><tbody>
    ${(o.picking || []).map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.name)}</td><td class="mono">${esc(i.code)}</td><td>${esc(i.cell)}</td><td>${i.ok ? "✓ собрано" : i.missing && i.checked ? "нет в ячейке" : ""}</td></tr>`).join("")}</tbody></table>
    ${sign("Кладовщик: П. Орлов", "Контролёр")}`;
}
function ttn(o, c) {
  const d = o.driverId ? S.driver(o.driverId) : null;
  return `<div class="paper__parties"><div><small>Грузоотправитель</small><b>${SELLER.name}</b><span>${esc(o.from)}</span></div><div><small>Грузополучатель</small><b>${esc(o.recipient)}</b><span>${esc(o.address)}</span><span>${esc(o.phone)}</span></div></div>
    <table class="paper__table"><thead><tr><th>Наименование груза</th><th>Мест</th><th>Масса</th><th>Объём</th><th>Объявл. ценность</th></tr></thead><tbody>
    <tr><td>${esc(o.cargo)}${o.temperature ? `, режим ${o.temperature}` : ""}</td><td>${o.places}</td><td>${kg(o.weight)}</td><td>${o.volume || "—"} м³</td><td>${o.declared ? money(o.declared) : "—"}</td></tr></tbody></table>
    <p>Транспорт: ${esc(o.transport)}${d ? `, ${esc(d.vehicle)}, госномер ${esc(d.plate)}, водитель ${esc(d.name)}` : " – назначается диспетчером"}. Ворота отгрузки № ${o.gate || 3}.</p>
    ${sign("Сдал: кладовщик П. Орлов", "Принял: водитель")}`;
}
function waybill(o, c) {
  const d = S.driver(o.driverId);
  if (!d) return `<p>Транспорт ещё не назначен.</p>`;
  return `<p>Водитель: <b>${esc(d.name)}</b> · ${esc(d.vehicle)}, ${esc(d.plate)} · маршрут: <b>${esc(o.route?.variant || "Основной маршрут")}</b></p>
    <table class="paper__table"><thead><tr><th>Пункт</th><th>Операция</th><th>План</th></tr></thead><tbody>
      <tr><td>Склад ЛогиХаб, ${HUB}</td><td>Погрузка, сверка с ТТН № ${o.id}</td><td>${fmtDate(o.shipDate)}, 16:00</td></tr>
      <tr><td>${esc(o.address)}</td><td>Выгрузка, передача получателю ${esc(o.recipient)}</td><td>${fmtDate(o.plannedEta)}, ${esc(o.window)}${o.eta !== o.plannedEta ? ` (прогноз ${fmtDT(o.eta)})` : ""}</td></tr></tbody></table>
    <p>Расстояние ${o.distance} км. Геопозиция передаётся в сервис «Трекинг»; при отставании более 2 часов срабатывает таймер отклонения и диспетчер перепланирует маршрут.</p>
    ${sign("Диспетчер: М. Лебедева", `Водитель: ${d.name}`)}`;
}
function act(o, c) {
  if (!o.actAt && !o.claim) return `<p>Акт ещё не подписан: груз ${o.deliveredAt ? "ожидает приёмки" : "в пути"}.</p>`;
  return `${parties(c)}<p>Груз по ТТН № ${o.id} – ${esc(o.cargo)}, ${o.places} мест, ${kg(o.weight)} – доставлен ${fmtDT(o.deliveredAt)} по адресу ${esc(o.address)}.</p>
    <p>${o.actAt ? "Груз принят в полном объёме, претензий к количеству, качеству и сохранности нет." : "Груз принят с замечаниями – см. претензию."}</p>
    <p>Доставка в срок: <b>${o.onTime ? "да" : "нет"}</b> (план ${fmtDate(o.plannedEta)}).</p>
    ${sign("Исполнитель", `Заказчик: ${esc(c?.name)}`)}`;
}
function claim(o, c) {
  const cl = o.claim;
  if (!cl) return `<p>Претензий по заказу нет.</p>`;
  return `${parties(c)}<p><b>Вид замечания:</b> ${esc(S.CLAIM_KINDS[cl.kind])}. Подана ${fmtDT(cl.createdAt)}.</p><blockquote>${esc(cl.text)}</blockquote>
    ${cl.photos?.length ? `<div class="photos">${cl.photos.map((p) => `<img src="${p}" alt="">`).join("")}</div>` : ""}
    <p><b>Решение:</b> ${cl.decision ? `${esc(S.CLAIM_DECISIONS[cl.decision])}${cl.compensation ? `, компенсация ${money(cl.compensation)}` : ""} (${fmtDT(cl.decidedAt)}). ${esc(cl.answer || "")}` : "на рассмотрении у менеджера."}</p>
    ${sign("Менеджер: А. Васильева", `Заказчик: ${esc(c?.name)}`)}`;
}
