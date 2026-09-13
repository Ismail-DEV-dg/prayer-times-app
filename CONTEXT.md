# CONTEXT.md — полный контекст проекта prayer-times-app

> **Назначение этого файла**: новая сессия OpenCode читает его ПЕРВЫМ и сразу
> понимает состояние проекта, не начиная анализ заново. Второй источник —
> `FINAL_REPORT.md` (исторический отчёт по итерациям); этот файл — оперативный.

> **Правило для следующего AI-агента**: перед началом новой задачи сначала
> прочитай CONTEXT.md и FINAL_REPORT.md, затем проверь соответствующие исходные
> файлы. НЕ предполагай, что информация из отчёта актуальна — сверяй критические
> места с кодом. Не переписывай существующую рабочую архитектуру только потому,
> что можно сделать иначе. Сначала определи минимальное изменение, необходимое
> для текущей задачи.

Дата обновления: 2026-09-13 (конец итерации 7 — Global Official Prayer
Source Resolver: добавлен ДУМ РТ, верифицированы Чечня/Ставрополь/ЦДУМ/
Diyanet/MUIS и др.).
PROJECT STATUS: итерация 7 ВНЕСЕНА, СОХРАНЕНА и ПРОВЕРЕНА. Registry
пополнился второй территориальной REGION-записью: ДУМ Республики
Татарстан (dumrt.ru, машиночитаемый per-district CSV, 44 слага,
730 строк = 2025+2026, semicolon). fetchType "dumrt_csv" добавлен в
fetchFromOfficial (prayerApi.js). Resolver/chain/AUTO/MANUAL/cache —
БЕЗ ИЗМЕНЕНИЙ (архитектура итерации 5 подтверждена универсальной:
новый регион = одна запись, ноль изменений resolver). Причина
«Grozny → ДУМ РФ» установлена: НЕ баг — в registry нет подтверждённого
источника Чечни (dumchr.ru = клиентский калькулятор PrayTimes.js +
TLS истёк 2026-03-21; grozny-inform.ru/namaz = 410) → AUTO честно
падает на расчётный метод по стране (14). Все тесты зелёные: 30
логических + 23 source-system (6 новых T18–T23, вкл. онлайн T20–T22
с реальным CSV ДУМ РТ и REGRESSION T23 Derbent→Муфтият) + синтаксис
+ bundle 3.25 MB. Предыдущее: 6 — редизайн Киблы; 5e — FIX навигации;
5c — fade_from_bottom стеков; 5b — микро-анимации.

Переходы (итог 5e — см. выше): стековые экраны — нативный `fade_from_bottom`
320–350 мс (root и settings стеки, screenOptions); таб-группа — МГНОВЕННЫЙ
`animation: "none"` (two-state режим bottom-tabs; НЕ возвращать кастомный
transitionSpec/sceneStyleInterpolator — ломает навигацию на Android,
см. §0.6e / DO NOT CHANGE). Добавление/удаление городов — нативный
LayoutAnimation (220–240 мс, Android experimental flag включён один раз).
Микро-анимации (5b, все на useNativeDriver): NextPrayer entrance+пульс-dot+
glint/shadow; PrayerCard stagger-каскад; SourceInfoToast spring-подъём.
Countdown верифицирован с официальным и расчётным источниками в 3 TZ
(инварианты VALID, код не менялся).

---

## 1. PROJECT STATUS

- Приложение время намаза: расписание (6 строк), города, мечети (OSM),
  Кибла (компас + NOAA), Коран (текст + аудио), настройки, Light/Dark/System.
- Итерация 7 (последняя): ДУМ Республики Татарстан — вторая REGION-запись
  registry (per-district CSV dumrt.ru, fetchType "dumrt_csv"); resolver/
  chain/AUTO/MANUAL/cache без изменений (архитектура 5 универсальна);
  верифицированы Чечня/Ставрополь/ЦДУМ/Diyanet/MUIS и др. — НЕ
  зарегистрированы (нет подтверждённого машиночитаемого источника);
  «Grozny → расчётный метод 14» = ожидаемое поведение, НЕ баг. Ранее:
  6 — редизайн экрана Киблы (минималистичный круг, световой луч native
  driver, zero setState, unwrapped-угол, иконка Каабы, мягкая фиксация
  1.6 с; lock-логика в utils/qiblaLock.js, 30 unit-тестов; математика
  направления НЕ тронута); 5e — FIX навигации (таб-анимация 5d откачена,
  animation: "none"); 5c — плавные переходы стековых экранов +
  LayoutAnimation списков городов; 5b — микро-анимации +
  countdown-верификация; 5 — территориальный registry + AUTO/MANUAL fix;
  4 — Official Prayer Source System (resolver, интеграция Муфтията
  Дагестана).
- Production bundle собирается (Hermes HBC 3.25 MB).
- Проект НЕ git-репозиторий (Git — будущая задача, см. LAST SESSION).

## 2. STACK (зафиксировано, НЕ обновлять)

- Expo ~54.0.0, React Native 0.81.5, react 19.1.0, expo-router ~6.0.0.
- @react-native-async-storage/async-storage 2.2.0.
- expo-av ~16.0.8 (аудио аятов; НЕ менять на expo-audio).
- expo-sensors ~15.0.8, expo-location ~19.0.0, expo-linking ~8.0.0,
  expo-constants ~18.0.0, expo-font ~14.0.12, expo-status-bar ~3.0.0.
- react-native-maps 1.20.1, react-native-screens ~4.16.0,
  react-native-safe-area-context ~5.6.0.
- @expo/vector-icons ^15.0.3, react-native-web ^0.21.0 (web).
- devDependencies: @babel/core ^7.25.0 (sucrase в транзитивных node_modules).
- `"test": "node scripts/run-tests.js"`.
- НИ ОДНА зависимость за все сессии не обновлялась и не добавлялась.

## 3. ARCHITECTURE (основные системы)

```
app/_layout.js                корневой Stack, initialRouteName "(tabs)"
app/(tabs)/                   Главная / Местоположение / Настройки
app/mosques.js, qibla.js, quran.js, surah/[number].js, settings/*
services/                     API-слои: prayerApi, officialSources, mosquesApi,
                              qiblaApi, quranApi, geocodingApi, locationApi,
                              networkDiagnostics
utils/AppDataContext.js       центральное состояние (см. §4)
components/                   UI: SourceBadge, SourceInfoToast, CitySearch, ...
theme/                        colors.js, ThemeContext.js
scripts/run-tests.js          30 логических тестов (npm test)
scripts/test-prayer-sources.js  23 теста системы источников (node scripts/...)
scripts/network-benchmark.js   benchmark источников
```

