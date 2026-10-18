// Действия процесса для текущей роли: кнопки по статусу заказа и обработчики (с модальными формами).
// Одни и те же кнопки встраиваются в карточку заказа и в рабочие экраны ролей.
import * as S from "./store.js";
import { DESTINATIONS } from "./pricing.js";
import { icon, esc, modal, toast, money, left } from "./ui.js";

const B = (act, id, label, ic, tone = "primary") =>
  `<button type="button" class="btn btn--${tone}" data-act="${act}" data-id="${id}">${ic ? icon(ic, 16) : ""}${esc(label)}</button>`;
const A = (href, label, ic) => `<a class="btn btn--ghost" href="${href}">${ic ? icon(ic, 16) : ""}${esc(label)}</a>`;

/** HTML кнопок, доступных роли для заказа в его текущем статусе. */
export function buttons(o, user = S.session()) {
  const r = user.role, s = o.status, id = o.id;
  const out = [];
  if (r === "client") {
    if (s === "clarify") out.push(B("resubmit", id, "Уточнить заявку", "refresh", "accent"));
    if (s === "confirmed") {
      out.push(A(`#/doc/contract/${id}`, "Договор-счёт", "file"));
      if (!o.agreedAt) out.push(B("agree", id, "Согласовать условия", "check", "primary"));
      out.push(B("pay", id, `Оплатить ${money(o.total)}`, "card", "accent"));
    }
    if (s === "delivered") { out.push(B("accept", id, "Подписать акт приёмки", "check", "primary")); out.push(B("claim", id, "Есть замечания – претензия", "alert", "danger")); }
    if (s === "closed" && !o.rating) out.push(B("rate", id, "Оценить доставку", "star", "ghost"));
    if (["new", "clarify", "confirmed"].includes(s)) out.push(B("cancel", id, "Отменить", "x", "ghost"));
  }
  if (r === "manager") {
    if (s === "new") { out.push(B("approve", id, "Заявка корректна – договор-счёт", "check", "primary")); out.push(B("clarify", id, "Вернуть на уточнение", "refresh", "ghost")); }
    if (s === "confirmed") out.push(B("paid", id, "Отметить поступление оплаты", "bank", "primary"));
    if (s === "claim") out.push(B("decide", id, "Решение по претензии", "flag", "accent"));
    if (["new", "clarify"].includes(s)) out.push(B("reject", id, "Отклонить заявку", "x", "ghost"));
  }
  if (r === "warehouse") {
    if (s === "paid") out.push(B("pick", id, "Начать комплектацию", "scan", "primary"));
    if (s === "picking") out.push(A(`#/picking/${id}`, "Открыть лист сборки", "scan"));
  }
  if (r === "dispatcher") {
    if (s === "ready" && !o.driverId) out.push(B("assign", id, "Построить маршрут и назначить транспорт", "route", "primary"));
    if (s === "delayed" && !o.delay?.resolved) out.push(B("replan", id, "Перепланировать и уведомить клиента", "send", "accent"));
  }
  if (r === "driver" && o.driverId === user.driverId) {
    if (s === "ready") out.push(B("start", id, "Принять груз и начать рейс", "truck", "accent"));
    if (["in_transit", "delayed"].includes(s)) {
      out.push(B("advance", id, "Обновить геопозицию", "nav", "ghost"));
      out.push(B("delay", id, "Сообщить о задержке", "clock", "ghost"));
      out.push(B("deliver", id, "Груз доставлен получателю", "check", "primary"));
    }
  }
  return out.join("");
}

/** Подключает обработчики ко всем [data-act] внутри root. */
export function bind(root) {
  root.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => run(b.dataset.act, Number(b.dataset.id)).catch((e) => {
    console.error(e);
    toast(e.message || "Действие не выполнено", "bad");
  })));
}

