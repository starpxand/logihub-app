// Хранилище приложения: пользователи, заказы, история статусов, водители, претензии, уведомления.
// Статусы и переходы совпадают с Telegram-ботом (logihub_bot/storage.py) и BPMN-моделью «Процесс управления логистикой».
import { quote, addDays, HUB, HUB_ADDRESS, DESTINATIONS } from "./pricing.js";

const KEY = "logihub-app/v1";
export const PAYMENT_DAYS = 3;
export const DELAY_THRESHOLD_MIN = 120;     // граничный таймер «Отклонение от графика» – более 2 часов

export const ROLES = {
  client: { title: "Клиент", short: "Клиент" },
  manager: { title: "Менеджер по логистике", short: "Менеджер" },
  warehouse: { title: "Кладовщик", short: "Склад" },
  dispatcher: { title: "Диспетчер", short: "Диспетчер" },
  driver: { title: "Водитель", short: "Водитель" },
};

export const USERS = [
  { id: "u-client", role: "client", name: "Игорь Ковалёв", company: "ООО «ДальФуд»", inn: "2721004567", email: "i.kovalev@dalfood.ru", phone: "+7 914 205-18-44", avatar: "assets/img/avatar_client.jpg" },
  { id: "u-manager", role: "manager", name: "Анна Васильева", company: "ООО «ЛогиХаб»", email: "a.vasilieva@logihub.ru", avatar: "assets/img/avatar_manager.jpg" },
  { id: "u-warehouse", role: "warehouse", name: "Павел Орлов", company: "Склад № 1, Комсомольск-на-Амуре", email: "p.orlov@logihub.ru", avatar: "assets/img/avatar_warehouse.jpg" },
  { id: "u-dispatcher", role: "dispatcher", name: "Мария Лебедева", company: "Диспетчерская ЛогиХаб", email: "m.lebedeva@logihub.ru", avatar: "assets/img/avatar_dispatcher.jpg" },
  { id: "u-driver", role: "driver", name: "Сергей Никитин", company: "Рефрижератор А452КМ 27", email: "s.nikitin@logihub.ru", avatar: "assets/img/avatar_driver.jpg", driverId: 1 },
];

export const CLIENTS = [  // прочие клиенты платформы (заявки в очереди менеджера)
  { id: "c-vostok", name: "Светлана Ким", company: "АО «ВостокМед»" },
  { id: "c-amur", name: "Роман Гусев", company: "ООО «АмурСтрой»" },
  { id: "c-techno", name: "Ольга Пак", company: "ООО «ТехноДВ»" },
  { id: "c-mebel", name: "Денис Ли", company: "ООО «МебельГрад»" },
  { id: "c-sakh", name: "Виктор Чен", company: "АО «СахалинСнаб»" },
];

export const DRIVERS = [  // id, имя, тип транспорта, машина, госномер – как в боте
  { id: 1, name: "Сергей Никитин", transport: "Рефрижератор", vehicle: "Isuzu Forward, рефрижератор", plate: "А452КМ 27" },
  { id: 2, name: "Андрей Ковалёв", transport: "Фура", vehicle: "КАМАЗ-65207 с полуприцепом", plate: "В318ТР 27" },
  { id: 3, name: "Игорь Белов", transport: "Газель", vehicle: "ГАЗель Next", plate: "Е907НО 27" },
  { id: 4, name: "Дмитрий Сорокин", transport: "Контейнер (ж/д)", vehicle: "КАМАЗ-контейнеровоз", plate: "К225АУ 27" },
  { id: 5, name: "Олег Лысенко", transport: "Фура", vehicle: "MAN TGX с полуприцепом", plate: "М640ХС 27" },
  { id: 6, name: "Павел Гришин", transport: "Рефрижератор", vehicle: "Hino 500, рефрижератор", plate: "О771ЕР 27" },
];