## 4. LOCATION MODEL (НЕ ломать)

ТРИ сущности (AppDataContext):
- `currentLocation` — GPS телефона; ТОЛЬКО мечети, Кыбла, «определить город».
- `selectedCity` — город расписания: { name, country, region, latitude,
  longitude, timezone, fromGps }. Определяет намаз, TZ и источник.
- `savedCities` — список сохранённых (persist).

Инварианты:
- GPS НЕ меняет источник/расписание выбранного города (проверено T13).
- timezone расписания = timezone selectedCity (никогда телефона).
- normalizeCity сохраняет region (admin1 геокодера) — критично для resolver'а.

## 5. PRAYER SOURCE SYSTEM (итерация 5 — актуальное)

Файлы: `services/officialSources.js` (territorial registry + resolver),
`services/prayerApi.js` (fetch-цепочка + dispatch), `utils/AppDataContext.js`
(AUTO/MANUAL, кэш-ключи).

Иерархия приоритетов:
```
OFFICIAL CITY (specificity 3)
  ↓ нет
OFFICIAL REGION / MUFTIATE (2)
  ↓ нет
OFFICIAL COUNTRY (1)
  ↓ нет
CALCULATION API (AlAdhan; метод по стране: РФ→14 ДУМ России, СА→4 и т.д.)
  ↓ ошибка сети
CACHE / offline-кэш на сутки (с пометкой «Сохранённое расписание»)
```

Registry — ТЕРРИТОРИАЛЬНЫЙ (не «город → источник»): запись описывает
область действия источника:
```
{ id, sourceName, sourceLevel: "city"|"region"|"country",
  sourceType, sourceUrl, fetchType, priority,
  country, region, city,       // строка | RegExp | предикат
  resolveCity({name,region,latitude,longitude}) -> params | null }
```
- `priority` (выше = раньше) разрешает конфликты ВНУТРИ одного уровня.
- `fetchType` диспетчеризуется в `fetchFromOfficial` (prayerApi.js);
  текущие: `"muftiyat_rd_json"` (JSON Муфтията) и `"dumrt_csv"` (CSV ДУМ РТ).
  Неизвестный fetchType → честный пропуск (null → следующая запись chain).

Resolver `resolvePrayerSource(city)`:
1. собирает ВСЕ применимые записи (страна → регион → город);
2. сортирует (specificity desc, priority desc);
3. возвращает `{ source, resolved, specificity, chain }` | null.
`fetchPrayerTimes` в AUTO перебирает `chain` по порядку; сбой любой
записи → следующая, затем расчётный API. Работает для любой страны.

AUTO vs MANUAL (устранён stale-closure баг итерации 4 — режим решает
ТОЛЬКО аргумент, `loadPrayerTimes` deps `[]` и не читает state):
- method = null → AUTO: resolver → цепочка → страна-метод AlAdhan.
- method = число (Number.isFinite) → MANUAL: сразу AlAdhan с этим
  методом; resolver НЕ запускается.
- Кэш-ключ = "auto" | String(method) — кэши режимов не смешиваются.
- MANUAL→AUTO: `resetMethodToAuto()` удаляет ключ (`removeMethod`),
  сбрасывает methodOverridden, перезагружает через resolver.
- Ручной выбор НИКОГДА не заменяется resolver'ом (T11).
- Рестарт: AUTO остаётся AUTO (ключа нет), MANUAL остаётся MANUAL (T16).

Правила применимости (Дагестан — запись muftiyat_rd):
- страна: Россия/Russia (предикат); регион: «Дагестан» ИЛИ название
  района Дагестана (isDagestanRegionName — геокодеры отдают обе формы);
- город → slug: имя в DAGESTAN_SLUGS (вкл. «…ский район»), иначе
  ближайший якорь района ≤55 км (27 якорей);
- файлы районов отличаются на ~1–2 мин; для сёл без своего файла это
  честное официальное расписание соседнего/своего района.

Правила применимости (Татарстан — запись dum_rt, итерация 7):
- страна: Россия/Russia (предикат); регион: «Татарстан» / «Республика
  Татарстан» / Tatarstan (isTatarstanRegionName);
- город → slug: имя в TATARSTAN_SLUGS (44 слага), иначе ближайший якорь
  района ≤100 км (якоря = центры районов; регион-gate отсекает соседей);
- CSV: semicolon, 730 строк = 2025+2026; колонки по рендер-JS самого
  сайта: [0] дата dd.mm.yyyy, [2] Fajr, [3] Sunrise, [5] Dhuhr
  (официальное фиксированное время мечети 12:00), [6] Asr, [7] Maghrib,
  [8] Isha; Зәвәл [4] — справочный solar noon, НЕ Dhuhr; валидация:
  ≥300 строк данных + все 6 времён HH:MM, иначе ошибка → дальше по цепочке.

## 6. OFFICIAL SOURCES REGISTRY (фактические записи)

`OFFICIAL_PRAYER_SOURCES` (services/officialSources.js):

| id | Уровень | Территория | Источник | fetchType | Статус |
|---|---|---|---|---|---|
| muftiyat_rd | region | Россия / Дагестан (вкл. районы) | Муфтият Республики Дагестан, `https://muftiyatrd.ru/json/namaz/{slug}.json` | muftiyat_rd_json | ПОДТВЕРЖДЁН 2026-09-12: 27 slug'ов HTTP 200, 365 записей, namaz_1..5 + voshod, индекс dayOfYear-1 |
| dum_rt | region | Россия / Татарстан (вкл. районы) | ДУМ Республики Татарстан, `https://dumrt.ru/netcat_files/482/640/{Slug}.csv` | dumrt_csv | ПОДТВЕРЖДЁН 2026-09-13: 44 slug'а HTTP 200 (text/csv), 730 строк = 2025+2026, semicolon; колонки по рендер-JS сайта (Dhuhr = фиксированное 12:00, Зәвәл = справочный solar noon); priority 100 |