async function run(act, id) {
  const o = S.order(id);
  const user = S.session();
  switch (act) {
    // ---------------- клиент
    case "resubmit": {
      const f = await modal({ title: `Уточнить заявку ${S.code(o)}`, ok: "Отправить на повторную проверку", wide: true, body: `
        <div class="note-box note-box--warn">${icon("info", 16)}<span>Комментарий менеджера: ${esc(o.managerComment || "—")}</span></div>
        <div class="grid2">
          <label class="field"><span>Город доставки</span><select name="destination">${Object.keys(DESTINATIONS).map((d) => `<option${d === o.destination ? " selected" : ""}>${d}</option>`).join("")}</select></label>
          <label class="field"><span>Адрес доставки</span><input name="address" required value="${esc(o.address)}"></label>
          <label class="field"><span>Получатель</span><input name="recipient" required value="${esc(o.recipient)}"></label>
          <label class="field"><span>Телефон ответственного</span><input name="phone" required type="tel" value="${esc(o.phone)}" placeholder="+7 ..."></label>
          <label class="field"><span>Вес, кг</span><input name="weight" type="number" min="1" max="24000" required value="${o.weight}"></label>
          <label class="field"><span>Грузовых мест</span><input name="places" type="number" min="1" required value="${o.places}"></label>
        </div><label class="field"><span>Комментарий</span><textarea name="comment" rows="2">${esc(o.comment)}</textarea></label>` });
      if (!f) return;
      S.resubmit(id, { destination: f.destination, address: f.address, recipient: f.recipient, phone: f.phone, weight: Number(f.weight), places: Number(f.places), comment: f.comment });
      return toast("Заявка отправлена на повторную проверку");
    }
    case "agree": S.agree(id); return toast("Условия договора согласованы");
    case "pay": {
      const f = await modal({ title: `Оплата заказа ${S.code(o)}`, ok: `Оплатить ${money(o.total)}`, tone: "accent", body: `
        <p>К оплате: <b>${money(o.total)}</b> · назначение «Оплата по сч. ${o.id}». Срок оплаты – ${left(o.payDeadline, S.now())}.</p>
        <div class="radio-row">
          <label class="chip-radio"><input type="radio" name="m" value="по счёту" checked><span>${icon("bank", 16)} По счёту</span></label>
          <label class="chip-radio"><input type="radio" name="m" value="картой"><span>${icon("card", 16)} Картой</span></label>
          <label class="chip-radio"><input type="radio" name="m" value="через СБП"><span>${icon("qr", 16)} СБП</span></label>
        </div><p class="hint">Демо-режим: реальное списание не выполняется.</p>` });
      if (!f) return;
      if (!o.agreedAt) S.agree(id);
      S.pay(id, f.m);
      return toast("Оплата поступила – заказ передан на склад");
    }
    case "accept": {
      const f = await modal({ title: `Приёмка груза ${S.code(o)}`, ok: "Подписать акт", body: `
        <p>Проверьте количество мест (${o.places}), целостность упаковки${o.temperature ? ` и температурный режим ${o.temperature}` : ""}.</p>
        <label class="check"><input type="checkbox" required><span>Груз принят в полном объёме, замечаний нет</span></label>` });
      if (!f) return;
      S.acceptDelivery(id);
      return toast("Акт приёмки подписан, заказ закрыт");
    }
    case "claim": {
      const f = await modal({ title: `Претензия по заказу ${S.code(o)}`, ok: "Отправить претензию", tone: "danger", body: `
        <label class="field"><span>Тип замечания</span><select name="kind">${Object.entries(S.CLAIM_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
        <label class="field"><span>Описание</span><textarea name="text" rows="3" required placeholder="Например: не хватает 2 грузовых мест по сравнению с ТТН"></textarea></label>
        <label class="field"><span>Фото (до 3)</span><input name="photos" type="file" accept="image/*" multiple></label>` });
      if (!f) return;
      const photos = await Promise.all([...f._form.getAll("photos")].filter((x) => x.size).slice(0, 3).map(thumb));
      S.fileClaim(id, f.kind, f.text, photos);
      return toast("Претензия отправлена менеджеру");
    }
    case "rate": {
      const f = await modal({ title: "Оценка доставки", ok: "Оценить", body: `<div class="stars">${[5, 4, 3, 2, 1].map((n) =>
        `<input type="radio" name="s" id="s${n}" value="${n}"${n === 5 ? " checked" : ""}><label for="s${n}" title="${n}">${icon("star", 28)}</label>`).join("")}</div>` });
      if (!f) return;
      S.rate(id, Number(f.s));
      return toast("Спасибо за оценку!");
    }
    case "cancel": {
      const f = await modal({ title: `Отменить заказ ${S.code(o)}?`, ok: "Отменить заказ", tone: "danger", body: `<label class="field"><span>Причина</span><input name="r" required value="Отменён клиентом"></label>` });
      if (!f) return;
      S.cancelOrder(id, f.r, "client");
      return toast("Заказ отменён");
    }
    // ---------------- менеджер
    case "approve": S.approve(id); return toast(`Договор-счёт № ${id} сформирован и отправлен клиенту`);
    case "clarify": {
      const f = await modal({ title: `Вернуть ${S.code(o)} на уточнение`, ok: "Вернуть клиенту", body: `
        <label class="field"><span>Что уточнить</span><textarea name="c" rows="3" required>Укажите телефон ответственного на складе получателя</textarea></label>` });
      if (!f) return;
      S.askClarify(id, f.c);
      return toast("Заявка возвращена клиенту на уточнение");
    }
    case "reject": {
      const f = await modal({ title: `Отклонить заявку ${S.code(o)}`, ok: "Отклонить", tone: "danger", body: `<label class="field"><span>Причина</span><input name="r" required value="Нет свободного транспорта на указанную дату"></label>` });
      if (!f) return;
      S.cancelOrder(id, `Заявка отклонена менеджером: ${f.r}`, "manager");
      return toast("Заявка отклонена");
    }
    case "paid": S.pay(id, "по счёту, подтверждено менеджером"); return toast("Оплата отмечена – заказ передан на склад");
    case "decide": {
      const f = await modal({ title: `Претензия по ${S.code(o)}: ${S.CLAIM_KINDS[o.claim.kind]}`, ok: "Принять решение и закрыть заказ", wide: true, body: `
        <blockquote class="quote">${esc(o.claim.text)}</blockquote>
        ${o.claim.photos?.length ? `<div class="photos">${o.claim.photos.map((p) => `<img src="${p}" alt="Фото к претензии">`).join("")}</div>` : ""}
        <div class="grid2"><label class="field"><span>Решение</span><select name="d">${Object.entries(S.CLAIM_DECISIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
        <label class="field"><span>Компенсация, ₽</span><input name="c" type="number" min="0" value="${Math.round(o.total * 0.1)}"></label></div>
        <label class="field"><span>Ответ клиенту</span><textarea name="a" rows="2" required>Недостающие места довезём ближайшим рейсом, стоимость доставки компенсируем частично.</textarea></label>
        <p class="hint">После решения ветви приёмки сводятся (шлюз 24), заказ закрывается и OTIF пересчитывается (этап 25).</p>` });
      if (!f) return;
      S.decideClaim(id, f.d, f.c, f.a);
      return toast("Претензия урегулирована, заказ закрыт");
    }
    // ---------------- склад
    case "pick": S.startPicking(id); location.hash = `#/picking/${id}`; return;
    // ---------------- диспетчер
    case "assign": {
      const busy = new Set(S.orders().filter((x) => ["ready", "in_transit", "delayed"].includes(x.status) && x.driverId && x.id !== id).map((x) => x.driverId));
      const fit = S.DRIVERS.filter((d) => d.transport === o.transport);
      const f = await modal({ title: `Маршрут и транспорт для ${S.code(o)}`, ok: "Назначить", wide: true, body: `
        <p>${esc(o.from.split(",")[0])} → ${esc(o.destination)} · ${o.distance} км · ${esc(o.transport)}${o.temperature ? ` · ${o.temperature}` : ""} · ${(o.weight / 1000).toFixed(1)} т</p>
        <div class="pick-list">${fit.map((d, i) => `<label class="pick${busy.has(d.id) ? " is-busy" : ""}"><input type="radio" name="d" value="${d.id}"${!busy.has(d.id) && !fit.slice(0, i).some((x) => !busy.has(x.id)) ? " checked" : ""}${busy.has(d.id) ? " disabled" : ""}>
          <span><b>${esc(d.name)}</b><small>${esc(d.vehicle)} · ${esc(d.plate)}</small></span><em>${busy.has(d.id) ? "в рейсе" : "свободен"}</em></label>`).join("") || "<p>Нет машин подходящего типа</p>"}</div>
        <p class="hint">Сервис маршрутизации подбирает машину по типу ТС, грузоподъёмности и температурному режиму; маршрутный лист формируется автоматически.</p>` });
      if (!f) return;
      if (!f.d) throw new Error("Все подходящие машины заняты");
      S.assignDriver(id, Number(f.d));
      return toast("Маршрут построен, водитель назначен");
    }
    case "replan": {
      const f = await modal({ title: `Перепланирование рейса ${S.code(o)}`, ok: "Применить маршрут и уведомить клиента", tone: "accent", wide: true, body: `
        <div class="note-box note-box--warn">${icon("alert", 16)}<span>Отклонение от графика: +${S.fmtMin(o.delay?.minutes || 0)} – ${esc(o.delay?.reason || "")}</span></div>
        <div class="pick-list">
          <label class="pick"><input type="radio" name="v" value="Объезд по региональной трассе|40" checked><span><b>Объезд по региональной трассе</b><small>+38 км, ETA +40 мин к текущему прогнозу</small></span></label>
          <label class="pick"><input type="radio" name="v" value="Ожидание открытия трассы|90"><span><b>Ожидание открытия трассы</b><small>без изменения пути, ETA +1,5 ч</small></span></label>
        </div>
        <label class="field"><span>Уведомление клиенту</span><textarea name="m" rows="2">Заказ ${S.code(o)}: из-за ${esc(o.delay?.reason || "задержки")} доставка ожидается позже. Приносим извинения.</textarea></label>` });
      if (!f) return;
      const [variant, mins] = f.v.split("|");
      S.replan(id, variant, Number(mins) + (o.delay?.minutes || 0), f.m);
      return toast("Маршрут перепланирован, клиент уведомлён");
    }
    // ---------------- водитель
    case "start": S.startTrip(id); return toast("Рейс начат – статус «В пути»");
    case "advance": S.advance(id); return toast("Геопозиция передана в сервис «Трекинг»");
    case "delay": {
      const f = await modal({ title: "Сообщить о задержке", ok: "Отправить диспетчеру", body: `
        <div class="grid2"><label class="field"><span>Отставание, мин</span><input name="m" type="number" min="5" required value="130"></label>
        <label class="field"><span>Причина</span><select name="r"><option>перекрытие трассы (ДТП)</option><option>погодные условия</option><option>очередь на погрузке</option><option>неисправность ТС</option></select></label></div>
        <p class="hint">Граничный таймер «Отклонение от графика» срабатывает при отставании более ${S.DELAY_THRESHOLD_MIN / 60} ч – тогда диспетчер перепланирует маршрут.</p>` });
      if (!f) return;
      const fired = S.reportDelay(id, Number(f.m), f.r);
      return toast(fired ? "Таймер сработал – диспетчер получил инцидент" : "Отставание в пределах допуска, рейс продолжается", fired ? "bad" : "ok");
    }
    case "deliver": S.deliver(id); return toast("Доставка подтверждена – клиент проверяет груз");
    default: throw new Error(`Неизвестное действие ${act}`);
  }
}

function thumb(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
