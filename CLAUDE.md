# logihub-app – заметки для Claude

- Веб-приложение «ЛогиХаб» (вариант 15, РГР «Чат-бот, дашборд, приложение»): статический SPA без сборки – index.html + css/app.css + js/*.js (ES-модули), хэш-маршрутизация.
- Реализует макет logihub-design (10 экранов D1–D8, M1–M2) и все 26 этапов BPMN; статусы/переходы/тарифы – как в logihub-telegram-bot (storage.py, pricing.py). Менять согласованно.
- Данные – localStorage `logihub-app/v1` (демо, version в seed()); аналитика – data/analytics.json из logihub-dashboard (tools/build_data.py).
- Проверка: `python -m http.server 8770` + `python tests/e2e.py` (13 проверок), кадры – D:\Projects\logihub\_tools\appshot.py.
- Публикация: GitHub Actions ci.yml – e2e, затем Pages из main. Ветки main / development / feature/*.
- APK: android/ (WebView + WebViewAssetLoader), сборка Gradle 8.9 из D:\Gradle, SDK D:\AndroidSdk, JDK D:\Temurin21; ассеты копирует задача gradle из корня.