НЕ зарегистрированы (и почему — проверено, не фабрикация):
- Чечня (dumchr.ru): сайт достижим, НО (a) времена считаются клиентски
  калькулятором PrayTimes.org (tm-islamic-helper), а не публикуемое
  расписание; (b) виджет только для Грозного; (c) TLS-сертификат истёк
  2026-03-21 (secure fetch на устройстве упал бы). grozny-inform.ru/
  namaz → HTTP 410. → НЕ зарегистрирован; города Чечни = расчётный
  метод 14 (ДУМ России) — «Grozny → ДУМ РФ» = ОЖИДАЕМОЕ поведение AUTO,
  НЕ баг.
- Ставропольский край (dumsk.com): официальный сайт за JS cookie-стеной
  (beget); времена рендерятся WordPress-калькулятором salat-times;
  машиночитаемого per-city расписания нет → НЕ зарегистрирован.
- ЦДУМ России (cdum.ru): подтверждённые годовые таблицы (данные 2026)
  для ~21 города, но это per-city HTML-страницы = список городов, и
  хрупкость HTML-scraping; города вне списка честно не покрыть → НЕ
  зарегистрирован.
- Diyanet (Турция, namazvakitleri.diyanet.gov.tr): per-district HTML;
  потребовал бы хардкод districtId→URL на 1000+ районов (де-факто
  список городов) → НЕ зарегистрирован; Турция = расчётный метод 13.
- MUIS Singapore / JAKIM Malaysia e-solat / UAE Awqaf: официальные
  сайты есть, подтверждённого машиночитаемого API из этой сети нет
  (e-solat.gov.my DNS не резолвится) → НЕ зарегистрированы.
- Umm al-Qura (СА): нет машиночитаемого API; time.uqu.edu.sa DNS не
  резолвится из сети приложения → Медина/Рияд = расчётный метод 4.
- ДУМ России (dumrf.ru): официальный МЕТОД (AlAdhan id 14), не API
  расписаний → country-level расчётный fallback, НЕ registry-запись.
- namaz.today: HTML, per-city API нет.

## 7. PRAYER DATA FLOW

1. Пользователь выбирает город (поиск Open-Meteo / GPS / чипы) → selectedCity.
2. Home экран → useAppData().prayerData; загрузка: `loadPrayerTimes(city, method)`:
   - method = methodOverridden ? метод : null (AUTO).
   - `fetchPrayerTimes({ lat, lon, method, timezone, country, name, region })`.
3. AUTO: `resolvePrayerSource` → совпадение → `fetchFromOfficial`:
   JSON год Муфтията → день [dayOfYear-1] → 6 строк Fajr/Sunrise/Dhuhr/Asr/
   Maghrib/Isha; валидация 365 записей + все 6 времён HH:MM, иначе ошибка →
   дальше по цепочке. Хиджра — локальный Kuwaiti-алгоритм (algorithmic).
4. Нет совпадения/ошибка → AlAdhan `/v1/timings/{dd-mm-yyyy}` (дата в TZ города),
   метод = ручной или страна-дефолт; source = «Расчётное расписание (…)».
5. Сбой сети → кэш на сутки (AsyncStorage) с пометкой offline-cache.
6. UI: 6 PrayerCard + NextPrayer (Sunrise исключён из «следующего намаза»),
   countdown и «сейчас» в TZ города (Intl API).

## 8. FALLBACKS (все механизмы)

| Система | PRIMARY | FALLBACK |
|---|---|---|
| Намаз (AUTO, Дагестан) | Муфтият JSON | AlAdhan метод 14 → offline-кэш |
| Намаз (AUTO, Татарстан) | ДУМ РТ CSV | AlAdhan метод 14 → offline-кэш |
| Намаз (AUTO, остальное) | AlAdhan страна-метод | offline-кэш |
| Намаз (MANUAL) | AlAdhan ручной метод | offline-кэш |
| Мечети | overpass-api.de (кастомный User-Agent!) | overpass.kumi.systems (НЕ удалять) |
| Коран текст | api.alquran.cloud | честная ошибка «Не удалось загрузить» |
| Коран аудио | everyayah.com (папки с ПОДЧЁРКИВАНИЕМ: Alafasy_128kbps и т.п.) | cdn.islamic.network 64kbps (ОДНА попытка) |
| Кыбла склонение | NOAA geomag-web | true north 0° с пометкой |
| Города | Open-Meteo geocoding | — |

Аудио-принципы (итерация 3, НЕ менять): hook не импортирует источники;
fallback — опциональная строка-аргумент; ровно одна попытка fallback;
playTokenRef/mountedRef против unmount/race (T1–T10 в %TEMP% харнессе).

## 9. MOSQUES

- ТОЛЬКО от currentLocation (GPS), радиус 5 км, OSM Overpass
  (amenity=place_of_worship + religion=muslim, node+way+relation, out center tags;).
- Кастомный User-Agent обязателен (иначе 406).
- Тихий фоновый prefetch раз за сессию в AppDataContext (после GPS) →
  mosquesCache { key, list }; экран мечетей показывает кэш или ищет сам.
- НЕ влияет на prayer times (разделение потоков данных).

## 10. QIBLA (экран, итерация 6)

- МАТЕМАТИКА (НЕ трогать): bearing great-circle от currentLocation к Каабе
  (21.4225, 39.8262); Хельсинки ≈ 158.2–161° (математически ~158.5°),
  Лондон ≈ 119°. Magnetometer + склонение NOAA → истинный север;
  screenAngle = (bearing − trueHeading + 360) % 360 — как раньше.
  services/qiblaApi.js нетронут (все 19 его unit-тестов PASS).
- ВИЗУАЛ (итерация 6): минималистичный круг без рисок/градусов/стрелок/
  зелёной метки; единственный движущийся элемент — мягкий световой луч
  от центра к направлению (4 сегмента-градиент + halo, native driver);
  иконка Каабы (тёмный куб с золотой лентой) на кольце сверху; бейдж
  «Кибла» проявляется при фиксации (native Animated opacity).
- ПЛАВНОСТЬ: сенсор 30 мс, callback = только дешёвая математика →
  push Animated.timing(useNativeDriver) target 90 мс linear — ZERO
  setState/re-render при вращении (старая версия: 100 мс setState ×
  re-render всей сцены = «30 FPS»). Угол аккумулируется UNWRAPPED
  (никогда не берётся % 360) → нет скачка через 0/360.