// Статус → подпись, этапы BPMN, тон бейджа
export const STATUSES = {
  new:        { short: "На проверке", text: "На проверке у менеджера", stages: [2, 3], tone: "info" },
  clarify:    { short: "Уточнение", text: "Требует уточнения", stages: [4, 5], tone: "warn" },
  confirmed:  { short: "Ждёт оплаты", text: "Ожидает оплаты", stages: [7, 8], tone: "warn" },
  paid:       { short: "Оплачен", text: "Оплачен, передан на склад", stages: [9], tone: "info" },
  picking:    { short: "Сборка", text: "Комплектуется на складе", stages: [10, 11, 12], tone: "info" },
  ready:      { short: "К отгрузке", text: "Скомплектован, ТТН оформлена", stages: [13, 14], tone: "info" },
  in_transit: { short: "В пути", text: "В пути", stages: [15, 16], tone: "ok" },
  delayed:    { short: "Задержка", text: "В пути, задержка", stages: [17, 18], tone: "bad" },
  delivered:  { short: "Доставлен", text: "Доставлен, ожидает приёмки", stages: [19, 20, 21], tone: "ok" },
  accepted:   { short: "Принят", text: "Принят без замечаний", stages: [22], tone: "ok" },
  claim:      { short: "Претензия", text: "Претензия на рассмотрении", stages: [23], tone: "bad" },
  closed:     { short: "Выполнен", text: "Выполнен", stages: [25, 26], tone: "done" },
  cancelled:  { short: "Отменён", text: "Отменён", stages: [9], tone: "muted" },
};

// Допустимые переходы (потоки операций BPMN) – те же, что в боте
export const TRANSITIONS = {
  new: ["confirmed", "clarify", "cancelled"],
  clarify: ["new", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["picking"],
  picking: ["picking", "ready"],
  ready: ["in_transit"],
  in_transit: ["delayed", "delivered"],
  delayed: ["delayed", "delivered"],
  delivered: ["accepted", "claim"],
  accepted: ["closed"],
  claim: ["closed"],
  closed: [],
  cancelled: [],
};

export const ACTIVE = ["confirmed", "paid", "picking", "ready", "in_transit", "delayed", "delivered"];

export const CLAIM_KINDS = { shortage: "Недовложение", damage: "Повреждение груза", temperature: "Нарушение температурного режима", other: "Другое" };
export const CLAIM_DECISIONS = { compensation: "Компенсация", redelivery: "Довоз недостающего груза", rejected: "Претензия отклонена" };

// 26 этапов BPMN-модели (logihub-wiki/process)
export const BPMN = [
  [1, "Возникла потребность в перевозке", "client", "event"], [2, "Оформить заявку на перевозку", "client"],
  [3, "Проверить заявку", "manager"], [4, "Заявка корректна?", "manager", "gateway"], [5, "Уточнить данные заявки", "client"],
  [6, "Рассчитать стоимость и срок доставки", "system"], [7, "Сформировать договор-счёт", "manager"],
  [8, "Согласовать и оплатить счёт", "client"], [9, "Оплата поступила в течение 3 дней?", "manager", "gateway"],
  [10, "Скомплектовать и промаркировать груз", "warehouse"], [11, "Груз укомплектован полностью?", "warehouse", "gateway"],
  [12, "Докомплектовать груз", "warehouse"], [13, "Оформить ТТН и передать к отгрузке", "warehouse"],
  [14, "Построить маршрут и назначить транспорт", "dispatcher"], [15, "Принять груз и начать рейс", "driver"],
  [16, "Выполнить перевозку", "driver"], [17, "Отклонение от графика (таймер)", "system", "event"],
  [18, "Перепланировать маршрут и уведомить клиента", "dispatcher"], [19, "Доставить груз получателю", "driver"],
  [20, "Принять груз и проверить комплектность", "client"], [21, "Есть замечания?", "client", "gateway"],
  [22, "Подписать акт приёмки", "client"], [23, "Рассмотреть претензию и урегулировать", "manager"],
  [24, "Объединяющий шлюз", "manager", "gateway"], [25, "Закрыть заказ и пересчитать OTIF", "system"],
  [26, "Заказ выполнен", "system", "event"],
];

// ------------------------------------------------------------------ время (демо-сдвиг для проверки таймеров)
let state = null;
const listeners = new Set();
export const now = () => new Date(Date.now() + (state?.clock || 0));
export const iso = (d) => new Date(d).toISOString();
// плановое время прибытия – конец окна доставки
export const atWindowEnd = (d, win = "09:00–18:00") => { const x = new Date(d); const [h, m] = (win.split("–")[1] || "18:00").split(":"); x.setHours(+h, +m, 0, 0); return x; };

// ------------------------------------------------------------------ сохранение
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* приватный режим – работаем в памяти */ }
  return null;
}
function save(silent = false) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* без сохранения */ }
  if (!silent) listeners.forEach((f) => f());
}
export const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };

export function init() {
  state = load();
  if (!state || state.version !== 2) state = seed();
  tick(false);
  return state;
}
export function reset() { state = seed(); save(); }
export function shiftClock(ms) { state.clock = (state.clock || 0) + ms; tick(false); save(); }
export const clockShift = () => state.clock || 0;

// ------------------------------------------------------------------ сессия
export const session = () => state.session ? USERS.find((u) => u.id === state.session) : null;
export function login(userId) { state.session = userId; state.seen ??= {}; save(); }
export function logout() { state.session = null; save(); }

// ------------------------------------------------------------------ чтение
export const orders = () => state.orders;
export const order = (id) => state.orders.find((o) => o.id === Number(id));
export const driver = (id) => DRIVERS.find((d) => d.id === Number(id));
export const clientOf = (o) => USERS.find((u) => u.id === o.clientId) || CLIENTS.find((c) => c.id === o.clientId);
export const code = (o) => `LH-${o.id}`;
export const statusText = (s) => STATUSES[s]?.text || s;
export const stageOf = (o) => STATUSES[o.status]?.stages || [];

export function visibleOrders(user = session()) {
  const all = state.orders;
  switch (user?.role) {
    case "client": return all.filter((o) => o.clientId === user.id);
    case "driver": return all.filter((o) => o.driverId === user.driverId);
    default: return all;
  }
}

// ------------------------------------------------------------------ уведомления
function notify(o, text, to) {
  state.notes.unshift({ id: ++state.seq, orderId: o?.id ?? null, text, to, at: iso(now()) });
  state.notes = state.notes.slice(0, 200);
}
export function notesFor(user = session()) {
  if (!user) return [];
  return state.notes.filter((n) => n.to.includes(user.role) && (user.role !== "client" || order(n.orderId)?.clientId === user.id)
    && (user.role !== "driver" || order(n.orderId)?.driverId === user.driverId));
}
export function unseen(user = session()) {
  const seen = state.seen?.[user.id] || "";
  return notesFor(user).filter((n) => n.at > seen).length;
}
export const seenAt = (user = session()) => state.seen?.[user.id] || "";
export function markSeen(user = session()) { state.seen ??= {}; state.seen[user.id] = iso(now()); save(true); }   // без перерисовки

// ------------------------------------------------------------------ переходы
export class ProcessError extends Error {}

function move(o, status, note, by, extra = {}) {
  if (status !== o.status && !TRANSITIONS[o.status].includes(status)) {
    throw new ProcessError(`Переход «${statusText(o.status)}» → «${statusText(status)}» не предусмотрен процессом`);
  }
  if (status === o.status && !TRANSITIONS[o.status].includes(status)) throw new ProcessError("Действие недоступно в текущем статусе");
  Object.assign(o, extra);
  o.status = status;
  o.history.push({ status, note, by, at: iso(now()) });
}

function act(fn) {
  return (...args) => { const r = fn(...args); save(); return r; };
}

// 1–2, 6 – клиент оформляет заявку, система считает стоимость
export const createOrder = act((data) => {
  const user = session();
  const q = quote(data);
  const id = ++state.lastId;
  const o = {
    id, clientId: user.id, from: HUB_ADDRESS, destination: q.destination, region: q.region, address: data.address,
    recipient: data.recipient, phone: data.phone || "", cargo: q.cargo, weight: q.weight, volume: data.volume || 0,
    places: data.places || 1, temperature: q.temperature, declared: q.declared, insurance: q.insurance,
    transport: q.transport, distance: q.distance, price: q.price, total: q.total, shipDate: iso(q.shipDate),
    eta: iso(atWindowEnd(q.eta, data.window)), plannedEta: iso(atWindowEnd(q.eta, data.window)), window: data.window || "09:00–18:00", comment: data.comment || "",
    status: "new", history: [{ status: "new", note: "Заявка оформлена клиентом, стоимость рассчитана автоматически", by: "client", at: iso(now()) }],
    createdAt: iso(now()),
  };
  state.orders.unshift(o);
  notify(o, `Новая заявка ${code(o)} · ${user.company}, ${o.destination}`, ["manager"]);
  return o;
});

