// D1 · Вход в систему – точка входа для всех дорожек BPMN; роль определяется учётной записью.
import * as S from "../store.js";
import { icon, esc, avatar, toast } from "../ui.js";

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
      <img src="assets/img/login_hero.jpg" alt="Логистический хаб ЛогиХаб с высоты">
      <div class="login__stat"><span class="pill">OTIF · релиз v2.0</span><b data-otif>87 %</b><p>поставок доставлены точно в срок и в полном объёме</p></div>
      <span class="login__bpmn">Точка входа для всех дорожек BPMN</span>
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
  fetch("data/analytics.json").then((r) => r.json()).then((d) => {
    const v2 = d.releases.find((r) => r.name === "v2.0");
    if (v2) root.querySelector("[data-otif]").textContent = `${Math.round(v2.otif)} %`;
  }).catch(() => {});
}

function enter(user) {
  S.login(user.id);
  location.hash = "#/";
}