- ФИКСАЦИЯ (utils/qiblaLock.js, чистая state-машина, 6 unit-тестов):
  выравнивание ≤3° держится 5 тиков (~150 мс) → lock (луч мягко
  фиксируется на иконке, ease 450 мс, halo ярче, бейдж «Кибла»);
  hold 1.6 с → плавное освобождение (glow 300 мс). Заметное вращение
  >8° при lock → мгновенный release (интерфейс не «замерзает»);
  re-arm только после ухода >6° (нет lock/unlock-флаппинга).
- НЕТ сенсора → честная пометка (без живого компаса), bearing-карточка
  с расчётным углом остаётся.

## 11. QURAN

- Список 114 сур с поиском; сура — FlatList аятов (арабский Uthmani RTL
  selectable + перевод Кулиева ru.kuliev).
- api.alquran.cloud editions quran-uthmani + ru.kuliev; мисматч нумерации
  аятов между изданиями → ошибка, не подстановка.
- numberInSurah точный; текст никогда не генерируется локально.

## 12. AUDIO

- `hooks/useAyahAudio.js`: РОВНО ОДИН Sound (expo-av ~16.0.8), API
  play/stop/playingKey/loadingKey/errorKey/paused; play(url, key, fallbackUrl=null).
- PRIMARY everyayah.com `data/{Folder}/{SSS}{AAA}.mp3` (сура/аят zero-pad 3,
  папки: Alafasy_128kbps, Husary_128kbps, Minshawy_Murattal_128kbps — БЕЗ
  подчёркивания 404!). FALLBACK cdn.islamic.network `quran/audio/64/{id}/{global}.mp3`.
- lifecycle: mountedRef (unmount → no-op), playTokenRef (устаревший createAsync
  → unloadAsync, не сохраняется); didJustFinish только для текущего Sound.
- fallback: ошибка PRIMARY → ровно ОДНА попытка FALLBACK; обе упали → errorKey.
- Чтецы: ar.alafasy (дефолт), ar.husary, ar.minshawi; ключ
  @prayer_times/audio_reciter.

## 13. SETTINGS

- `(tabs)/settings` → полный экран `app/settings/index.js`:
  Общие (Тема) / Местоположение (город расписания, GPS-позиция, сохранённые) /
  Намаз («Источник и метод» → app/settings/method.js; переопределить GPS).
- `app/settings/method.js` «Источник и метод»: опция «Автоматически»
  (подпись = что AUTO выберет сейчас: источник registry или страна-метод) +
  список ручных методов CALCULATION_METHODS. AUTO ⇄ MANUAL разделены явно.
- `app/settings/theme.js` — Light/Dark/System.
- Метод: AsyncStorage @prayer_times/method; null → AUTO.

## 14. NAVIGATION

- initialRouteName "(tabs)" в app/_layout.js (всегда Главная) — НЕ трогать.
- Таб-группа `app/(tabs)/_layout.js`: `animation: "none"` (мгновенные
  переключения). НЕ добавлять transitionSpec/sceneStyleInterpolator —
  на Android (react-native-screens) реальный переход держит оба экрана
  прикреплёнными, и ScreenContainer пере-attach'ит старый экран поверх
  нового → «табы открывают чужие экраны» (поломка 5d, FIX 5e).
- GO_BACK-guard на всех стековых экранах: canGoBack ? back : replace("/")
  (surah → /quran; settings/index → /(tabs)/settings).