// 3–4 – проверка заявки менеджером
export const approve = act((id) => {
  const o = order(id);
  const deadline = addDays(now(), PAYMENT_DAYS);
  move(o, "confirmed", `Заявка проверена, сформирован договор-счёт № ${o.id}, срок оплаты ${PAYMENT_DAYS} дня`, "manager",
    { payDeadline: iso(deadline), contractAt: iso(now()) });
  notify(o, `Договор-счёт № ${o.id} на ${money(o.total)} – оплатите до ${dt(deadline)}`, ["client"]);
});
export const askClarify = act((id, comment) => {
  const o = order(id);
  move(o, "clarify", `Возвращена на уточнение: ${comment}`, "manager", { managerComment: comment });
  notify(o, `Заявка ${code(o)} требует уточнения: ${comment}`, ["client"]);
});
// 5 – клиент уточняет заявку (цикл)
export const resubmit = act((id, patch) => {
  const o = order(id);
  const q = quote({ destination: patch.destination ?? o.destination, cargo: o.cargo, weight: patch.weight ?? o.weight,
    shipDate: o.shipDate, declared: o.declared });
  move(o, "new", "Заявка уточнена клиентом и отправлена на повторную проверку", "client",
    { ...patch, price: q.price, total: q.total, transport: q.transport, distance: q.distance, eta: iso(atWindowEnd(q.eta, o.window)), plannedEta: iso(atWindowEnd(q.eta, o.window)), managerComment: "" });
  notify(o, `Заявка ${code(o)} уточнена клиентом`, ["manager"]);
});
export const cancelOrder = act((id, reason, by) => {
  const o = order(id);
  move(o, "cancelled", reason, by);
  notify(o, `Заказ ${code(o)} отменён: ${reason}`, by === "client" ? ["manager"] : ["client"]);
});
// 8–9 – согласование и оплата
export const agree = act((id) => {
  const o = order(id);
  o.agreedAt = iso(now());
  o.history.push({ status: o.status, note: "Клиент согласовал условия договора", by: "client", at: iso(now()) });
});
export const pay = act((id, method) => {
  const o = order(id);
  move(o, "paid", `Оплата поступила (${method}), заказ передан на склад`, "client", { paidAt: iso(now()), payMethod: method });
  notify(o, `Оплата по заказу ${code(o)} поступила – передан на склад`, ["manager", "warehouse"]);
});
// 10–13 – склад
export const startPicking = act((id) => {
  const o = order(id);
  o.picking = makePicking(o);
  move(o, "picking", "Склад начал комплектацию и маркировку груза", "warehouse");
});
export const scan = act((id, idx) => {
  const o = order(id);
  const it = o.picking[idx];
  if (it.missing) { it.checked = true; return false; }
  it.ok = true; it.checked = true;
  return true;
});
export const restock = act((id) => {   // 12 – докомплектовать (цикл обратно на проверку 11)
  const o = order(id);
  const missing = o.picking.filter((i) => i.missing);
  missing.forEach((i) => { i.missing = false; i.ok = false; i.checked = false; i.cell = "C-07 (резерв)"; });
  move(o, "picking", `Груз докомплектован из резервной ячейки C-07: ${missing.length} мест – повторная сверка`, "warehouse");
});
export const issueTtn = act((id, gate) => {
  const o = order(id);
  if (!o.picking?.every((i) => i.ok)) throw new ProcessError("Груз укомплектован не полностью – ТТН недоступна");
  move(o, "ready", `Оформлена ТТН № ${o.id}, груз передан в зону отгрузки (ворота ${gate})`, "warehouse", { ttnAt: iso(now()), gate });
  notify(o, `Заказ ${code(o)} готов к отгрузке – назначьте транспорт`, ["dispatcher"]);
  notify(o, `Груз по заказу ${code(o)} скомплектован, ТТН оформлена`, ["client"]);
});
// 14 – диспетчер строит маршрут и назначает транспорт
export const assignDriver = act((id, driverId) => {
  const o = order(id);
  if (o.status !== "ready") throw new ProcessError("Назначить транспорт можно после оформления ТТН");
  const d = driver(driverId);
  o.driverId = d.id;
  o.route = { progress: 0, variant: "Основной маршрут" };
  o.history.push({ status: o.status, note: `Построен маршрут, назначен водитель ${d.name} (${d.vehicle}, ${d.plate})`, by: "dispatcher", at: iso(now()) });
  notify(o, `Назначен рейс ${code(o)}: ${HUB} → ${o.destination}`, ["driver"]);
  notify(o, `По заказу ${code(o)} назначен транспорт: ${d.vehicle}, ${d.plate}`, ["client"]);
});
// 15–16 – водитель
export const startTrip = act((id) => {
  const o = order(id);
  if (!o.driverId) throw new ProcessError("Сначала диспетчер назначает водителя");
  move(o, "in_transit", "Водитель сверил груз с ТТН и начал рейс", "driver", { departedAt: iso(now()) });
  o.route.progress = 3;
  notify(o, `Заказ ${code(o)} в пути, прогноз доставки ${dt(o.eta)}`, ["client", "dispatcher"]);
});
export const advance = act((id, step = 20) => {
  const o = order(id);
  o.route.progress = Math.min(95, (o.route.progress || 0) + step);
  o.history.push({ status: o.status, note: `Геопозиция обновлена: пройдено ${o.route.progress} % маршрута`, by: "driver", at: iso(now()) });
});
// 17–18 – таймер отклонения и перепланирование
export const reportDelay = act((id, minutes, reason) => {
  const o = order(id);
  if (minutes <= DELAY_THRESHOLD_MIN) {
    o.history.push({ status: o.status, note: `Отставание ${minutes} мин – в пределах допуска (таймер не сработал)`, by: "driver", at: iso(now()) });
    return false;
  }
  move(o, "delayed", `Отклонение от графика: +${fmtMin(minutes)} (${reason})`, "system", { delay: { minutes, reason, resolved: false } });
  notify(o, `Отклонение от графика по рейсу ${code(o)}: +${fmtMin(minutes)}`, ["dispatcher"]);
  return true;
});
export const replan = act((id, variant, extraMin, message) => {
  const o = order(id);
  const eta = new Date(new Date(o.eta).getTime() + extraMin * 60000);
  move(o, "delayed", `Маршрут перепланирован: ${variant}; новый ETA ${dt(eta)}. Клиент уведомлён`, "dispatcher",
    { eta: iso(eta), route: { ...o.route, variant }, delay: { ...o.delay, resolved: true } });
  notify(o, message || `Новый прогноз доставки ${code(o)}: ${dt(eta)}`, ["client", "driver"]);
});
// 19 – доставка
export const deliver = act((id) => {
  const o = order(id);
  const at = now();
  const onTime = at <= endOfDay(o.plannedEta) ? 1 : 0;
  move(o, "delivered", "Груз доставлен получателю и выгружен", "driver", { deliveredAt: iso(at), onTime, route: { ...o.route, progress: 100 } });
  notify(o, `Заказ ${code(o)} доставлен – проверьте груз и подпишите акт`, ["client"]);
});
// 20–22 – приёмка; 25–26 – закрытие и OTIF
export const acceptDelivery = act((id) => {
  const o = order(id);
  move(o, "accepted", "Акт приёмки подписан клиентом без замечаний", "client", { actAt: iso(now()) });
  closeOrder(o, 1, "Заказ закрыт, OTIF пересчитан");
});
export const fileClaim = act((id, kind, text, photos) => {
  const o = order(id);
  o.claim = { kind, text, photos: photos || [], createdAt: iso(now()) };
  move(o, "claim", `Претензия: ${CLAIM_KINDS[kind].toLowerCase()}`, "client");
  notify(o, `Претензия по заказу ${code(o)}: ${CLAIM_KINDS[kind]}`, ["manager"]);
});
export const decideClaim = act((id, decision, compensation, answer) => {
  const o = order(id);
  Object.assign(o.claim, { decision, compensation: Number(compensation) || 0, answer, decidedAt: iso(now()) });
  const inFull = decision === "rejected" ? 1 : 0;
  notify(o, `Решение по претензии ${code(o)}: ${CLAIM_DECISIONS[decision]}`, ["client"]);
  closeOrder(o, inFull, `Претензия урегулирована (${CLAIM_DECISIONS[decision].toLowerCase()}), заказ закрыт, OTIF пересчитан`);
});
function closeOrder(o, inFull, note) {
  o.inFull = inFull;
  o.otif = o.onTime && inFull ? 1 : 0;
  o.status = "closed";
  o.history.push({ status: "closed", note, by: "system", at: iso(now()), otif: o.otif });
}
export const rate = act((id, stars) => { order(id).rating = stars; });

