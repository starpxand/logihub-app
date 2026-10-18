"""Сквозной тест веб-приложения ЛогиХаб через интерфейс (Playwright + Chrome).

Проходит весь BPMN-процесс по ролям: заявка → уточнение → договор-счёт → оплата → комплектация с докомплектованием →
ТТН → назначение транспорта → рейс → отклонение от графика и перепланирование → доставка → претензия → закрытие и OTIF;
отдельно – автоотмена неоплаченного заказа по таймеру (шлюз 9) и отсутствие горизонтальной прокрутки на телефоне.

Запуск:  python -m http.server 8770   (в корне репозитория)
         python tests/e2e.py [http://127.0.0.1:8770/]
"""
import os
import sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8770/"
results = []


def step(name):
    def wrap(fn):
        def run(*a):
            try:
                fn(*a)
                results.append(("OK", name))
            except Exception as e:  # noqa: BLE001 – протокол фиксирует любую ошибку
                results.append(("FAIL", f"{name}: {e}"))
                raise
        return run
    return wrap


def login(pg, user):
    pg.goto(BASE + "#/login")
    pg.wait_for_selector(f'[data-user="{user}"]')
    pg.click(f'[data-user="{user}"]')
    pg.wait_for_selector(".side")


def logout(pg):
    pg.click("[data-logout]")
    pg.wait_for_selector(".login")


def modal_ok(pg):
    pg.click(".modal__foot button[type=submit]")
    pg.wait_for_selector(".modal", state="detached")


def act(pg, name):
    pg.click(f'[data-act="{name}"]')