- Стек: /mosques, /qibla, /quran, /surah/[number], /settings/*.

## 15. DATA / CACHE

AsyncStorage ключи (@prayer_times/*):
- selected_city (JSON selectedCity; миграция с legacy city),
- saved_cities (список), theme, method (ручной метод; отсутствие = AUTO),
- prayer_cache ({ key: cityId, method, payload, cachedAt } — сутки свежести,
  день сравнивается в TZ города), audio_reciter.
- cityId = name|country|lat(0.01°)|lon(0.01°).

## 16. TESTS (какие есть и результаты)

| Набор | Команда | Результат (последний прогон 2026-09-13, итерация 7) |
|---|---|---|
| Логические (qibla/hijri/city/time + qiblaLock 6) | `npm test` | 30/30 PASS |
| Система источников (offline + online) | `node scripts/test-prayer-sources.js` | 23/23 PASS (итерация 7; вкл. 6 новых T18–T23: T18 Казань→ДУМ РТ, T19 село без slug→якорь района, T20–T22 онлайн с реальным CSV ДУМ РТ (Казань, Набережные Челны, битый источник→честный fallback), T23 REGRESSION Derbent→Муфтият; история: T8/T9 транзиентно сбояли в итерациях 5–6 — сеть, повторно PASS) |
| Кибла runtime-смоук (структура+сенсор+lock) | `%TEMP%\opencode\qibla-smoke\qibla-screen-smoke.js` (sucrase + моки RN) | 21/21 PASS (итерация 6; может исчезнуть после чистки %TEMP%) |
| Синтаксис ESM/JSX | `%TEMP%\opencode\syn\check-syntax.js` (sucrase + node --check) | все изменённые файлы OK |
| Audio lifecycle T1–T10 | `%TEMP%\opencode\syn\audio-tests.js` (может исчезнуть после чистки %TEMP%) | 10/10 PASS (итерация 3) |
| Навигационный аудит | `%TEMP%\opencode\nav-audit\nav-route-audit.js` | 69/69 PASS (итерация 5e) |
| Production bundle | `npx expo export --platform android` | OK, Hermes HBC 3.25 MB |
| Сетевой benchmark | `node scripts/network-benchmark.js [quick]` | не запускался в итерациях 4–7 (не требовался) |

Ограничения тестов: ONLINE-тесты — из сети окружения сборки (Node), НЕ на
устройстве; нативный UI не прогонялся (устройства/эмулятора нет).

## 17. KNOWN ISSUES

1. Села Дагестана без своего slug → ближайший районный файл (±1–2 мин от
   «своего» района) — задокументированное ограничение без геометрии границ.
   Аналогично для Татарстана: сёла без своего slug → ближайший якорь
   района ≤100 км (регион-gate «Татарстан» отсекает соседние регионы).
2. Муфтият не отдаёт дату обновления (Last-Modified 2018, кэш CDN);
   актуальность подтверждена косвенно (сезонность + совпадение с расчётом).
   ДУМ РТ CSV: файлы содержат 2025+2026 (730 строк) — к концу 2026 года
   потребуется обновление файлов на стороне источника/ре-верификация.
3. Umm al-Qura: недоступен из сети приложения (DNS) — СА на расчётном методе 4.
4. islamic.network CDN: эпизодические 502 — потому FALLBACK, не PRIMARY.
5. Overpass Kumi: стабильный timeout в сети пользователя, но оставлен как
   последний резерв для других сетей.
6. Аудио/UMI-тесты — Node-симуляции; на устройстве не проверялись (нет устройства).
7. Hijri-дата для официального расписания — алгоритмическая (источник не отдаёт).

## 18. DO NOT CHANGE (без явной необходимости)

- Expo SDK 54 / RN 0.81.5 / список зависимостей / app.json / eas.json /
  babel.config.js / build configuration.
- currentLocation ≠ selectedCity разделение (GPS не трогает расписание).
- Мosques/Overpass архитектуру (Kumi НЕ удалять), Qibla, Quran, навигацию.
- Audio architecture (expo-av, один Sound, тот же публичный API hook'а;
  папки everyayah с подчёркиваниями; одну попытку fallback).
- initialRouteName "(tabs)"; back-guard'ы; мгновенные таб-переключения
  (animation "none" в (tabs)/_layout.js — НЕ возвращать кастомную
  таб-анимацию, см. §14/§0.6e).
- Механику useAyahAudio (mountedRef/playTokenRef) — проходит T1–T10.
- НЕ выдумывать официальные источники/данные; реестр = только подтверждённые.
- Имена сущностей/функций не переименовывать (getAyahAudioUrl,
  getAyahAudioUrlFallback, resolvePrayerSource, OFFICIAL_PRAYER_SOURCES,
  OFFICIAL_SOURCE_REGISTRY-алиас и т.п.).
- Муфтият Дагестана — ТОЛЬКО для Дагестана (не для всей России); ДУМ России —
  country-fallback для остальных городов РФ.

## 19. LAST SESSION (итерации 5, 5b, 5c, 5d, 5e, 6, 7, 2026-09-13)

### Итерация 7 (последняя): ДУМ Республики Татарстан в registry (2026-09-13)

**Задача**: глобальное расширение официальных источников — добавить
следующий подтверждённый региональный источник (Татарстан), сохранить
поведение Дагестана; попутно верифицировать другие кандидатуры (Чечня,
Ставрополь, ЦДУМ, Diyanet, MUIS/JAKIM/UAE, Umm al-Qura, ДУМ РФ) и
объяснить «Grozny → ДУМ РФ».

**Что сделано**:
- `services/officialSources.js` — вторая REGION-запись `dum_rt`:
  ДУМ Республики Татарстан; машиночитаемый per-district CSV
  `https://dumrt.ru/netcat_files/482/640/{Slug}.csv`; 44 слага
  (TATARSTAN_SLUGS), 43 якоря-центра районов (TATARSTAN_ANCHORS),
  регион-gate isTatarstanRegionName («Татарстан» / «Республика
  Татарстан» / Tatarstan), country-предикат Россия/Russia, priority 100.
  Село без своего slug → ближайший якорь района ≤100 км.
- `services/prayerApi.js` — fetchType `"dumrt_csv"` в fetchFromOfficial:
  CSV semicolon, 730 строк = 2025+2026; строка сегодняшней даты
  (dd.mm.yyyy в TZ города); колонки по рендер-JS сайта: [2] Fajr,
  [3] Sunrise, [5] Dhuhr (официальное фиксированное 12:00), [6] Asr,
  [7] Maghrib, [8] Isha; Зәвәл [4] = справочный solar noon, НЕ Dhuhr;
  2025-строки имеют хвостовую колонку Qibla, 2026 — нет (дата в [0]
  решает принадлежность); валидация: ≥300 строк данных + все 6 времён
  HH:MM, иначе API_ERROR → честный fallback дальше по цепочке.
- Resolver/chain/AUTO/MANUAL/cache — БЕЗ ИЗМЕНЕНИЙ: архитектура итерации
  5 подтверждена универсальной (новый регион = одна запись, ноль
  изменений resolver). Дагестан не тронут (T23 REGRESSION).
- Верифицированы онлайн (реальные сетевые проверки, не фабрикация):
  все 44 слага ДУМ РТ HTTP 200 (text/csv), по 730 строк (полные 2025 +
  2026), сегодняшняя строка присутствует; Дербент AUTO → Муфтият
  Дагестана (сохранён); Казань/Набережные Челны AUTO → ДУМ РТ.
- Кандидатуры НЕ зарегистрированы (см. §6): Чечня (dumchr.ru —
  клиентский калькулятор PrayTimes.js + TLS истёк 2026-03-21;
  grozny-inform.ru/namaz = 410), Ставрополь (JS cookie-стена), ЦДУМ
  (per-city HTML, ~21 город), Diyanet (per-district HTML, 1000+
  районов), MUIS/JAKIM/UAE (нет подтверждённого API), Umm al-Qura
  (DNS), ДУМ РФ (метод, не API), namaz.today (HTML). Причина
  «Grozny → ДУМ РФ» установлена: НЕ баг — в registry нет подтверждённого
  источника Чечни → AUTO честно падает на расчётный метод по стране (14).
- `scripts/test-prayer-sources.js` — 6 новых тестов T18–T23:
  T18 Казань → ДУМ РТ (region level); T19 село без slug → якорь района,
  соседи отсечены; T20 (онлайн) Казань AUTO → расписание ДУМ РТ,
  Dhuhr = официальное 12:00; T21 (онлайн) Набережные Челны → тот же
  регион-источник, Москва не затронута; T22 (онлайн) битый источник
  ДУМ РТ → честный расчётный fallback (chain работает для новой записи);
  T23 REGRESSION Derbent → Муфтият Дагестана (не изменён).

**Проверки (все реально выполнены)**:
- `node scripts/test-prayer-sources.js` — 23/23 PASS (17 прежних +
  6 новых T18–T23, вкл. онлайн T20–T22 с реальным CSV ДУМ РТ).
- `npm test` — 30/30 PASS.
- Синтаксис изменённых файлов — OK.
- Production bundle `npx expo export --platform android` — OK
  (Hermes HBC 3.25 MB).
- Derbent AUTO → Муфтият Дагестана — PASS (T23, без регрессий).
- AUTO/MANUAL/cache/иерархия/GPS-разделение — PASS (прежние тесты).
- Device-тест NOT RUN (устройства нет; онлайн-тесты — из сети
  окружения сборки, не устройства).

### Итерация 6: редизайн экрана Киблы (2026-09-13)

**Задача**: переработать визуальный компас (математика направления —
ШИКАРНО, НЕ ТРОГАТЬ): название «Кибла» везде; минималистичный круг без
рисок/градусов/стрелок/чёрного указателя/зелёной метки; иконка Каабы как
ориентир; мягкий световой луч (центр → свет → полоса → иконка Каабы);
фиксация при совмещении ~1–2 с; приоритет №1 — плавность (старый компас
ощущался как 30 FPS).

**Причина лагов старого компаса (найдена, не «дюрация»)**: сенсор 100 мс →
setHeading (setState) каждые 100 мс → re-render ВСЕЙ сцены (10 раз/сек,
включая пересборку 72 тиков лимба useMemo) → вращение через обычный
style-prop transform = JS-поток на каждом кадре = видимые 30 FPS. Плюс
риск скачка через 0/360 (dialRotation = −heading без unwrap).

**Что сделано**:
- `app/qibla.js` — полностью новый ВИЗУАЛ (математика не тронута):
  - Убраны: тики/риски, градусные метки, N-маркер, чёрный треугольник-
    указатель, зелёная метка qiblaMarker, бейдж «Кыбла» у старого компаса.
  - Круг: тонкое кольцо (border 2) — единственная статичная графика.
  - Иконка Каабы: чип 32×32 на кольце сверху (тёмный куб 20×20
    #15181D с золотой лентой #C9A227 — минимализм в стиле приложения).
  - Световой луч: 4 сегмента-градиент (opacity 0.36→0.95 от центра к
    кольцу) + широкий halo 9px за лучом (opacity 0.1) + lock-halo
    (ярче при фиксации, native opacity); всё внутри одного
    Animated.View, вращаемого native driver.
  - Мягкий свет в центре: 4 статичных круга-слоя (88/60/38/12 px,
    убывающая прозрачность) — «свет» источника луча.
  - Бейдж «Кибла» — pill, проявляется ТОЛЬКО при фиксации (native
    Animated opacity + подъём 10px).
- ПЛАВНОСТЬ: сенсор 30 мс (в 3 раза чаще данные), callback = ТОЛЬКО
  дешёвая математика (atan2/mod) + push Animated.timing(90 мс linear,
  useNativeDriver) — ZERO setState/re-render при вращении; интерполяция
  на UI-потоке 60 FPS. Угол аккумулируется UNWRAPPED (свободный угол
  никогда не нормализуется % 360; только screenAngle для lock-логики) —
  скачок через 0/360 невозможен. Никакой добавленной задержки (90 мс
  окно интерполяции < 3 тика сенсора).
- ФИКСАЦИЯ: выравнивание (screenAngle ≤3° от иконки) 5 тиков подряд
  (~150 мс) → lock: луч мягко доводится на иконку (ease-out 450 мс),
  halo ярче, бейдж «Кибла»; hold 1.6 с → плавное освобождение (glow
  300 мс, дальше — свободное слежение). Заметное вращение >8° в lock →
  мгновенный release (интерфейс не «замерзает»); re-arm только после
  ухода >6° (нет lock/unlock-флаппинга при дрожании у иконки).
- `utils/qiblaLock.js` — НОВЫЙ чистый модуль: state-машина фиксации
  (createLockMachine/tick + signedDelta, все константы) без native
  импортов; экран — тонкая обёртка (lock/unlock → Animated).
- «Кыбла» → «Кибла» (через «и») во всех пользовательских строках:
  заголовок экрана, бейдж, hint, карточка bearing, Home-кнопка,
  GPS-примечание на экране локации.
- НЕ ТРОНУТО: services/qiblaApi.js (qiblaBearing/magnetometerToHeading/
  fetchMagneticDeclination — все 19 тестов PASS), геолокация, API,
  другие экраны, навигация, зависимости, Expo/RN.

**Проверки (все реально выполнены)**:
- `npm test` 30/30 (24 старых + 6 новых qiblaLock: signedDelta
  кратчайшая дуга/знак/0-360; lock после 5 тиков удержания + hold 1.6 с;
  мгновенный release при заметном вращении; re-arm только после выхода
  >6°; сброс счётчика при кратком уходе; допуск ±3° через 0/360).
- Кибла runtime-смоук 21/21 (`%TEMP%\opencode\qibla-smoke\qibla-screen-smoke.js`):
  реальный app/qibla.js через sucrase + моки RN/expo — структура (нет
  тиков/градусов/стрелок/зелёного; есть Кааба/луч/свет/бейдж),
  пайплайн сенсора (beam target = bearing − heading, unwrapped шаги
  ≤10°, maxJump через seam = 10° — не 340; ZERO setState на тиках;
  native driver у всех анимаций), lock-поведение (engage/jitter/
  release-on-rotate/re-lock/auto-release 1.6 с), bearing-карточка
  158° (та же математика).
- `scripts/test-prayer-sources.js` 17/17 (T8 дважды транзиентно сбоял —
  сеть muftiyatrd.ru; повторные прогоны PASS; изменения Киблы не
  связаны с source-system).
- Синтаксис app/qibla.js, utils/qiblaLock.js, (tabs)/index.js,
  (tabs)/location.js — OK.
- Production bundle `npx expo export --platform android` — OK
  (Hermes HBC 3.24 MB).
- Device-тест NOT RUN (устройства нет): плавность 60 FPS обеспечивается
  native driver (стандартный механизм RN 0.81), смоук-харнесс проверил
  пайплайн без устройства; реальный магнитометр не прогонялся.

### Итерация 5e: FIX сломанной навигации — откат таб-анимации 5d

**Симптомы (жалоба пользователя)**: «Местоположение» открывает не тот экран;
«Настройки» открывает «Местоположение»; «Главная» открывает неправильный
экран; переходы и маршруты перепутаны.

**Первопричина (полный аудит + симуляция установленных библиотек)**: НЕ
маршруты — все router.push/replace/back, href, initialRouteName, back-guard'ы
и файлы экранов корректны (подтверждено 69-проверочным аудитом). Причина —
кастомная таб-анимация итерации 5d (transitionSpec 320 мс +
sceneStyleInterpolator с разделёнными ролями в `app/(tabs)/_layout.js`).
Механика поломки на Android (react-native-screens): реальный (не "none")
transitionSpec держит ОБА экрана прикреплёнными во время перехода; контейнер
ScreenContainer упорядочивает экраны по порядку attach фрагментов, и его
инкрементальные коммиты пере-attach'ат СТАРЫЙ экран (полностью непрозрачный —
sceneStyle: {}) ПОВЕРХ входящего на остаток перехода → пользователь видит
ПРЕДЫДУЩИЙ таб поверх нового + резкую смену в конце = «каждый таб открывает
чужой экран». При `animation: "none"` (two-state режим) прикреплён ровно
один экран — перепутывание экранов структурно невозможно.

**Что сделано (5e)**: единственный код-файл — `app/(tabs)/_layout.js`:
удалены useFadeFromBottomTabTransition/transitionSpec/sceneStyleInterpolator,
таб-группа возвращена к мгновенному `animation: "none"` (плюс
предупреждающий DO-NOT-CHANGE комментарий с механизмом поломки). Роли/хук
5d не переносились никуда. НИЧЕГО в маршрутах/экранах не менялось — они были
корректны. 5c LayoutAnimation-конфликт в location.js остался как в 5d
(убранный configureNext перед push("/") — правильное поведение и без анимации).

**Проверки (5e, все реально выполнены)**:
- Навигационный аудит 69/69 PASS (resolves, back-guards, initialRouteName,
  таб-названия↔файлы, content-маркеры заголовков, Home-кнопки, отсутствие
  других навигаторов; харнесс в %TEMP%\opencode\nav-audit\nav-route-audit.js).
- Симуляция перехода (BottomTabView+ScreenContainer, 1:1): конфиг 5d —
  «виден СТАРЫЙ экран поверх нового» на каждом переключении; конфиг FIX —
  корректный экран на всех кадрах (nav-audit\tab-transition-sim.js).
- Синтаксис 3 layout-файлов (sucrase + node --check) — OK.
- npm test 24/24; source-system 17/17; production bundle OK (HBC 3.24 MB).
- Device-тест NOT RUN (устройства нет) — но two-state режим библиотечный
  (default всех bottom-tabs до 5d), не самописный.

### Итерация 5c: плавные переходы экранов + анимация списков городов

**Что сделано**: (1) переходы стековых экранов переведены с резкого дефолта
на нативный `fade_from_bottom`: root Stack 350 мс, settings Stack 320 мс,
surah 320 мс (опции native-stack, выполняются на UI-потоке, JS не участвует);
`(tabs)` — `animation: "none"` (корневой якорь). Затронуто: Главная↔Настройки,
/ /mosques, /qibla, /quran, /settings/theme, /settings/method, /surah/[number].
Таб-переключения внизу — системные native Tabs, НЕ менялись (потребовало бы
переписывания таб-навигации). (2) Добавление/удаление городов — нативный
LayoutAnimation (220–240 мс easeOutEaseIn): удаление из списка в location.js
(строка сворачивается, соседи съезжают), выбор из поиска (строка появляется),
toggle «В список городов» на Home (чип CitySwitcher). Android experimental
flag включён один раз в location.js (в Home — inline guard, дублирование
безопасно и идемпотентно). Сознательно НЕ анимировано (перебор для
производительности): чипы при каждой перерисовке, тексты, pull-to-refresh.

**Изменённые файлы (5c)**: `app/_layout.js` (screenOptions animation),
`app/settings/_layout.js` (то же), `app/(tabs)/location.js`
(LayoutAnimation add/remove + flag), `app/(tabs)/index.js`
(LayoutAnimation в toggle-saved + импорты), `FINAL_REPORT.md` (§0.6c),
`CONTEXT.md`.

**Тесты прошли (5c)**: синтаксис 4 файлов OK; npm test 24/24;
source-system 17/17; production bundle OK. Device-тест переходов NOT RUN
(устройства нет; использованы только стандартные механизмы RN 0.81).

### Итерация 5d: 100% покрытие переходов — анимация таб-группы (ОТКАЧЕНА в 5e)

**Что сделано**: полный аудит навигации показал, что единственный
неанимированный навигатор — таб-группа `app/(tabs)/_layout.js` (default
JS bottom-tabs `animation: "none"` → резкая смена). ВСЕ резкие переходы —
переключения внутри (tabs): таб-бар, все `router.push("/location")` и
`router.push("/")` (резолвятся в tab-switch, минуя root Stack). expo-router
v6 Tabs = JS `createBottomTabNavigator` (НЕ native) → добавлены штатные
`transitionSpec` (timing 320 мс, Easing.out(poly 5)) + `sceneStyleInterpolator`
в screenOptions. Унификация плавности (5d-fix, эталон Настройки→Тема):
роли разделены — ВХОДЯЩИЙ (focused) экран fade-in + подъём translateY 8%
высоты окна, ВСЕ остальные (в т.ч. исходящий) — ПОЛНОСТЬЮ статичны
(sceneStyle: {}) — точное зеркалирование нативной пары rns_fade_from_bottom
+ rns_no_animation_350 (ранее двигались оба экрана — встречное движение и
просвет фона давали рывок, заметнее всего на Местоположении). Роль
определяется через navigation.getState() в screenOptions (обход read-during-
render из useNavigationHelpers корректен). Конфликт в location.js устранён:
из handleSelect убран LayoutAnimation.configureNext перед router.push("/")
(anim прилипала к таб-переходу; строка списка всё равно не видна). Хук
`useFadeFromBottomTabTransition()` внутри _layout. Других навигаторов/
модалей в проекте нет (проверено grep).

**Изменённые файлы (5d)**: `app/(tabs)/_layout.js` (единственный код-файл),
`FINAL_REPORT.md` (§0.6d), `CONTEXT.md`.

**Тесты прошли (5d)**: синтаксис OK; npm test 24/24; source-system 17/17
(T9 — транзиентный сетевой сбой в первом прогоне, повторно PASS);
production bundle OK (3.24 MB). Device-тест NOT RUN (устройства нет;
интерполятор — штатный механизм bottom-tabs 7.18, useNativeDriver).

### Итерация 5b: countdown-верификация + микро-анимации

**Что сделано**: (1) верифицировано время «до начала/до следующей молитвы»
с РАЗНЫМИ источниками: реальный JSON Муфтията (Дербент), реальный AlAdhan
метод 14 (Москва) — оба дают корректный next+countdown; граничные случаи
(tomorrow-переход через полночь, TZ America/New_York с negative offset/DST,
одинарный список, malformed-время) — все инварианты VALID (0 ≤ ms < 24h/48h).
Код utils/time.js НЕ менялся — изменения не требовались: он source-agnostic.
(2) Микро-анимации (все Animated + useNativeDriver, логика/навигация нетронуты):
NextPrayer — entrance fade+slide 320 мс, пульсирующая live-точка (loop 0.3→1),
soft shadow elevation 5, декоративный glint-круг; PrayerCard — каскадное
появление (fade+rise, stagger 70 мс × index, передаётся из Home);
SourceInfoToast — spring-подъём вместо резкого popup; tabular-nums у времён.
НЕ тронуто (выглядит хорошо): CitySwitcher, LocationHeader, экраны
Мечетей/Кыблы/Корана, палитра, `active={false}` в гриде (историческое
поведение — подсветку следующей молитвы в гриде ранее не делали, не вводил).

**Изменённые файлы (5b)**: `components/NextPrayer.js` (анимации+shadow+glint),
`components/PrayerCard.js` (stagger+tabular-nums), `components/SourceInfoToast.js`
(spring-подъём), `app/(tabs)/index.js` (только `index={i}` в PrayerCard),
`FINAL_REPORT.md` (§0.6b), `CONTEXT.md`.

**Тесты прошли (5b)**: countdown E2E с живыми данными 2 источников × 3 TZ —
все VALID; npm test 24/24; source-system 17/17; синтаксис 4 файлов OK;
production bundle OK. Device-тест анимаций NOT RUN (устройства нет).

### Итерация 5: территориальный registry, AUTO/MANUAL fix, key warning, дизайн

**Что сделано**: (1) исправлен React key warning (renderRow в method.js
получил стабильный key `method-${id}`, не index); (2) исправлен AUTO/MANUAL:
устранён stale-closure баг loadPrayerTimes (режим решает ТОЛЬКО аргумент
method, deps `[]`) и инвертированный guard «Автоматически»; кэш-ключ
"auto"|String(method); (3) registry переведён на территориальную модель
(sourceLevel city/region/country + priority + fetchType + resolveCity),
resolver собирает все применимые записи, сортирует и возвращает chain,
fetchPrayerTimes перебирает chain с честным fallback; (4) верифицированы
Чечня/Ставрополь — источников нет, НЕ добавлены; (5) лёгкий дизайн-апгрейд:
SourceBadge pill с иконкой типа, экран метода с секциями AUTO/MANUAL и
radio-индикаторами; (6) обновлены тесты (T1/T6/T11/T12, новые T15/T16/T17).

**Почему**: по требованию — warning, неработающий возврат в AUTO (Тегеран →
manual → «Автоматически»), глобальный автоматический выбор официального
источника по территории действия, а не по списку городов; затем — проверка
countdown с разными расчётами и приятные глазу микро-эффекты.

**Изменённые файлы (5)**:
- `services/officialSources.js`: территориальная модель записей, resolver
  со сбором+сортировкой и chain, алиас OFFICIAL_SOURCE_REGISTRY сохранён.
- `services/prayerApi.js`: fetchFromOfficial диспетчеризует по fetchType;
  AUTO перебирает chain; валидация прежняя (365/6×HH:MM).
- `utils/AppDataContext.js`: loadPrayerTimes без чтения state (deps []),
  кэш-ключ по аргументу; selectCityFromGps/selectCity с явными ветками.
- `app/settings/method.js`: key в map, guard `if (methodOverridden)`,
  дизайн (секции, radio, иконки).
- `app/(tabs)/settings.js`, `app/settings/index.js`: честные подписи
  «Автоматически: <источник>» / «Вручную: <метод>».
- `components/SourceBadge.js`: pill-дизайн, иконки по типу источника.
- `scripts/test-prayer-sources.js`: 17 тестов.

**Тесты прошли (5)**: 17/17 source-system (6 онлайн), 24/24 npm test, синтаксис
7 файлов OK, production bundle OK (3.24 MB), код-скан key в .map().
Не запускались: device test (устройства нет), network-benchmark (не требовался).

**Что осталось сделать** (будущие задачи):
- Прогон на реальном устройстве (AUTO/MANUAL переключение UI, resolver,
  дизайн SourceBadge, микро-анимации 5b, переходы экранов и анимация
  списков городов 5c; после 5e — обязательная проверка таб-переключений;
  после 7 — ДУМ РТ CSV на устройстве).
- EAS build / APK при необходимости.
- Подключение Git (git init, первый коммит) — пользователь сказал «позже».
- Перенос audio-харнесса из %TEMP% в scripts/ как постоянные тесты.
- Перенос nav-аудита (nav-route-audit.js + tab-transition-sim.js) из %TEMP%
  в scripts/ при желании сделать его постоянным.
- Ре-верификация Муфтията ежегодно (данные на текущий год, ~365 записей);
  ре-верификация ДУМ РТ CSV к концу 2026 (файлы содержат 2025+2026).
- Появление подтверждённых источников (Чечня, Ставрополь, ЦДУМ, Diyanet,
  другие страны) — добавить записи в OFFICIAL_PRAYER_SOURCES; архитектура
  готова (T6; добавление ДУМ РТ в итерации 7 подтвердило: новый регион =
  одна запись, ноль изменений resolver).

**Что НЕ нужно делать повторно**:
- Не возвращать кастомную таб-анимацию (transitionSpec/sceneStyleInterpolator
  в (tabs)/_layout.js) — ломает навигацию на Android (5d→5e; см. §0.6e).
- Не искать API Чечни (dumchr.ru — клиентский калькулятор + TLS истёк;
  grozny-inform.ru/namaz → 410), Ставрополья (JS cookie-стена), ЦДУМ,
  Diyanet, MUIS/JAKIM/UAE, Umm al-Qura, ДУМ России, namaz.today —
  проверено 2026-09-13, машиночитаемых подтверждённых API нет (см. §6).
- Не переписывать SourceBadge/SourceInfoToast — обновлён дизайн (5) и
  анимация (5b), логика та же.
- Не добавлять координаты городов в registry — координаты из selectedCity;
  якоря Дагестана — правило применимости источника.
- Не ломать ручной метод при работе resolver'а (T11 фиксирует поведение).
- Не возвращать чтение methodOverridden внутрь loadPrayerTimes — это и
  был баг AUTO/MANUAL (stale closure).
- Не перепроверять countdown с «разными источниками» — верифицировано в 5b
  (инварианты VALID для обоих источников и 3 TZ); логика source-agnostic.
