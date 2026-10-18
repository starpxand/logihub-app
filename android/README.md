# Android-приложение «ЛогиХаб»

Нативная обёртка веб-приложения: `WebView` раздаёт файлы из ассетов APK по адресу
`https://appassets.androidplatform.net/assets/www/` (`WebViewAssetLoader`), поэтому ES-модули, localStorage
и офлайн-работа устроены так же, как на сайте. Код экранов один – файлы из корня репозитория копируются
в APK задачей Gradle `copyWeb` при каждой сборке.

| Возможность | Реализация |
|---|---|
| Офлайн-работа | всё приложение внутри APK, сеть нужна только для шрифтов и внешних ссылок |
| Печать документов (договор-счёт, ТТН, акт…) | мост `LogiHubAndroid.print()` → системная печать Android (PDF или принтер) |
| Фото к претензии | выбор файла из галереи/камеры (`onShowFileChooser`) |
| Ссылки на Telegram-ботов, wiki, GitHub, телефон получателя | открываются во внешних приложениях |
| Кнопка «Назад» | история экранов приложения |

Пакет `ru.logihub.app`, версия 1.0.0, Android 7.0+ (minSdk 24), targetSdk 34.

## Сборка

Нужны JDK 17+, Android SDK (platform 34, build-tools 34) и Gradle 8.9.

```bash
cd android
echo "sdk.dir=/путь/к/AndroidSdk" > local.properties      # в Windows – прямые слэши: D:/AndroidSdk
gradle assembleRelease                                       # APK: app/build/outputs/apk/release/app-release.apk
```

Релиз подписывается ключом из `android/keystore.properties` (файл и ключ в git не хранятся);
без него сборка подписывается отладочным ключом.

## Установка на телефон

Скачайте `LogiHub-1.0.0.apk` из [релизов](https://github.com/starpxand/logihub-app/releases/latest),
откройте файл на телефоне и разрешите установку из этого источника.
Через USB: `adb install LogiHub-1.0.0.apk` (на Xiaomi/MIUI нужно включить «Установка через USB» в параметрах разработчика).