// ------------------------------------------------------------------ таймеры процесса (шлюз 9: автоотмена неоплаченных)
export function tick(persist = true) {
  let changed = false;
  for (const o of state.orders) {
    if (o.status !== "confirmed" || !o.payDeadline) continue;
    const left = new Date(o.payDeadline) - now();
    if (left <= 0) {
      o.status = "cancelled";
      o.history.push({ status: "cancelled", note: `Оплата не поступила в течение ${PAYMENT_DAYS} дней – заказ отменён автоматически`, by: "system", at: iso(now()) });
      notify(o, `Заказ ${code(o)} отменён: не оплачен в срок`, ["client", "manager"]);
      changed = true;
    } else if (left < 24 * 3600e3 && !o.reminded) {
      o.reminded = true;
      notify(o, `Напоминание: до автоматической отмены ${code(o)} меньше суток`, ["client"]);
      changed = true;
    }
  }
  if (changed && persist) save();
}

// ------------------------------------------------------------------ KPI по живым заказам
export function kpi(list = state.orders) {
  const closed = list.filter((o) => o.status === "closed");
  const n = closed.length || 1;
  return {
    total: list.length,
    active: list.filter((o) => ACTIVE.includes(o.status)).length,
    closed: closed.length,
    otif: Math.round(closed.reduce((s, o) => s + (o.otif || 0), 0) / n * 1000) / 10,
    onTime: Math.round(closed.reduce((s, o) => s + (o.onTime || 0), 0) / n * 1000) / 10,
    inFull: Math.round(closed.reduce((s, o) => s + (o.inFull || 0), 0) / n * 1000) / 10,
    revenue: list.filter((o) => !["new", "clarify", "cancelled", "confirmed"].includes(o.status)).reduce((s, o) => s + o.total, 0),
  };
}

