// D1 · Вход в систему – точка входа для всех дорожек BPMN; роль определяется учётной записью.
import * as S from "../store.js";
import { icon, esc, avatar, toast, countUp } from "../ui.js";
import { mapSvg, animateRides } from "../map.js";

// живые рейсы на карте экрана входа
const RIDES = [
  { dest: "Хабаровск", progress: 20, speed: 1.6, label: "LH-15870" }, { dest: "Владивосток", progress: 45, speed: 0.7, label: "LH-15872" },
  { dest: "Благовещенск", progress: 70, speed: 0.8, label: "LH-15865" }, { dest: "Южно-Сахалинск", progress: 10, speed: 0.9, label: "LH-15867" },
  { dest: "Биробиджан", progress: 55, speed: 1.2 },
];
// лента событий процесса
const TICKER = [
  ["info", "LH-15874 · новая заявка · ООО «ДальФуд» → Хабаровск · 44 280 ₽"], ["ok", "LH-15869 · оплата поступила · передан на склад"],
  ["warn", "LH-15872 · договор-счёт выставлен · срок оплаты 3 дня"], ["ok", "LH-15867 · ТТН оформлена · ворота 3"],
  ["bad", "LH-15865 · отклонение +2 ч 10 мин · маршрут перепланирован"], ["ok", "LH-15866 · доставлен · Биробиджан"],
  ["done", "LH-15858 · акт подписан · OTIF = 1"], ["info", "LH-15870 · в пути · Хабаровск, 55 %"],
];

const PASSWORD = "logihub";

export function render() {
  const roles = S.USERS.map((u) => `
    <button type="button" class="role" data-user="${u.id}">
      ${avatar(u, 40)}<span><b>${esc(S.ROLES[u.role].title)}</b><small>${esc(u.name)} · ${esc(u.company)}</small></span>${icon("chevron", 16)}
    </button>`).join("");
  return `
  <section class="login">
    <div class="login__form">
      <a class="brand brand--dark" href="#/login">${logoMark()}<span>ЛогиХаб</span></a>
      <div class="login__in">
        <h1>Добро пожаловать</h1>
        <p class="muted">Каждая поставка – под контролем, в одном окне.</p>
        <form data-login novalidate>
          <label class="field"><span>Рабочая почта</span>
            <span class="input">${icon("mail", 16)}<input name="email" type="email" required placeholder="name@company.ru" autocomplete="username" value="i.kovalev@dalfood.ru"></span></label>
          <label class="field"><span>Пароль</span>
            <span class="input">${icon("lock", 16)}<input name="password" type="password" required placeholder="Пароль" autocomplete="current-password" value="${PASSWORD}"></span></label>
          <button class="btn btn--accent btn--block" type="submit">Войти</button>
        </form>
        <div class="or"><span>или демо-вход по роли</span></div>
        <div class="roles">${roles}</div>
        <a class="btn btn--ghost btn--block" href="https://t.me/logihub_logistics_bot" target="_blank" rel="noopener">${icon("telegram", 16)} Войти через Telegram-бота</a>
        <p class="hint">Пароль всех демо-учётных записей – <code>${PASSWORD}</code>. Роль пользователя (клиент, менеджер, кладовщик, диспетчер, водитель)
          определяется автоматически после входа. Данные хранятся только в этом браузере.</p>
      </div>
    </div>
    <div class="login__hero">
      <img class="login__photo" src="assets/img/login_hero.jpg" alt="">
      <div class="login__map">${mapSvg(RIDES.map((r) => ({ ...r, tone: "ok" })), { dark: true })}</div>
      <div class="login__top">
        <span class="live"><i></i>Диспетчерская · в реальном времени</span>
        <h2>Заявка → договор → склад → рейс → приёмка → OTIF</h2>
        <p>26 этапов BPMN-процесса, 5 ролей и одно окно – от Комсомольска-на-Амуре до Владивостока и Сахалина.</p>
      </div>
      <div class="login__cards">
        <div class="glass"><span>OTIF · релиз v2.0</span><b data-count data-otif>87 %</b><small>в срок и в полном объёме</small></div>
        <div class="glass"><span>Заказов выполнено</span><b data-count data-orders>5 841</b><small>выгрузка 2024–2026 гг.</small></div>
        <div class="glass"><span>Рейсов на карте</span><b data-count>${RIDES.length}</b><small>Хабаровск · Владивосток · Сахалин</small></div>
      </div>
      <div class="ticker" aria-hidden="true"><div class="ticker__track">${TICKER.concat(TICKER).map((t) => `<span><i class="ticker__dot ticker__dot--${t[0]}"></i>${t[1]}</span>`).join("")}</div></div>
    </div>
  </section>`;
}

const logoMark = () => `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#ff8a3d"/><path d="M8 12h11v9H8zM19 15h3.5l2.5 3v3h-6z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="11.5" cy="22.5" r="1.8" fill="#fff"/><circle cx="21.5" cy="22.5" r="1.8" fill="#fff"/></svg>`;

export function mount(root) {
  root.querySelector("[data-login]").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const user = S.USERS.find((u) => u.email.toLowerCase() === String(f.get("email")).trim().toLowerCase());
    if (!user || f.get("password") !== PASSWORD) return toast("Неверная почта или пароль", "bad");
    enter(user);
  });
  root.querySelectorAll("[data-user]").forEach((b) => b.addEventListener("click", () => enter(S.USERS.find((u) => u.id === b.dataset.user))));
  animateRides(root.querySelector(".login__map svg"), RIDES, { speed: 0.03 });
  fetch("data/analytics.json").then((r) => r.json()).then((d) => {
    const v2 = d.releases.find((r) => r.name === "v2.0");
    if (v2) root.querySelector("[data-otif]").textContent = `${v2.otif.toFixed(1).replace(".", ",")} %`;
    root.querySelector("[data-orders]").textContent = d.months.reduce((a, m) => a + m.orders, 0).toLocaleString("ru-RU");
  }).catch(() => {}).finally(() => countUp(root.querySelector(".login__cards")));
}

function enter(user) {
  S.login(user.id);
  location.hash = "#/";
}