def status(pg, oid):
    return pg.evaluate(f"JSON.parse(localStorage.getItem('logihub-app/v1')).orders.find(o => o.id === {oid}).status")


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel=os.environ.get("PW_CHANNEL", "chrome") or None)
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE + "#/login")
        pg.evaluate("localStorage.clear()")
        oid = None

        @step("1–2, 6. Клиент оформляет заявку, стоимость считается автоматически")
        def t1():
            nonlocal oid
            login(pg, "u-client")
            pg.goto(BASE + "#/new")
            pg.select_option("[name=destination]", "Владивосток")
            pg.fill("[name=address]", "ул. Портовая, 7")
            pg.fill("[name=recipient]", "РЦ «ДальФуд», Владивосток")
            pg.fill("[name=phone]", "+7 914 205-18-44")
            pg.click("label.chip-radio:has(input[value='Медикаменты'])")
            pg.fill("[name=weight]", "800")
            pg.fill("[name=places]", "6")
            expect(pg.locator("[data-total]")).not_to_have_text("—")
            assert "Рефрижератор" in pg.inner_text("[data-calc]"), "для медикаментов должен быть рефрижератор"
            pg.click("[data-new] button[type=submit]")
            pg.wait_for_url("**#/order/*")
            oid = int(pg.url.rsplit("/", 1)[1])
            assert status(pg, oid) == "new"
            logout(pg)

        @step("3–5. Менеджер возвращает заявку на уточнение, клиент уточняет (цикл)")
        def t2():
            login(pg, "u-manager")
            pg.goto(BASE + f"#/order/{oid}")
            act(pg, "clarify"); modal_ok(pg)
            assert status(pg, oid) == "clarify"
            logout(pg)
            login(pg, "u-client")
            pg.goto(BASE + f"#/order/{oid}")
            act(pg, "resubmit"); modal_ok(pg)
            assert status(pg, oid) == "new"
            logout(pg)

        @step("4, 7. Менеджер подтверждает заявку – формируется договор-счёт")
        def t3():
            login(pg, "u-manager")
            pg.goto(BASE + f"#/queue/{oid}")
            act(pg, "approve")
            pg.wait_for_timeout(300)
            assert status(pg, oid) == "confirmed"
            pg.goto(BASE + f"#/doc/contract/{oid}")
            expect(pg.locator(".paper")).to_contain_text(f"Договор-счёт № {oid}")
            logout(pg)

        @step("8–9. Клиент согласует и оплачивает счёт")
        def t4():
            login(pg, "u-client")
            pg.goto(BASE + f"#/order/{oid}")
            act(pg, "agree"); pg.wait_for_timeout(200)
            act(pg, "pay"); modal_ok(pg)
            assert status(pg, oid) == "paid"
            logout(pg)

        @step("10–13. Склад: комплектация, недовложение → докомплектование → ТТН")
        def t5():
            login(pg, "u-warehouse")
            pg.goto(BASE + f"#/picking/{oid}")
            act(pg, "pick"); pg.wait_for_url(f"**#/picking/{oid}")
            pg.click("[data-scan-all]"); pg.wait_for_timeout(300)
            missing = pg.evaluate(f"JSON.parse(localStorage.getItem('logihub-app/v1')).orders.find(o => o.id === {oid}).picking.some(i => i.missing)")
            if missing:
                assert pg.locator("[data-ttn]").is_disabled(), "ТТН должна быть заблокирована при недовложении"
                pg.click("[data-restock]"); pg.wait_for_timeout(300)
                pg.click("[data-scan-all]"); pg.wait_for_timeout(300)
            pg.click("[data-ttn]"); modal_ok(pg)
            assert status(pg, oid) == "ready"
            logout(pg)

        @step("14. Диспетчер строит маршрут и назначает транспорт")
        def t6():
            login(pg, "u-dispatcher")
            pg.goto(BASE + f"#/order/{oid}")
            act(pg, "assign"); modal_ok(pg)
            drv = pg.evaluate(f"JSON.parse(localStorage.getItem('logihub-app/v1')).orders.find(o => o.id === {oid}).driverId")
            assert drv, "водитель не назначен"
            logout(pg)
            # рейс проводим под демо-учётной записью водителя (Никитин, id 1): переназначаем заказ в данных и перезагружаем
            pg.evaluate(f"(() => {{ const s = JSON.parse(localStorage.getItem('logihub-app/v1')); s.orders.filter(o => o.driverId === 1 && ['ready','in_transit','delayed'].includes(o.status) && o.id !== {oid}).forEach(o => o.driverId = 6); s.orders.find(o => o.id === {oid}).driverId = 1; localStorage.setItem('logihub-app/v1', JSON.stringify(s)); }})()")
            pg.reload()


        @step("15–17. Водитель начинает рейс, передаёт геопозицию, срабатывает таймер отклонения")
        def t7():
            login(pg, "u-driver")
            pg.goto(BASE + "#/trip")
            act(pg, "start"); pg.wait_for_timeout(200)
            assert status(pg, oid) == "in_transit"
            act(pg, "advance"); pg.wait_for_timeout(200)
            act(pg, "delay"); modal_ok(pg)
            assert status(pg, oid) == "delayed"
            logout(pg)

        @step("18. Диспетчер перепланирует маршрут и уведомляет клиента")
        def t8():
            login(pg, "u-dispatcher")
            pg.goto(BASE + f"#/order/{oid}")
            act(pg, "replan"); modal_ok(pg)
            assert pg.evaluate(f"JSON.parse(localStorage.getItem('logihub-app/v1')).orders.find(o => o.id === {oid}).delay.resolved")
            logout(pg)

        @step("19. Водитель доставляет груз")
        def t9():
            login(pg, "u-driver")
            pg.goto(BASE + "#/trip")
            act(pg, "deliver"); pg.wait_for_timeout(200)
            assert status(pg, oid) == "delivered"
            logout(pg)

        @step("20–21, 23–26. Клиент подаёт претензию, менеджер урегулирует, заказ закрыт, OTIF пересчитан")
        def t10():
            login(pg, "u-client")
            pg.goto(BASE + f"#/order/{oid}")
            act(pg, "claim")
            pg.fill(".modal [name=text]", "Не хватает одного грузового места")
            modal_ok(pg)
            assert status(pg, oid) == "claim"
            logout(pg)
            login(pg, "u-manager")
            pg.goto(BASE + f"#/order/{oid}")
            act(pg, "decide"); modal_ok(pg)
            assert status(pg, oid) == "closed"
            otif = pg.evaluate(f"JSON.parse(localStorage.getItem('logihub-app/v1')).orders.find(o => o.id === {oid}).otif")
            assert otif == 0, "при урегулированной претензии In Full = 0, значит OTIF = 0"
            logout(pg)

        @step("9. Таймер: неоплаченный за 3 дня заказ отменяется автоматически")
        def t11():
            login(pg, "u-client")
            o2 = pg.evaluate("JSON.parse(localStorage.getItem('logihub-app/v1')).orders.find(o => o.status === 'confirmed').id")
            pg.click("[data-demo]")
            pg.click("label.chip-radio:has(input[value='72'])")
            modal_ok(pg)
            pg.wait_for_timeout(300)
            assert status(pg, o2) == "cancelled", "заказ должен быть отменён по таймеру"
            logout(pg)

        @step("22. Клиент подписывает акт без замечаний – заказ закрыт")
        def t12():
            login(pg, "u-client")
            o3 = pg.evaluate("JSON.parse(localStorage.getItem('logihub-app/v1')).orders.find(o => o.status === 'delivered').id")
            pg.goto(BASE + f"#/order/{o3}")
            act(pg, "accept")
            pg.check(".modal input[type=checkbox]")
            modal_ok(pg)
            assert status(pg, o3) == "closed"
            logout(pg)

        @step("Мобильная ширина 390 px: нет горизонтальной прокрутки")
        def t13():
            m = b.new_page(viewport={"width": 390, "height": 844})
            m.goto(BASE + "#/login"); m.wait_for_timeout(400)
            assert m.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "горизонтальная прокрутка на экране входа"
            m.click('[data-user="u-client"]'); m.wait_for_timeout(600)
            for r in ["#/overview", "#/new", "#/orders", "#/track", f"#/order/{oid}", "#/docs", "#/claims", "#/process"]:
                m.evaluate(f"location.hash = {r!r}"); m.wait_for_timeout(400)
                over = m.evaluate("document.querySelector('.main').scrollWidth > document.querySelector('.main').clientWidth + 1")
                assert not over, f"горизонтальная прокрутка на {r}"
            m.close()

        for t in (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13):
            t()
        assert not errors, f"ошибки JavaScript: {errors[:3]}"
        b.close()


if __name__ == "__main__":
    try:
        main()
    finally:
        for r, name in results:
            print(f"[{r}] {name}")
        print(f"Итого: {sum(r == 'OK' for r, _ in results)} из {len(results)} проверок пройдено")