// ------------------------------------------------------------------ форматирование (общее с видами)
export const money = (x) => `${Math.round(x).toLocaleString("ru-RU")} ₽`;
export const dt = (d) => new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const day = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60 ? (m % 60) + " мин" : ""}`.trim() : `${m} мин`);
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// ------------------------------------------------------------------ комплектация (лист сборки)
const POSITIONS = {
  "Продукты питания": ["Молочная продукция", "Сыры твёрдые", "Йогурты", "Сливочное масло", "Творог"],
  "Медикаменты": ["Вакцины", "Инсулин", "Перевязочные материалы", "Антибиотики"],
  "Электроника": ["Ноутбуки", "Мониторы", "Сетевое оборудование", "Комплектующие"],
  "Стройматериалы": ["Сухие смеси", "Утеплитель", "Крепёж", "Гидроизоляция"],
  "Одежда и обувь": ["Куртки", "Обувь зимняя", "Трикотаж", "Аксессуары"],
  "Мебель": ["Столы офисные", "Кресла", "Шкафы (разборные)", "Фурнитура"],
};
function makePicking(o) {
  const names = POSITIONS[o.cargo] || ["Груз"];
  const per = Math.max(1, Math.ceil(o.places / names.length));
  const items = [];
  let from = 1;
  names.forEach((n, i) => {
    if (from > o.places) return;
    const to = Math.min(o.places, from + per - 1);
    items.push({ name: `${n}, места ${from}–${to}`.replace(/места (\d+)–\1$/, "место $1"), code: `4607001…${String(from).padStart(2, "0")}–${String(to).padStart(2, "0")}`,
      cell: `${"ABC"[i % 3]}-${String(12 + i * 2).padStart(2, "0")}`, ok: false, checked: false, missing: false });
    from = to + 1;
  });
  if (o.id % 2 === 0 && items.length > 1) items[items.length - 1].missing = true;   // демонстрация цикла «докомплектовать»
  return items;
}

// ------------------------------------------------------------------ начальные данные (демо)
function seed() {
  const t = Date.now();
  const at = (h) => iso(new Date(t - h * 3600e3));
  const s = { version: 2, clock: 0, session: null, seen: {}, seq: 0, lastId: 15874, orders: [], notes: [] };
  state = s;
  const mk = (id, clientId, destination, cargo, weight, places, status, hAgo, extra = {}) => {
    const ship = new Date(t - (hAgo - 24) * 3600e3); ship.setHours(0, 0, 0, 0);
    const q = quote({ destination, cargo, weight, shipDate: ship, declared: extra.declared ?? 0 });
    const o = {
      id, clientId, from: HUB_ADDRESS, destination, region: DESTINATIONS[destination][0], address: extra.address || `${destination}, ул. Промышленная, ${id % 40 + 2}`,
      recipient: extra.recipient || "Склад получателя", phone: "+7 924 000-00-00", cargo, weight, volume: extra.volume || Math.round(weight / 220),
      places, temperature: q.temperature, declared: q.declared, insurance: q.insurance, transport: q.transport, distance: q.distance,
      price: q.price, total: q.total, shipDate: iso(q.shipDate), eta: iso(atWindowEnd(q.eta, "09:00–13:00")), plannedEta: iso(atWindowEnd(q.eta, "09:00–13:00")), window: "09:00–13:00",
      comment: extra.comment || "", status: "new", createdAt: at(hAgo),
      history: [{ status: "new", note: "Заявка оформлена клиентом, стоимость рассчитана автоматически", by: "client", at: at(hAgo) }],
    };
    const path = { new: [], clarify: ["clarify"], confirmed: ["confirmed"], paid: ["confirmed", "paid"], picking: ["confirmed", "paid", "picking"],
      ready: ["confirmed", "paid", "picking", "ready"], in_transit: ["confirmed", "paid", "picking", "ready", "in_transit"],
      delayed: ["confirmed", "paid", "picking", "ready", "in_transit", "delayed"],
      delivered: ["confirmed", "paid", "picking", "ready", "in_transit", "delivered"],
      claim: ["confirmed", "paid", "picking", "ready", "in_transit", "delivered", "claim"],
      closed: ["confirmed", "paid", "picking", "ready", "in_transit", "delivered", "accepted", "closed"],
      cancelled: ["confirmed", "cancelled"] }[status];
    const notes = { clarify: "Возвращена на уточнение: укажите телефон ответственного на складе получателя",
      confirmed: `Заявка проверена, сформирован договор-счёт № ${id}, срок оплаты 3 дня`, paid: "Оплата поступила (по счёту), заказ передан на склад",
      picking: "Склад начал комплектацию и маркировку груза", ready: `Оформлена ТТН № ${id}, груз передан в зону отгрузки (ворота 3)`,
      in_transit: "Водитель сверил груз с ТТН и начал рейс", delayed: "Отклонение от графика: +2 ч 10 мин (перекрытие трассы А-376)",
      delivered: "Груз доставлен получателю и выгружен", accepted: "Акт приёмки подписан клиентом без замечаний",
      claim: "Претензия: недовложение", closed: "Заказ закрыт, OTIF пересчитан",
      cancelled: "Оплата не поступила в течение 3 дней – заказ отменён автоматически" };
    path.forEach((st, i) => {
      const h = hAgo - (i + 1) * (hAgo / (path.length + 1));
      o.history.push({ status: st, note: notes[st], by: { clarify: "manager", confirmed: "manager", paid: "client", picking: "warehouse", ready: "warehouse",
        in_transit: "driver", delayed: "system", delivered: "driver", accepted: "client", claim: "client", closed: "system", cancelled: "system" }[st], at: at(h) });
    });
    o.status = status;
    if (path.includes("confirmed")) { o.contractAt = o.history[1].at; o.payDeadline = iso(new Date(new Date(o.history[1].at).getTime() + PAYMENT_DAYS * 864e5)); }
    if (path.includes("paid")) o.paidAt = o.history.find((h) => h.status === "paid").at, o.payMethod = "по счёту";
    if (path.includes("picking")) o.picking = makePicking(o);
    if (path.includes("ready")) { o.picking.forEach((i) => { i.ok = true; i.checked = true; i.missing = false; }); o.ttnAt = o.history.find((h) => h.status === "ready").at; o.gate = 3; }
    if (path.includes("in_transit")) { o.driverId = extra.driverId || 1; o.route = { progress: extra.progress ?? 100, variant: "Основной маршрут" }; o.departedAt = o.history.find((h) => h.status === "in_transit").at; }
    if (status === "ready" && extra.driverId) { o.driverId = extra.driverId; o.route = { progress: 0, variant: "Основной маршрут" }; }
    if (path.includes("delivered")) { o.deliveredAt = o.history.find((h) => h.status === "delivered").at; o.onTime = extra.onTime ?? 1; }
    if (status === "closed") { o.inFull = extra.inFull ?? 1; o.otif = o.onTime && o.inFull ? 1 : 0; o.actAt = o.history.find((h) => h.status === "accepted").at; o.rating = extra.rating; }
    if (status === "claim") o.claim = { kind: "shortage", text: "Не хватает 2 грузовых мест (творог, паллеты 23–24) по сравнению с ТТН", photos: [], createdAt: o.history.at(-1).at };
    if (status === "delayed") o.delay = { minutes: 130, reason: "перекрытие трассы А-376 (ДТП)", resolved: false };
    if (status === "clarify") o.managerComment = "Укажите телефон ответственного на складе получателя";
    Object.assign(o, extra.patch || {});
    s.orders.push(o);
    return o;
  };
  // заказы клиента «ДальФуд» – по одному на каждый участок процесса
  mk(15874, "u-client", "Хабаровск", "Продукты питания", 3200, 24, "new", 0.3, { address: "Хабаровск, ул. Промышленная, 12", recipient: "РЦ «ДальФуд», Хабаровск", comment: "Хрупкое, не штабелировать выше 2 ярусов" });
  mk(15872, "u-client", "Владивосток", "Продукты питания", 5400, 30, "confirmed", 30);
  mk(15870, "u-client", "Хабаровск", "Продукты питания", 2100, 16, "in_transit", 40, { driverId: 1, progress: 55 });
  mk(15866, "u-client", "Биробиджан", "Продукты питания", 1200, 8, "delivered", 70, { driverId: 6 });
  mk(15858, "u-client", "Хабаровск", "Продукты питания", 3300, 24, "closed", 160, { driverId: 1, rating: 5 });
  mk(15851, "u-client", "Благовещенск", "Продукты питания", 4800, 28, "closed", 260, { driverId: 6, onTime: 0, rating: 4 });
  // заказы других клиентов – очередь менеджера, склад, диспетчер
  mk(15873, "c-vostok", "Владивосток", "Медикаменты", 600, 6, "clarify", 2);
  mk(15871, "c-amur", "Биробиджан", "Стройматериалы", 18000, 36, "new", 1.2);
  mk(15869, "c-techno", "Хабаровск", "Электроника", 900, 12, "paid", 18);
  mk(15868, "c-mebel", "Биробиджан", "Мебель", 2400, 14, "picking", 22);
  mk(15867, "c-sakh", "Южно-Сахалинск", "Продукты питания", 11000, 40, "ready", 26);
  mk(15865, "c-techno", "Благовещенск", "Электроника", 7500, 30, "delayed", 50, { driverId: 2, progress: 62 });
  mk(15863, "c-amur", "Хабаровск", "Стройматериалы", 9000, 20, "claim", 90, { driverId: 5 });
  mk(15861, "c-vostok", "Хабаровск", "Медикаменты", 450, 4, "closed", 120, { driverId: 6, rating: 5 });
  mk(15859, "c-mebel", "Владивосток", "Мебель", 3100, 18, "cancelled", 200);
  mk(15856, "c-sakh", "Южно-Сахалинск", "Продукты питания", 8000, 32, "closed", 300, { driverId: 1, inFull: 0, rating: 3 });
  s.orders.sort((a, b) => b.id - a.id);
  // стартовые уведомления
  s.notes = [];
  for (const o of s.orders.slice().reverse()) {
    const last = o.history.at(-1);
    s.notes.unshift({ id: ++s.seq, orderId: o.id, text: `${code(o)}: ${statusText(o.status)}`, to: ["manager"], at: last.at });
  }
  s.notes.unshift({ id: ++s.seq, orderId: 15872, text: "Договор-счёт № 15872 – оплатите в течение 3 дней", to: ["client"], at: at(29) });
  s.notes.unshift({ id: ++s.seq, orderId: 15866, text: "Заказ LH-15866 доставлен – проверьте груз и подпишите акт", to: ["client"], at: at(5) });
  s.notes.unshift({ id: ++s.seq, orderId: 15867, text: "Заказ LH-15867 готов к отгрузке – назначьте транспорт", to: ["dispatcher"], at: at(3) });
  s.notes.unshift({ id: ++s.seq, orderId: 15865, text: "Отклонение от графика по рейсу LH-15865: +2 ч 10 мин", to: ["dispatcher"], at: at(1) });
  s.notes.unshift({ id: ++s.seq, orderId: 15869, text: "Оплата по заказу LH-15869 поступила – передан на склад", to: ["warehouse"], at: at(4) });
  s.notes.unshift({ id: ++s.seq, orderId: 15870, text: "Рейс LH-15870: Комсомольск-на-Амуре → Хабаровск", to: ["driver"], at: at(20) });
  return s;
}
