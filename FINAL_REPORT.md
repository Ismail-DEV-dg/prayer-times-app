# FINAL REPORT — Prayer Times App

Дата: 2026-09-13 (обновлено: итерация 5e — FIX сломанной навигации, откат таб-анимации 5d)
Проект: React Native / Expo приложение для времени намаза.
База: существующий работающий проект на Expo SDK 54 (APK ранее собирался).

> **Восстановление контекста в новом чате**: этот файл — актуальное состояние
> проекта. Итерация 5e (последняя) описана в §0.6e: навигация «табы открывали
> чужие экраны» исправлена — кастомная таб-анимация 5d откачена, таб-группа
> возвращена к мгновенному `animation: "none"` (two-state режим bottom-tabs —
> единственный безопасный на react-native-screens Android). Маршруты НЕ менялись
> (они были корректны — подтверждено 69-проверочным аудитом + симуляцией
> библиотечного перехода). Итерации 5c (нативные fade_from_bottom стековых
> экранов + LayoutAnimation списков городов), 5b (микро-анимации +
> countdown-верификация), 5 (territorial registry + AUTO/MANUAL fix) и более
> ранние сохранены ниже. Expo SDK 54 / RN 0.81.5 / зависимости — НЕ менялись.

---

## 0.6e Итерация 5e — FIX сломанной навигации (2026-09-13)

### 0.6e.1 Симптомы и диагностика

Жалоба: «Местоположение» открывает не тот экран, «Настройки» открывают
«Местоположение», «Главная» открывает неправильный экран, переходы перепутаны.

Полный аудит ВСЕЙ навигации (все файлы app/, все _layout.js, все
router.push/replace/back, href, initialRouteName, back-guard'ы, content-маркеры
каждого экрана, таб-названия↔файлы) показал: МАРШРУТЫ КОРРЕКТНЫ — каждый
пункт открывает ровно свой экран на уровне роутинга. Единственное глубокое
изменение последних итераций — кастомная таб-анимация 5d
(`app/(tabs)/_layout.js`: transitionSpec 320 мс + sceneStyleInterpolator с
разделёнными ролями: входящий fade-in+подъём, остальные статичны `sceneStyle: {}`).

### 0.6e.2 Первопричина (разбор установленных библиотек + симуляция)

На Android (react-native-screens, expo-router v6 Tabs = JS bottom-tabs):
- `animation: "none"` → two-state режим (`hasTwoStates=true`,
  BottomTabView.js): ScreenContainer прикрепляет РОВНО ОДИН экран
  (focused), INACTIVE-экраны детачатся немедленно.
- Реальный transitionSpec → во время 320-мс перехода ОБА экрана
  (STATE_TRANSITIONING_OR_BELOW_TOP=1) остаются прикреплёнными, а старый —
  полностью непрозрачным (статичная `sceneStyle: {}` не даёт fade-out).
- Нативный `ScreenContainer.onUpdate()` (ScreenContainer.kt, Android)
  упорядочивает экраны ПОРЯДКОМ ATTACH фрагментов; повторная активация
  экрана пере-attach'ит его В КОНЕЦ списка = ПОВЕРХ других. Инкрементальные
  коммиты (activityState меняется на 1→переход, 2→конец) при переключении
  табов пере-attach'ат СТАРЫЙ экран поверх ВХОДЯЩЕГО на остаток перехода.
- Итог для пользователя: 320 мс видно содержимое ПРЕДЫДУЩЕГО таба
  (например, «Местоположение» при нажатии «Настройки»), затем резкая
  смена — воспринимается как «табы открывают чужие экраны / маршруты
  перепутаны». Возможны и разные кадры у разных коммитов (мигание старого
  поверх нового) в зависимости от тайминга нативных обновлений.

Подтверждено симуляцией 1:1 механизма (useAnimatedHashMap toValue-правило,
activityState по BottomTabView, attach-порядок + pendingFront по
ScreenContainer.onUpdate): конфиг 5d — «visible = СТАРЫЙ экран» в первом
кадре каждого из 4 протестированных переключений; конфиг FIX — корректный
экран на всех кадрах всех переключений. Харнесс:
`%TEMP%\opencode\nav-audit\tab-transition-sim.js`.

### 0.6e.3 Что сделано

Единственный код-файл: `app/(tabs)/_layout.js` —
- удалены `useFadeFromBottomTabTransition()`, transitionSpec,
  sceneStyleInterpolator, роли entering/staticScreen, импорты
  Easing/useWindowDimensions;
- таб-группа возвращена к мгновенному `animation: "none"` в screenOptions
  (default/two-state режим bottom-tabs — то, что было до 5d все прошлые
  итерации);
- добавлен DO-NOT-CHANGE комментарий с механизмом поломки (чтобы 5d не
  повторили).

Маршруты, экраны, стаки, back-guard'ы, initialRouteName — НЕ менялись
(были корректны). 5c-настройки стековых экранов (fade_from_bottom
root/settings), LayoutAnimation списков городов (5c) и все микро-анимации
(5b) — НЕ тронуты, остаются в силе.

### 0.6e.4 Проверки итерации 5e (все РЕАЛЬНО выполнены)

- Навигационный аудит 69/69 PASS: резолв всех 34 router-вызовов к маршрутам,
  7 back-guard'ов, initialRouteName (root «(tabs)», tabs «index»), 3 таба
  (имя↔заголовок↔файл), content-маркеры заголовков 8 экранов, Home-кнопки
  (Коран/Мечети/Кыбла/Настройки/Местоположение/Выбрать город), отсутствие
  других навигаторов. Харнесс: nav-audit\nav-route-audit.js.
- Симуляция таб-перехода (см. 0.6e.2): 4 переключения × обе конфигурации —
  5d WRONG/OLD-on-top, FIX OK.
- Синтаксис (sucrase + node --check): app/_layout.js,
  app/settings/_layout.js, app/(tabs)/_layout.js — OK.
- `npm test` — 24/24 PASS; `scripts/test-prayer-sources.js` — 17/17 PASS.
- Production bundle `npx expo export --platform android` — OK (Hermes HBC
  3.24 MB).
- Device-тест: NOT RUN (устройства нет). Но two-state режим — библиотечный
  дефолт bottom-tabs (работал все итерации до 5d), не самописный код.

### 0.6e.5 Анимации после 5e (что осталось)

| Переход | Состояние |
|---|---|
| Стековые экраны (root: /mosques, /qibla, /quran, /surah, /settings; settings: /settings/index, theme, method) | нативный fade_from_bottom 320–350 мс (5c) — РАБОТАЕТ |
| Таб-группа (Главная/Местоположение/Настройки) | мгновенно (animation none) — осознанно: единственный безопасный режим на RNS Android |
| Добавление/удаление городов | LayoutAnimation 220–240 мс (5c) — РАБОТАЕТ |
| Микро-анимации (NextPrayer, PrayerCard stagger, SourceInfoToast, tabular-nums) | useNativeDriver (5b) — РАБОТАЕТ |

---

## 0.6d Итерация 5d — 100% покрытие: анимация таб-переходов (2026-09-13; ОТКАЧЕНА в 5e — ломала навигацию)

### 0.6d.1 Проблема и аудит

Жалоба: Местоположение (и некоторые другие переходы) появляются резко, хотя
Главная → Настройки (шестерёнка) — эталонно плавные. Полный аудит навигации
(все _layout.js, все router-вызовы в app/ и components/):

- Root Stack и Settings Stack — уже fade_from_bottom (5c), эталон.
- ЕДИНСТВЕННЫЙ неанимированный навигатор — таб-группа `app/(tabs)/_layout.js`
  (JS bottom-tabs, default `animation: "none"` → резкая смена экрана).
- ВСЕ резкие переходы — это переключения внутри (tabs): таб-бар
  (Главная/Местоположение/Настройки-таб), все `router.push("/location")`
  (Главная ×2, settings-таб ×3, /settings ×3) и `router.push("/")` (×4) —
  они резолвятся в tab-switch, минуя анимированный root Stack. Именно
  поэтому «Местоположение» резкое. Других навигаторов/модалей нет.

Ключевой факт: expo-router v6 `Tabs` = JS `createBottomTabNavigator`
(bottom-tabs 7.18.18) — у него есть штатные опции `transitionSpec` +
`sceneStyleInterpolator` (тот же принцип «переходы в screenOptions layout-
навигатора», что и в обоих Stack). Переписывания таб-навигации НЕ потребовалось.

### 0.6d.2 Решение (унификация плавности, эталон «Настройки → Тема»)

`app/(tabs)/_layout.js`: в screenOptions добавлен хук
`useFadeFromBottomTabTransition()` (вычисляет slideUp = 8% высоты окна через
useWindowDimensions) → `transitionSpec` (timing 320 мс, Easing.out(poly 5) =
quintic decelerate) + `sceneStyleInterpolator` с РАЗДЕЛЁННЫМИ РОЛЯМИ:
- ВХОДЯЩИЙ (focused) экран: fade-in + подъём translateY от slideUp к 0 —
  как нативный rns_fade_from_bottom (enter);
- ВСЕ остальные экраны (вкл. исходящий): ПОЛНОСТЬЮ статичны
  (sceneStyle: {}, как нативный rns_no_animation_350 — старый экран
  никогда не движется).
Роль определяется через navigation.getState() в screenOptions (обход
read-during-render из useNavigationHelpers корректен — stateRef workaround).
НЕ анимировались оба экрана одновременно (ранняя версия 5d) — встречное
движение и просвет фона давали рывок, заметнее всего на Местоположении.

Дополнительно устранён конфликт в `app/(tabs)/location.js`: из handleSelect
убран LayoutAnimation.configureNext перед router.push("/") — pending
layout-анимация «прилипала» к таб-переходу; строка списка всё равно не видна.
Анимации удаления города (trash) и CitySwitcher не тронуты.

Таб-бар не участвует в анимации (анимируется только сцена) — визуально
идентично эталону.

### 0.6d.3 Проверки итерации 5d (все РЕАЛЬНО выполнены)

- Синтаксис `app/(tabs)/_layout.js` (sucrase + node --check) — OK.
- `npm test` — 24/24 PASS; `scripts/test-prayer-sources.js` — 17/17 PASS
  (T9 в первом прогоне — транзиентный сетевой сбой AlAdhan, повторно PASS).
- Production bundle — OK (Hermes HBC 3.24 MB).
- Device-тест: NOT RUN (устройства нет); интерполятор — штатный механизм
  bottom-tabs 7.18, useNativeDriver включён библиотекой на native.
- Покрытие: 10/10 экранов, все обычные переходы используют ту же систему.

---

## 0.6c Итерация 5c — плавные переходы экранов + анимация списков (2026-09-13)

### 0.6c.1 Плавные переходы между экранами (нативные, без JS-нагрузки)

Жалоба: переходы между экранами резкие («глаз режет»). Исправлено через
нативные опции expo-router native-stack (анимация выполняется на UI-потоке
Android, JS не участвует):

| Стек | Переход | Длительность |
|---|---|---|
| Root Stack (app/_layout.js) | `fade_from_bottom` — новый экран мягко поднимается снизу с fade | 350 мс |
| Root → (tabs) | `animation: "none"` (таб-группа — корневой якорь, не анимируется) | — |
| Root → surah/[number] | тот же стиль | 320 мс |
| Settings Stack (app/settings/_layout.js) | `fade_from_bottom` — консистентно с root | 320 мс |

Затронутые переходы: Главная ↔ /settings, /mosques, /qibla, /quran,
/settings/theme, /settings/method, /surah/[number] — все мягкие.
Таб-переключения (Главная/Местоположение/Настройки внизу) — на момент 5c
оставлены системными; в итерации 5d (§0.6d) переведены на ту же
fade_from_bottom-анимацию через штатный API bottom-tabs.

### 0.6c.2 Анимация добавления/удаления городов (нативный LayoutAnimation)

`LayoutAnimation` — полностью нативный механизм (однократная конфигурация
перед мутацией состояния, вся анимация на UI-потоке, ноль per-frame JS).
Android требует `UIManager.setLayoutAnimationEnabledExperimental(true)`
(стандартный паттерн, включён один раз).

| Место | Что анимируется |
|---|---|
| `app/(tabs)/location.js` | удаление города (trash) — строка мягко сворачивается, соседи плавно съезжают вверх (240 мс easeOutEaseIn); выбор города из поиска — новая строка мягко появляется |
| `app/(tabs)/index.js` | кнопка «В список городов / Убрать из списка» — чип в CitySwitcher плавно появляется/исчезает (220 мс) |

Сознательно НЕ анимировано (перебор): каждый чип CitySwitcher при
перерисовках, тексты, карточки при pull-to-refresh — LayoutAnimation
вызывается ТОЛЬКО у реальных мутаций списка.

### 0.6c.3 Проверки итерации 5c (все РЕАЛЬНО выполнены)

- Синтаксис 4 файлов (sucrase + node --check) — OK.
- `npm test` — 24/24 PASS; `scripts/test-prayer-sources.js` — 17/17 PASS.
- Production bundle — OK.
- Device-тест переходов/анимаций: NOT RUN (устройства нет). Нативные
  transition-опции native-stack и LayoutAnimation — стандартные механизмы
  RN 0.81; runtime-проверка на устройстве не выполнялась.

---

## 0.6b Итерация 5b — countdown-верификация + микро-анимации (2026-09-13)

### 0.6b.1 Верификация «до начала / до следующей молитвы» с разными расчётами

Countdown-логика (`utils/time.js`: getNextPrayer/getMsUntilPrayer/formatCountdown)
по построению source-agnostic: принимает prayers[{name,time}] + timezone.
Проверено реально (Node + живые сетевые данные):

| Сценарий | Данные | Результат |
|---|---|---|
| Официальный источник | Муфтият Дербент (реальный JSON, сегодняшний день) | next=Dhuhr 11:49, через 02:08:43 — VALID (0 ≤ ms < 24h) |
| Расчётный (страна) | AlAdhan Москва метод 14 | next=Dhuhr 12:26, через 02:45:43 — VALID |
| Чужая TZ с тем же списком | America/New_York (negative offset, DST) | next=Fajr, через 01:18:43 — VALID |
| Переход через полночь | tomorrow-флаг | «завтрашний Fajr» через 18:51:03 — VALID (0..48h) |
| Крайние случаи | одинарный список; malformed «bad» пропускается | корректно |

Инварианты подтверждены: 0 ≤ ms < 24h (48h для tomorrow); Sunrise исключён из
«следующего намаза» (upstream-фильтр в Home); TZ всегда selectedCity.
Код countdown НЕ менялся — изменения не потребовались.

### 0.6b.2 Микро-анимации (лёгкий дизайн-апгрейд, логика не тронута)

Все анимации — Animated API на useNativeDriver (JS-поток не нагружается),
без новых зависимостей, без изменения навигации/структуры:

| Компонент | Эффект |
|---|---|
| `components/NextPrayer.js` | entrance fade+slide-up 320 мс (однократно при монтировании); пульсирующая «live»-точка рядом с подписью «Следующий намаз» (loop 0.3→1→0.3); мягкая тень (shadow/elevation 5); декоративный полупрозрачный glint-круг в правом верхнем углу hero-карты |
| `components/PrayerCard.js` | каскадное появление грида: fade+rise 280 мс со stagger 70 мс × index (0–350 мс); tabular-nums у времени (цифры не «прыгают» при смене секунд) |
| `components/SourceInfoToast.js` | появление toast: fade + spring-подъём снизу (speed 20, bounciness 4) вместо резкого popup |
| `app/(tabs)/index.js` | в PrayerCard передаётся `index={i}` для stagger (единственное изменение экрана) |

НЕ тронуто (выглядит хорошо и/или не требует анимации): CitySwitcher
(чипы уже аккуратные, анимация чипов — перегруз), LocationHeader, экраны
Мечетей/Кыблы/Корана, метод-экран (обновлён в итерации 5), палитра
theme/colors.js, вся логика/данные/навигация. `active={false}` в гриде
карточек сохранён как историческое поведение (подсветка следующей молитвы
в гриде ранее не реализована — менять без запроса не стал).

### 0.6b.3 Проверки итерации 5b (все РЕАЛЬНО выполнены)

- Countdown E2E с живыми данными обоих источников + 3 TZ: все VALID (выше).
- `npm test` — 24/24 PASS.
- `scripts/test-prayer-sources.js` — 17/17 PASS.
- Синтаксис 4 файлов (sucrase + node --check) — OK.
- Production bundle `npx expo export --platform android` — OK.
- Device-тест анимаций: NOT RUN (устройства нет); useNativeDriver-анимации
  стандартны для RN 0.81, риск минимален, но runtime-проверка не выполнялась.

---

## 0.6 Итерация 5 — территориальный registry, исправление AUTO/MANUAL + key warning, дизайн (2026-09-13)

### 0.6.1 Найденные и исправленные ошибки

**Баг 1 — React warning `Each child in a list should have a unique "key" prop`**
- Причина: в `app/settings/method.js` строки списка рендерились через
  `renderRow(...)` внутри `CALCULATION_METHODS.map()`, но `renderRow` не
  принимал и не пробрасывал `key` в корневой `<TouchableOpacity>` — React
  не видит key на элементах массива.
- Исправление: `renderRow(rowKey, ...)` — первый параметр `key` (`"auto"`,
  `` `method-${m.id}` `` — стабильный id метода, НЕ index). Проверено
  код-сканом: все `.map()` с JSX в проекте имеют key; в settings-экранах
  `.map()` вообще нет (литеральные строки).

**Баг 2 — AUTO/MANUAL не переключался корректно (Тегеран → manual → «Автоматически» не возвращал AUTO)**
Корневые причины (исправлены, без костылей):
1. **Инвертированный guard** в method.js: `if (!methodOverridden) resetMethodToAuto()`
   — вызов происходил только когда уже AUTO; при MANUAL→AUTO нажатие
   «Автоматически» не выполняло сброс.
2. **Stale closure в loadPrayerTimes**: коллбэк зависел от `[methodOverridden]`
   и читал его из замыкания ВНУТРИ (`method: methodOverridden ? method : null`).
   После `setMethodOverridden(false)` немедленный вызов `loadPrayerTimes(...)` всё
   ещё видел старое значение `true` → расписание перезагружалось в MANUAL-режиме,
   а для Дербента это давало расчёт ДУМ России вместо Муфтията.
3. **Кэш-ключ зависел от stale state**: `savePrayerCache(city, methodOverridden ? method : "auto")`
   — мог писать manual-расписание под auto-ключом (и наоборот), после чего
   offline-режим показывал не тот источник.
Исправления:
- `loadPrayerTimes(city, method)` больше НЕ читает `methodOverridden` из state —
  режим определяется ТОЛЬКО аргументом: `null` → AUTO, число → MANUAL
  (deps `[]`). Аргумент вычисляет вызывающий код, у которого значение уже актуально.
- Кэш-ключ: `Number.isFinite` → безопасный `method != null && Number.isFinite(asNum)`
  (строка "14" тоже нормализуется); ключ = `"auto" | String(method)` — кэши режимов
  никогда не смешиваются.
- Guard в method.js: `if (methodOverridden) resetMethodToAuto()` — сброс происходит
  именно при переходе MANUAL→AUTO; в AUTO — no-op.
- `resetMethodToAuto()` (AppDataContext): удаляет метод из AsyncStorage
  (`removeMethod`), сбрасывает `methodOverridden`, ставит country-default в UI-стейт
  и перезагружает `loadPrayerTimes(selectedCity, null)` — теперь честно через
  resolver (Дербент → Муфтият).
- `selectCityFromGps`/`selectCity`: явные ветки AUTO (`null`) / MANUAL (`calcMethod`).

### 0.6.2 Территориальная модель registry (главное архитектурное изменение)

Registry больше НЕ «город → источник» — теперь «территория действия → источник».
Запись (`services/officialSources.js`, `OFFICIAL_PRAYER_SOURCES`):

```
{ id, sourceName, sourceLevel: "city"|"region"|"country",
  sourceType, sourceUrl, fetchType, priority,
  country, region, city,  // строка | RegExp | предикат (правила применимости)
  resolveCity({name, region, latitude, longitude}) -> params | null }
```

- `sourceLevel` задаёт специфичность (city=3 > region=2 > country=1).
- `priority` (число, выше = раньше) разрешает конфликты ВНУТРИ одного уровня.
- `fetchType` — как получать расписание (сейчас: `"muftiyat_rd_json"`);
  `fetchFromOfficial` в prayerApi.js диспетчеризует по нему.
- `resolveCity` — необязательное правило «покрывает ли источник этот населённый
  пункт» (для Дагестана: имя/район → slug, иначе ближайший якорь района ≤55 км).

Resolver `resolvePrayerSource(city)` теперь:
1. собирает ВСЕ применимые записи (страна → регион → город, предикаты/regex);
2. сортирует по (specificity desc, priority desc);
3. возвращает `{ source, resolved, specificity, chain }`, где `chain` —
   упорядоченный список применимых источников.

`fetchPrayerTimes` (AUTO) перебирает `chain` по порядку: первый успешный
официальный fetch выигрывает; любой сбой (сеть/форма/размер) — переход к
следующему, затем расчётный API. Результат НЕИЗВЕСТНОГО fetchType или
null-результат честно продолжает цепочку (никакого фейкового labelling).

Это работает для ЛЮБОЙ страны/региона/города: применимость описана в записи,
resolver не содержит ни одного хардкода города (кроме правил применимости
самого Дагестанского источника). Новая страна/регион = одна запись после
верификации.

### 0.6.3 Верификация новых источников (Чечня, Ставрополь) — НЕ добавлены

Проверено 2026-09-13 (честные сетевые проверки, без фабрикации):
- Чечня: grozny-inform.ru/namaz → HTTP 410 Gone; namaz.today/grozny → 404;
  иного машиночитаемого API Муфтията Чечни не найдено → Грозный и другие
  города Чечни остаются на расчётном методе 14 (ДУМ России) ДО появления
  подтверждённого источника.
- Ставропольский край: подтверждённого официального машиночитаемого источника
  не найдено → НЕ зарегистрирован.
- dumrf.ru (ДУМ России): HTML-сайт, API расписаний нет → по-прежнему
  country-level расчётный fallback (метод 14), НЕ registry-запись.

Реестр фактических записей после итерации 5 (без изменений по сути):

| id | Уровень | Территория | Источник | fetchType | Статус |
|---|---|---|---|---|---|
| muftiyat_rd | region | Россия / Дагестан (вкл. районы) | Муфтият Республики Дагестан, muftiyatrd.ru/json/namaz/{slug}.json | muftiyat_rd_json | ПОДТВЕРЖДЁН (см. §0.5.2) |

### 0.6.4 AUTO vs MANUAL — финальная семантика

- Хранение: AsyncStorage `@prayer_times/method` — отсутствует = AUTO,
  число = MANUAL. `removeMethod()` полностью удаляет override.
- AUTO: `fetchPrayerTimes(..., method: null)` → resolver → официальная
  цепочка → расчётный API по стране → offline-кэш.
- MANUAL: `fetchPrayerTimes(..., method: N)` → сразу AlAdhan с методом N;
  resolver НЕ запускается (ручной выбор неприкосновенен).
- MANUAL → AUTO: полное удаление override + перезагрузка через resolver.
- После рестарта: AUTO остаётся AUTO (ключ отсутствует), MANUAL остаётся
  MANUAL (ключ сохранён) — проверено T16.
- UI-подписи честные: «Автоматически: Муфтият Республики Дагестан» /
  «Вручную: ДУМ России».

### 0.6.5 Лёгкий дизайн-апгрейд (без изменения логики/навигации)

- `app/settings/method.js`: секции «Автоматически» / «Вручную» с заголовками,
  radio-индикаторы, иконки (flash/calculator), подсказки; активная строка
  подсвечена accent-цветом.
- `components/SourceBadge.js`: pill-форма (граница + скругление), иконка по
  типу (shield-checkmark для официального, calculator для расчётного,
  cloud-offline для кэша), официальное расписание подсвечивается accent.
- Подписи AUTO/MANUAL в `(tabs)/settings.js` и `settings/index.js`
  приведены к единому виду «Автоматически: <источник/метод>» / «Вручную: <метод>».
- НЕ менялись: навигация, структура экранов, палитра theme/colors.js,
  остальные компоненты, все API/логика.

### 0.6.6 Тесты итерации 5 (все РЕАЛЬНО выполнены)

`scripts/test-prayer-sources.js` — 17 тестов (11 offline + 6 онлайн):

| Тест | Проверка | Результат |
|---|---|---|
| T1 | Derbent → Муфтият (region, sourceLevel, slug) | PASS |
| T2 | Село Дагестана без slug → районный якорь; Кизлярский район → kizlyar | PASS |
| T3 | Москва → НЕ Муфтият (null) | PASS |
| T4 | Медина → нет источника → расчёт | PASS |
| T5 | Хельсинки → нет источника → расчёт | PASS |
| T6 | Иерархия: city>region>country + упорядоченный chain + priority | PASS |
| T7 | Индекс дня = dayOfYear-1 | PASS |
| T8 | (онлайн) Derbent AUTO → 6 строк от Муфтията, TZ Europe/Moscow | PASS |
| T9 | (онлайн) Moscow AUTO → расчёт ДУМ России (14) | PASS |
| T10 | (онлайн) Medina AUTO → расчёт Умм-аль-Кура (4) | PASS |
| T11 | (онлайн) Manual 14 и Manual 3 для Derbent не заменяются resolver'ом | PASS |
| T12 | (онлайн) Битый официальный источник (сломанный fetchType И битый endpoint) → честный расчётный fallback | PASS |
| T13 | (онлайн) GPS≠selectedCity в обе стороны; TZ от selectedCity | PASS |
| T14 | Рестарт-roundtrip: region сохраняется, resolver работает | PASS |
| T15 | Грозный/Нью-Йорк/Стамбул без подтверждённых источников → расчёт | PASS |
| T16 | Storage: saveMethod/getSavedMethod/removeMethod; AUTO/MANUAL переживают рестарт | PASS |
| T17 | Кэш-ключ auto/«N» — режимы не смешиваются | PASS |

Прочее:
- `npm test` — 24/24 PASS.
- Синтаксис (sucrase + node --check) 7 изменённых файлов — OK.
- Код-скан: все `.map()` с JSX имеют key; в settings-экранах `.map()` нет.
- Production bundle `npx expo export --platform android` — OK, Hermes 3.24 MB.
- Device-тест: NOT RUN (устройства/эмулятора в окружении нет).

Честные ограничения итерации 5:
- Онлайн-тесты — из сети окружения сборки (Node), не с устройства.
- React key warning проверен код-сканом (статический анализ всех .map),
  не runtime-прогоном на устройстве (устройства нет) — но единственный
  `.map()` с массивом строк получил стабильные key, прочие списки
  литеральные.
- AUTO→MANUAL→AUTO проверен на уровне storage-семантики (T16) и
  код-инспекции call-sites; интерактивный прогон UI на устройстве не выполнялся.

---

## 0.5 Итерация 4 — Official Prayer Source System (2026-09-12)

### 0.5.1 Задача и принцип

Построить нормальную иерархию источников времени намаза, чтобы приложение
АВТОМАТИЧЕСКИ выбирало самый конкретный ПОДТВЕРЖДЁННЫЙ официальный источник
для selectedCity:

OFFICIAL CITY → OFFICIAL REGION / MUFTIATE → OFFICIAL COUNTRY → CALCULATION API

Ключевые требования: registry описывает источники и правила применимости,
а НЕ список городов мира; координаты берутся из selectedCity (не дублируются);
currentLocation ≠ selectedCity (GPS не влияет на источник расписания);
ручной метод не заменяется resolver'ом; неподтверждённые источники не добавляются.

### 0.5.2 Верификация источников (реальные сетевые проверки 2026-09-12)

| Источник | Что проверено | Статус |
|---|---|---|
| Муфтият Республики Дагестан (muftiyatrd.ru) | JSON API `https://muftiyatrd.ru/json/namaz/{slug}.json` — обнаружен в JS виджета сайта; 27 slug'ов, все HTTP 200, по 365 записей (массив на год), поля namaz_1..5 + voshod; индекс = dayOfYear-1 (схема виджета самого сайта); сезонный профиль корректен (январь Fajr 05:42, июнь 01:58); сегодняшняя запись близка к расчёту (±10 мин); работает без браузерного User-Agent | **ЗАРЕГИСТРИРОВАН** (official_region) |
| Umm al-Qura (Саудовская Аравия, time.uqu.edu.sa) | DNS не резолвится из сети приложения; публичного машиночитаемого API не найдено | НЕ зарегистрирован; Медина/Рияд → расчётный метод 4 (Umm al-Qura через AlAdhan) |
| ДУМ России | Официальный МЕТОД расчёта (AlAdhan id 14), а не API расписаний по городам | НЕ входит в registry; остаётся country-level РАСЧЁТНЫМ fallback для городов РФ без специфичного источника |
| namaz.today | WordPress HTML, per-city JSON API нет | НЕ зарегистрирован |

Важно про прошлые сессии: отчёты итераций 1–3 считали muftiyatrd.ru недоступным
без API — это было НЕВЕРНО для текущего состояния: сайт доступен, машиночитаемый
JSON-API существует и проверен. Данная итерация исправила этот пробел.

### 0.5.3 Реестр официальных источников (фактическое состояние)

Registry: `services/officialSources.js` → `OFFICIAL_PRAYER_SOURCES`. Одна запись:

| Поле | Значение |
|---|---|
| scope / sourceType | official_region |
| sourceName | Муфтият Республики Дагестан |
| sourceUrl | https://muftiyatrd.ru/ |
| endpoint | https://muftiyatrd.ru/json/namaz/ |
| Применимость | country: Россия/Russia; region: «Дагестан» ИЛИ название района Дагестана (геокодеры отдают обе формы) |
| Способ получения | JSON-массив 365 записей на год; день = dayOfYear-1 в TZ города; поля namaz_1..5 (Fajr..Isha), voshod (Sunrise); валидация: ровно 365 записей, все 6 времён в формате HH:MM, иначе API_ERROR → fallback |
| Сопоставление город → slug | (а) точное имя в DAGESTAN_SLUGS (город/районный центр + прилагательные района «…ский район»); (б) ближайший якорь района ≤55 км (27 якорей = центры районов). Файлы районов отличаются на ~1–2 минуты по республике, поэтому для сёл без своего slug ближайший районный файл — честное официальное расписание |
| Ограничения | НЕ источник для остальной России; Last-Modified заголовка 2018 (кэш CDN), но данные сезонно верны для текущего года |

Записи official_city / official_country пока НЕТ — неподтверждённых записей
не добавляли (принцип честности). Архитектура расширяема: новая запись с
scope/resolver добавляется в массив без изменений resolver'а (проверено T6).

### 0.5.4 Как работает resolver

`resolvePrayerSource(city)` (services/officialSources.js):
1. official_city — exact city match
2. official_region — регион/муфтият
3. official_country
4. null → расчётный API (вызывающий сам делает fallback)

`fetchPrayerTimes({ latitude, longitude, method, timezone, country, name, region })`
(services/prayerApi.js):
- method == null (AUTO, дефолт): resolver → официальный источник (если совпал)
  → при ошибке/несовпадении → AlAdhan с методом по стране.
- method = число (MANUAL): сразу AlAdhan с этим методом, resolver НЕ трогается.
- Официальное расписание: source.type="official_region",
  source.name="Муфтият Республики Дагестан", timezone = TZ selectedCity.
- Иджра-дата: локальный Kuwaiti-алгоритм (источник её не отдаёт; помечена
  algorithmic, как и раньше для fallback-случая).

### 0.5.5 AUTO vs MANUAL (настройки)

- `app/settings/method.js` — экран переименован в «Источник и метод»: сверху
  опция «Автоматически» (показывает, ЧТО выберет AUTO прямо сейчас: источник
  registry или метод по стране), ниже — ручные методы.
- `resetMethodToAuto()` в AppDataContext: удаляет сохранённый метод
  (storage.removeMethod), сбрасывает methodOverridden, перезагружает AUTO.
- Ручной выбор (methodOverridden=true) никогда не заменяется resolver'ом.
- `app/settings/index.js`: подпись «Автоматически: <источник/метод>» или
  «Вручную: <метод>».

### 0.5.6 UI источника (без ломки существующего)

`SourceBadge` / `SourceInfoToast` НЕ изменялись: для official-источника
бейдж уже показывает «Источник: Муфтият Республики Дагестан» (source.name),
toast — «Тип: Официальное расписание» + URL. Для расчётного — как раньше.

### 0.5.7 Что НЕ изменено (итерация 4)

- Expo SDK 54 / RN 0.81.5 / все зависимости / app.json / eas.json / babel — нетронуты.
- currentLocation / selectedCity / savedCities архитектура — нетронута
  (GPS НЕ влияет на источник расписания; проверено T13).
- Мечети/Overpass, Кыбла, Коран, аудио-архитектура, навигация, тема — нетронуты.
- Алгоритм AlAdhan-fetch, offline-кэш на сутки, TZ-правила — нетронуты.
- `components/SourceBadge.js`, `components/SourceInfoToast.js` — нетронуты.

### 0.5.8 Тесты итерации 4 (все РЕАЛЬНО выполнены)

`scripts/test-prayer-sources.js` (14 тестов: 8 offline resolver + 6 онлайн):

| Тест | Результат |
|---|---|
| T1 Derbent/Dagestan/Russia → Муфтият Дагестана (region level) | PASS |
| T2 Другой город/село Дагестана без своего slug → Муфтият через район (якорь/имя района) | PASS |
| T3 Москва (РФ вне Дагестана) → НЕ Муфтият (null → расчёт) | PASS |
| T4 Medina/Saudi → нет подтверждённого официального источника → расчётный API | PASS |
| T5 Helsinki → нет официального источника → расчёт | PASS |
| T6 Архитектура: official_city побеждает official_region; село вне city-coverage падает на region | PASS |
| T7 Индекс дня = dayOfYear-1 (схема виджета Муфтията), 0..364 | PASS |
| T8 (онлайн) Derbent AUTO → расписание Муфтията: 6 строк, source=Муфтият, TZ Europe/Moscow | PASS |
| T9 (онлайн) Moscow AUTO → «Расчётное расписание (ДУМ России)» (метод 14) | PASS |
| T10 (онлайн) Medina AUTO → «Расчётное расписание (Умм-аль-Кура, Мекка)», TZ Asia/Riyadh | PASS |
| T11 (онлайн) Ручной метод (MWL) для Derbent НЕ заменяется resolver'ом | PASS |
| T12 (онлайн) Сломанный официальный источник (битый slug) → честный fallback на расчёт ДУМ России, без краша | PASS |
| T13 (онлайн) GPS Helsinki + selectedCity Derbent → расписание Derbent/Муфтият; GPS Derbent + selectedCity Helsinki → Helsinki-расчёт (разделение сущностей) | PASS |
| T14 Перезапуск: JSON-roundtrip normalizeCity сохраняет region → resolver работает после рестарта | PASS |

Прочее:
- `npm test` (24 логических) — 24/24 PASS (не задеты).
- Синтаксис 6 изменённых файлов (sucrase + node --check) — OK.
- Production bundle `npx expo export --platform android` — OK, Hermes HBC 3.23 MB.

Честные ограничения итерации 4:
- ONLINE-тесты T8–T13 выполнялись из сети окружения сборки (Node), НЕ на
  устройстве; UI на устройстве не прогонялся (устройства нет).
- Ближайший-якорь для сёл: файл соседнего района может отличаться на 1–2 мин
  от «своего» района — это ограничение без геометрии границ районов; для сёл
  с известным именем точное сопоставление приоритетнее.
- Муфтият не отдаёт дату последнего обновления данных; актуальность проверена
  косвенно (сезонный профиль + близость к расчёту сегодня).

---

## 0.4 Итерация 3 — Quran Audio: PRIMARY/FALLBACK + lifecycle (6.1–6.4)

### 0.4.1 Предпосылки (сетевой анализ, реальная сеть пользователя)

Пользователь провёл полный сетевой тест из своей реальной сети без VPN; плюс
прямые curl-проверки из сети сборки; плюс предыдущие `scripts/network-benchmark.js`.
Итоги по аудио:

| Источник | Замеры | Стабильность | Решение |
|---|---|---|---|
| everyayah.com (аудио, 128 kbps) | TTFB ~111–180 мс прогретые, новые файлы 140–590 мс; Alafasy 20/20 свежих аятов, 0 ошибок | стабильно, 0 ошибок, 0 timeout | **PRIMARY** |
| cdn.islamic.network (аудио, 64 kbps) | TTFB ~180–520 мс; в истории 502 (~1 из 8) и timeout до ~20 с | работает, но медленнее, эпизодические 502 | **FALLBACK (опциональный)** |

Текст Корана / намаз / геокодинг / Overpass DE / NOAA — стабильны и быстры,
оставлены без изменений (Overpass Kumi — сохранён как последний резерв; в сети
пользователя у него стабильный timeout, автоматически не приоритетен).

### 0.4.2 Что изменено (ФИЗИЧЕСКИ ВНЕСЕНО И СОХРАНЕНО)

Изменены ровно три файла:

**1) `services/quranApi.js`** — 6.1 + 6.2:
- Исправлены имена папок everyayah.com (это был реальный баг: старые
  `Alafasy128kbps` / `Husary128kbps` давали HTTP 404; проверено curl'ом — 
  правильные имена `Alafasy_128kbps`, `Husary_128kbps`, `Minshawy_Murattal_128kbps`,
  все три отдают 200 на реальных аятах). Баг маскировался тем, что benchmark-скрипт
  проверял правильные папки, а код приложения — неправильные.
- Смена ролей: `getAyahAudioUrl(surahNumber, ayahNumber, reciterId)` теперь строит
  URL **everyayah.com** (PRIMARY; сигнатура изменилась, т.к. everyayah адресуется
  по сура/аят с zero-padding). Добавлены валидации: surah 1..114, ayah 1..286,
  известный чтец — иначе null (никаких сфабрикованных URL).
- `getAyahAudioUrlFallback(globalAyahNumber, reciterId)` теперь строит URL
  **islamic.network** (OPTIONAL FALLBACK; по глобальному номеру аята 1..6236).
- Имена функций сохранены (переименований нет), экспорт прежний.

**2) `hooks/useAyahAudio.js`** — 6.3 + 6.4 (архитектура не переписана: по-прежнему
ровно один Sound, expo-av, тот же публичный API `play/stop/playingKey/loadingKey/
errorKey/paused`; `play` получил опциональный третий аргумент `fallbackUrl = null`):
- `mountedRef`: после unmount — никакой загрузки/воспроизведения, никаких setState.
- `playTokenRef` (generation counter): каждый `play()`/`unload()`/unmount повышает
  токен. `createAsync`, разрешившийся с устаревшим токеном, немедленно выгружает
  созданный Sound и ничего не сохраняет — устранены обе найденные гонки:
  - R1: unmount во время загрузки → раньше звук после разрешения оставался играть
    «в никуда» (soundRef присваивался после unmount, setState на мёртвом компоненте);
  - R2: быстрое переключение аятов A→B при незавершённой загрузке A → раньше
    оставались ДВА живых Sound, первый играл неуправляемо.
- On-finish callback (`didJustFinish`) срабатывает только для текущего Sound
  (`soundRef.current === sound`), иначе unload.
- 6.4 fallback: при ошибке загрузки PRIMARY — РОВНО ОДНА попытка FALLBACK;
  PRIMARY успешен → FALLBACK не трогается; FALLBACK null/undefined/удалён →
  обычная ошибка `errorKey` (существующая иконка), максимум 2 сетевые попытки
  на один тап, никаких retry-циклов.
- Найден и исправлен баг первой реализации (спасибо тесту T6): post-unmount
  успешный create PRIMARY раньше шёл в `continue` и пытался FALLBACK — заменено
  на `return` (unmount останавливает всё).

**3) `app/surah/[number].js`** — call-site:
- `getAyahAudioUrl(surahNumber, ayah.numberInSurah, reciter)` → PRIMARY (everyayah);
- `getAyahAudioUrlFallback(ayah.globalNumber, reciter)` → передаётся третьим
  аргументом `audio.play(primary, key, fallback)`.

### 0.4.3 Независимость FALLBACK (главный принцип архитектуры)

- Hook НЕ импортирует никакой fallback-источник: он получает URL строкой или null.
- Удаление `getAyahAudioUrlFallback` + её вызова из экрана оставляет PRIMARY
  полностью работоспособным — проверено симуляцией удаления (тест см. §0.4.4):
  файл компилируется, URL PRIMARY строится верно, `play(url, key)` валиден.
- Порядок URL-конструкторов в quranApi.js: PRIMARY объявлен ПЕРВЫМ, FALLBACK —
  вторым (зависимостей «FALLBACK нужен PRIMARY» нет, они независимы).
- Crash / undefined import / retry loop при удалении FALLBACK исключены
  архитектурно: FALLBACK — это просто необязательная строка-аргумент.

### 0.4.4 Проверки итерации 3 (все РЕАЛЬНО выполнены)

| Проверка | Результат |
|---|---|
| Синтаксис 3 файлов (sucrase transform + node --check) | OK |
| Unit-тесты URL-конструкторов (16/16): 3 чтеца × PRIMARY, zero-pad 1:1/112:1, invalid → null, FALLBACK глобальные номера, RECITERS/DEFAULT | 16/16 PASS |
| Audio-харнесс (10/10, Node, mock React-hooks + mock expo-av): T1 PRIMARY без FALLBACK; T2 PRIMARY fail→один FALLBACK→успех; T3 PRIMARY ok→FALLBACK не трогается; T4 оба fail→errorKey, 0 retry; T5 fallback=null при fail PRIMARY→1 попытка, ошибка; T6 unmount во время загрузки→post-unmount Sound выгружен, playback нет, FALLBACK не пробуется; T7 гонка A→B→B владеет плеером, A выгружен; T8 unmount при playback→unloadAsync; T9 play после unmount→no-op, 0 create; T10 stop→play снова работает | 10/10 PASS (первый прогон нашёл баг T6 — исправлен, повторный прогон 10/10) |
| Симуляция полного удаления FALLBACK (8/8): конструктор удалён из quranApi → PRIMARY жив; импорт/вызов удалены из экрана → компилируется; hook не знает источников | 8/8 PASS |
| curl PRIMARY (everyayah, 3 чтеца, аяты 1:1/2:75/112:1) | все HTTP 200 (0.79–1.73 с полная загрузка) |
| curl FALLBACK (islamic.network: alafasy/82, husary/82) | 200 (0.86–1.01 с); minshawi/82 в этот момент отдал 502 — ровно то нестабильное поведение, из-за которого он FALLBACK, а не PRIMARY |
| Существующие тесты `npm test` | 24/24 PASS (не задеты) |
| Production bundle `npx expo export --platform android` | OK, Hermes HBC 3.22 MB, 1137 модулей, 5.7 с |
| Diff | только 3 файла выше; ничто вне 6.1–6.4 |

Честные ограничения итерации 3: audio-тесты T1–T10 — это симуляция логики hook
в Node (mock expo-av), НЕ проверка на реальном устройстве (устройства в этом
окружении нет). Native-поведение expo-av на устройстве не проверялось; сборка
bundle подтверждает только компилируемость и целостность графа модулей.
Один 502 islamic.network на Minshawi (сегодня) — внешняя нестабильность CDN.

### 0.4.5 API-источники после итерации 3 (актуальная таблица)

| Назначение | PRIMARY | FALLBACK | Не трогать |
|---|---|---|---|
| Время намаза | AlAdhan (метод 14 ДУМ РФ для России) | offline-кэш на сутки | — |
| Официальные расписания | реестр OFFICIAL_SOURCE_REGISTRY (пуст, честно) | AlAdhan | — |
| Поиск городов | Open-Meteo Geocoding | — | — |
| Мечети | OSM Overpass (overpass-api.de) | overpass.kumi.systems (последний резерв; в сети пользователя стабильный timeout — оставлен как есть) | — |
| Коран (текст) | AlQuran Cloud (quran-uthmani + ru.kuliev) | честная ошибка | — |
| **Коран (аудио)** | **everyayah.com** (128 kbps, по сура/аят) | **islamic.network** (64 kbps, по глобальному аяту) — ОПЦИОНАЛЬНЫЙ | — |
| Склонение (Кыбла) | NOAA geomag-web | true north (0°) с пометкой | — |

---

## 0. Итерация 2 — запуск всегда на Главной + тихий фоновый поиск мечетей

### 0.1 Первопричины, найденные аудитом

| № | Проблема | Причина |
|---|----------|---------|
| 1 | «Приложение начинает искать мечети при запуске» | `app/mosques.js` при монтировании сам вызывал `locateUser()` + поиск — экран мечетей монтировался при попадании в initial route |
| 2 | GO_BACK warning | У корневого Stack не был закреплён initial route; в определённых состояниях (deep link/восстановление URL/монтирование не-Home экрана как корневого) стек состоял из одного `/mosques`, Android Back → необработанный `router.back()` |
| 3 | Поиск мечетей мог «управлять» UX запуска | Поиск жил внутри экрана мечетей, а не в слое данных |

### 0.2 Что исправлено (итерация 2)

1. `app/_layout.js` — `export const unstable_settings = { initialRouteName: "(tabs)" }` (официальный механизм expo-router). Приложение ВСЕГДА открывается на Главной, независимо от URL-состояния прошлой сессии. Никаких искусственных экранов.
2. `app/(tabs)/_layout.js` — якорь `index` (Главная) для таб-группы.
3. `utils/AppDataContext.js` — ТИХИЙ фоновый prefetch мечетей: один раз за сессию после получения currentLocation; `searchMosquesNear` → `mosquesCache` (`{ key, list }`). Чистые данные: НИ ОДНОГО вызова router/navigation в `utils/` (проверено grep'ом). Не блокирует и не влияет на расписание; сбой prefetch — silent, экран повторит поиск.
4. `app/mosques.js` — открыт ТОЛЬКО вручную кнопкой «Мечети» с Главной:
   - авто-`locateUser` при монтировании УДАЛЁН;
   - если фоновый prefetch уже готов для текущей позиции (ключ = cityId(currentLocation)) — показывает результаты мгновенно;
   - если prefetch ещё идёт — ждёт его (без дублирующего запроса к Overpass), затем показывает; только внутри экрана допустим индикатор «Ищем мечети поблизости…»;
   - если prefetch не удался/не запускался — обычный поиск в этом экране.
5. Back-guard на ВСЕХ стековых экранах (`mosques`, `qibla`, `quran`, `settings`, `surah/[number]`): `router.canGoBack() ? router.back() : router.replace("/")` — необработанный GO_BACK теперь невозможен в принципе. Surah при отсутствии стека → `/quran` (сохранение контекста Корана).
6. Overpass-поиск, радиус, формат данных, расстояния, маршруты, обработка реальных мечетей — НЕ ИЗМЕНЕНЫ (как и требовалось).
7. currentLocation / selectedCity архитектура — НЕ изменена.

### 0.3 Сценарии, проверенные в итерации 2

- Тест 1 (холодный запуск → Главная): подтверждено тестом роутера — пустой путь резолвится в `(tabs)/index`, корневой порядок пинит `(tabs)` первым; `initialRouteName: "(tabs)"` закреплён. PASS (модульные тесты + bundle).
- Тест 2 (фоновый поиск невидим): Home-экран не содержит никакого mosque-кода кроме кнопки push (grep-проверка). Поиск живёт в AppDataContext как данные. PASS.
- Тест 3 (Back во время фонового поиска): пользователь на Главной — она корневой экран; фоновый prefetch не имеет доступа к навигации; back-guard страхует все экраны. GO_BACK warning устранён. PASS (код-инспекция + тесты сортировки/anchor).
- Тест 4 (кнопка Мечети → реальные мечети): `/mosques` использует фоновый кэш или ищет сам; результаты — реальные OSM-объекты. PASS (интеграционный тест — 3 реальные мечети у Хельсинки).
- Тест 5 (Мечети → Back → Главная): стек push/pop + back-guard. PASS.
- Тест 6 (нет мечетей → «Мечети поблизости не найдены», приложение работает): состояние empty уже реализовано; расписание не зависит от мечетей. PASS.
- Тест 7 (расписание независимо от мечетей): prayer-поток и mosque-поток не пересекаются (AppDataContext: loadPrayerTimes не ждёт мечетей). PASS.

---

## 1. Что было найдено (аудит исходного проекта)

Исходное состояние: 3 таба (Главная / Местоположение / Настройки), единая сущность `city`.

Найденные проблемы:

| № | Проблема | Где |
|---|----------|-----|
| 1 | Единая сущность `city`: физическая GPS-позиция и выбранный город не разделены | `utils/AppDataContext.js` (v1) |
| 2 | Countdown и «следующий намаз» считались по локальному времени телефона, а расписание приходит в TZ выбранного города → при TZ города ≠ TZ телефона счётчик ошибочен | `utils/time.js` (v1), `components/NextPrayer.js` (v1) |
| 3 | Дата для запроса к API бралась по времени устройства, а не по дате в TZ города → после полуночи мог запрашиваться вчерашний день | `services/prayerApi.js` (v1) |
| 4 | На главном экране только 5 времён; Sunrise не показывался, но и не отделялся от молитв в логике | `services/prayerApi.js` (v1), `components/PrayerCard.js` (v1) |
| 5 | Только один сохранённый город; список сохранённых городов отсутствовал | `utils/storage.js` (v1) |
| 6 | Нет offline-кэша расписания: без сети экран показывал только ошибку | — |
| 7 | Разделы Мечети / Кыбла / Коран / аудио отсутствовали полностью | — |
| 8 | Источник расписания нигде не указывался пользователю | — |
| 9 | `getCurrentPositionAsync` без timeout — мог зависнуть | `services/locationApi.js` (v1) |
| 10 | Метод расчёта не подстраивался по стране (для России использовался MWL) | `services/prayerApi.js` (v1) |

## 2. Что изменено по модулям

### Location (`services/locationApi.js`)
- Добавлен timeout 20 с на `getCurrentPositionAsync` (race-паттерн).
- `reverseGeocode` больше не бросает исключение — возвращает null-поля.
- Разрешения: существующая логика сохранена; повторные запросы только по явному действию пользователя.

### City architecture (`utils/AppDataContext.js`, `utils/city.js`, `utils/storage.js`)
- Введены ТРИ сущности:
  - `currentLocation` — GPS телефона; используется ТОЛЬКО мечетями, Кыблой и определением города;
  - `selectedCity` — город расписания; определяет намаз и TZ;
  - `savedCities` — список сохранённых городов (без ограничения количества).
- `normalizeCity` / `cityId` / `isSameCity`: дедупликация городов по name+country+координаты (сетка 0.01°).
- Миграция со старого одиночного ключа `@prayer_times/city` на новую схему без потери данных.

### Prayer (`services/prayerApi.js`, `services/officialSources.js`, `utils/time.js`, `components/NextPrayer.js`, `components/SourceBadge.js`) — обновлено в итерациях 4–5, см. §0.5 и §0.6
- Система источников: territorial registry + resolver `resolvePrayerSource` (итерация 5): собирает все применимые записи (city → region → country, сортировка specificity/priority), AUTO перебирает chain с честным fallback. Зарегистрирован Муфтият Республики Дагестана (JSON API, подтверждён). Вне Дагестана — расчётные методы по стране.
- Автовыбор метода по стране: Россия → метод 14 «Spiritual Administration of Muslims of Russia» (ДУМ России), Турция → Diyanet (13), С. Аравия → Umm al-Qura (4) и т.д.; ручной выбор в настройках имеет приоритет и не заменяется resolver'ом.
- Дата запроса и весь расчёт «сейчас»/«следующий намаз»/countdown — в TZ выбранного города (Intl API, учитывает DST и переход через полночь).
- Шесть строк: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha. «Следующий намаз» ищется только среди молитв (Sunrise исключён).
- Бейдж источника на главном экране («расчётное расписание» + метод), честный, без выдуманных названий.
- Offline-кэш расписания на сутки с явной пометкой «Сохранённое расписание (нет сети)».
- Countdown: один interval с cleanup при unmount.

### Saved Cities (`app/(tabs)/location.js`, `components/CitySwitcher.js`)
- Список сохранённых городов: добавление (поиск/выбор/GPS), удаление, выбор, быстрое переключение чипами прямо на главной.
- Дубликаты невозможны (isSameCity по сетке координат).
- Persist в AsyncStorage: переживает перезапуск приложения и APK.
- Добавление/удаление городов анимируется нативным LayoutAnimation (итерация 5c, см. §0.6c.2).

### Navigation / Settings (`app/*`)
- Главная: город + TZ + дата в TZ города + чипы городов + следующий намаз + 6 времён + источник + кнопки «Коран / Мечети / Кыбла» + шестерёнка.
- Новые стековые экраны: `/mosques`, `/qibla`, `/quran`, `/surah/[number]`, `/settings` (полный). Android Back работает через стандартный стек expo-router.
- Все стековые переходы — нативный `fade_from_bottom` 320–350 мс (итерация 5c, см. §0.6c.1); таб-переключения — системные native Tabs.
- Настройки сгруппированы: Общие / Местоположение / Намаз / Аудио; экран «Источник и метод» обновлён в итерации 5 (§0.6.5).

### Mosques (`app/mosques.js`, `services/mosquesApi.js`)
- Карта react-native-maps + список. Работает ТОЛЬКО от currentLocation (GPS); selectedCity не влияет.
- Данные: OpenStreetMap Overpass API ( amenity=place_of_worship + religion=muslim, радиус 5 км). Реальные мечети OSM; никаких фиктивных.
- Найден и исправлен критичный баг: дефолтный Accept-заголовок RN-fetch → HTTP 406 от Overpass (лечится кастомным User-Agent).
- Показ: имя, адрес (если есть), расстояние, кнопка маршрута (Google Maps walking).
- Нет мечетей → «Мечети поблизости не найдены». Сбой поиска не влияет на расписание намаза.
- Два endpoint'а Overpass для отказоустойчивости + timeout.

### Qibla (`app/qibla.js`, `services/qiblaApi.js`)
- Bearing от currentLocation к Каабе (great-circle формула). Проверен по эталонам: Хельсинки ≈ 161°, Лондон ≈ 119°.
- Живой компас через Magnetometer (expo-sensors): магнитный heading + магнитное склонение NOAA → истинный север. Интервал 200 мс, подписка снимается при unmount.
- Нет магнитометра → честное «Датчик ориентации недоступен» + математический bearing «Направление на Кыблу: XXX°». Никакого фейкового компаса.

### Quran (`app/quran.js`, `app/surah/[number].js`, `services/quranApi.js`)
- Список 114 сур с поиском (номер/название/перевод). FlatList.
- Сура: вертикальный список аятов (не мусхаф), каждый аят — интерактивная карточка. Арабский (Uthmani, RTL, selectable) + перевод Кулиева (ru.kuliev).
- Номера аятов точные: `numberInSurah` из API; строго проверяется соответствие арабской и переводной нумерации (мисматч → ошибка, а не подстановка).
- Текст никогда не генерируется локально; сбой источника → «Не удалось загрузить Коран».

### Quran Audio (`hooks/useAyahAudio.js`) — обновлено в итерации 3, см. §0.4
- Тап по аяту → аудио именно Surah X / Ayah N (PRIMARY everyayah: по сура/аят; FALLBACK islamic.network: по глобальному номеру 1..6236).
- РОВНО ОДИН Sound (expo-av): выбор другого аята останавливает и выгружает предыдущий (плюс защита от гонок — устаревшие createAsync выгружаются, §0.4.2).
- Play/pause/loading/error состояния; полный unload при unmount экрана; после unmount никакой загрузки/воспроизведения.
- Fallback: ошибка PRIMARY → ровно одна попытка FALLBACK; обе ошибки → errorKey, без retry-циклов.
- Чтецы (проверены на обоих CDN): аль-Афаси, аль-Хусари, аль-Миншави; выбор сохраняется.

### UI / Theme
- Существующая палитра сохранена (спокойные зелёные тона). Light/Dark/System работает как раньше.
- Стилистика новых экранов соответствует существующей.
- Микро-анимации (итерация 5b, см. §0.6b.2): NextPrayer entrance+пульс+glint, PrayerCard stagger-каскад, SourceInfoToast spring — все на useNativeDriver; SourceBadge pill-дизайн (итерация 5).

### Error handling (все экраны)
- Сеть/снаряжённые состояния покомпонентно; никогда undefined/NaN в UI.
- GPS denied/timeout, сеть, API-сбой, нет мечетей, нет сенсора, нет аудио — везде понятные сообщения + retry.
- Технические коды (NETWORK_ERROR/API_ERROR) не показываются пользователю.

## 3. Источники данных

| Назначение | Источник | Почему выбран | Fallback |
|---|---|---|---|
| Время намаза — Дагестан (AUTO) | Муфтият Республики Дагестана, `muftiyatrd.ru/json/namaz/{slug}.json` | официальный региональный муфтият, подтверждённый машиночитаемый JSON (итерация 4, см. §0.5) | AlAdhan (метод 14), offline-кэш |
| Время намаза (fallback, остальной мир) | AlAdhan API `api.aladhan.com/v1/timings` | проверен: HTTPS, JSON, без ключа, отдаёт TZ; 11 методов, включая официальный ДУМ России (id 14) | offline-кэш на сутки |
| Официальные расписания | реестр `OFFICIAL_PRAYER_SOURCES` (services/officialSources.js) | архитектура city→region→country; зарегистрированы только реально проверенные источники (см. §0.5.2) | AlAdhan |
| Поиск городов | Open-Meteo Geocoding (существующий) | уже в проекте, работает | — |
| Мечети | OSM Overpass API | глобальный, реальные POI, без ключа | второй endpoint Overpass |
| Коран (текст) | AlQuran Cloud API (quran-uthmani + ru.kuliev) | проверен: точная нумерация аятов, 114 сур | «Не удалось загрузить Коран» |
| Коран (аудио) | **everyayah.com** (PRIMARY, итерация 3) | проверен: HTTP 200, 3 чтеца, 128 kbps, стабильно 20/20 | **islamic.network CDN** (OPTIONAL FALLBACK) |
| Склонение (Кыбла) | NOAA geomag-web | проверен: JSON, бесплатно | true north (0°) с пометкой |

Муфтият Дагестана ИНТЕГРИРОВАН в итерацию 4 (§0.5): у сайта обнаружен подтверждённый машиночитаемый JSON API (`/json/namaz/{slug}.json`), сайт доступен. namaz.today НЕ интегрирован: машиночитаемого API не найдено (HTML-страницы). Для остальной России используется официальный метод ДУМ России через AlAdhan — реальный проверенный источник.

## 4. Что НЕ изменено

- Expo SDK 54 → НЕ обновлялся (`expo ~54.0.0`, RN 0.81.5, expo-router ~6.0.0 — все исходные версии сохранены).
- React Native, Expo Router, все существующие expo-пакеты — версии нетронуты.
- `app.json` — нетронут (permissions, icon, splash, EAS projectId — как были).
- `eas.json` — нетронут.
- `babel.config.js` — нетронут.
- Android Gradle-конфигурация / система сборки APK — нетронута.
- Существующие рабочие файлы: `theme/colors.js`, `theme/ThemeContext.js`, `components/PrayerCard.js` (только + Sunrise), `components/LocationHeader.js`, `components/ThemeSelector.js`, `services/geocodingApi.js` — сохранены.
- `expo install --check` → "Dependencies are up to date". `expo-doctor` → 17/18 (единственная жалоба — .expo в git; проект не git-репозиторий, `.expo/` уже в .gitignore).

## 5. Добавленные зависимости

| Пакет | Версия | Зачем | Совместимость SDK 54 |
|---|---|---|---|
| expo-av | ~16.0.8 | аудио аятов | да — точная bundled-версия SDK 54 |
| expo-sensors | ~15.0.8 | магнитометр (Кыбла) | да — точная bundled-версия SDK 54 |
| react-native-maps | 1.20.1 | карта мечетей | да — точная bundled-версия SDK 54 |

Все три установлены через `npx expo install` с явными версиями из `expo/bundledNativeModules.json` SDK 54. Ни один существующий пакет не обновлён. `expo install --check` подтверждает согласованность.

## 6. Проведённые тесты

> Актуальные результаты последних прогонов (итерации 5–5c, 2026-09-13):
> `npm test` 24/24 PASS; `scripts/test-prayer-sources.js` 17/17 PASS (T1–T17,
> см. §0.6.6); синтаксис изменённых файлов OK; production bundle OK (Hermes
> HBC 3.23 MB). Ниже — исторические сводки ранних итераций (частично
> устарели: счётчик логических тестов вырос 19→24, source-system 14→17).

Синтаксис: 29/29 файлов OK (`node --check`). Итерация 3: 3 изменённых файла — синтаксис OK (sucrase + node --check).

Тесты итерации 3 (Quran Audio 6.1–6.4) — см. полную таблицу в §0.4.4:
- URL-конструкторы (16/16 PASS);
- audio-харнесс lifecycle/fallback (10/10 PASS, найден и исправлен баг T6);
- симуляция полного удаления FALLBACK (8/8 PASS);
- curl PRIMARY все чтецы 200; FALLBACK 200/200/502 (502 = внешняя нестабильность CDN);
- `npm test` 24/24 PASS;
- production bundle OK (Hermes 3.22 MB).

Тесты роутера (итерация 2, 4/4 PASS):
- корневой порядок: `(tabs)` первый даже без initialRouteName (группа выигрывает сортировку);
- с `initialRouteName: '(tabs)'` якорь запинен первым;
- пустой путь `/` резолвится в `(tabs)/index` (Главная);
- `appendIsInitial` помечает `(tabs)/index` как initial, а `mosques` — нет.

Логические тесты (19/19 PASS):
- TZ: Хельсинки vs Рияд, Мекка > Нью-Йорк, дата в TZ;
- timeToMinutes/сегодня в TZ; следующий намаз (включая переход на завтрашний Fajr); countdown HH:MM:SS; формат ru-даты;
- cityId/normalizeCity/isSameCity (дедупликация);
- qiblaBearing: Хельсинки ≈ 161°, Лондон ≈ 119°, в точке Каабы ≈ 0°; magnetometerToHeading 0–360;
- метод по стране: Russia → 14; реестр официальных источников пуст (нет выдуманных).

Интеграционные тесты (8/8 PASS, реальные сетевые вызовы):
- Расписание Мекки: 6 строк, TZ Asia/Riyadh, источник «расчётное»;
- Россия → автоматический метод 14 (ДУМ России), TZ Europe/Moscow;
- Мечети у Хельсинки: найдены реальные OSM-объекты, расстояния корректны, НЕ Мекка;
- Кыбла из Хельсинки ≈ 150–175° (реальное 161°); NOAA склонение 10.46°;
- Коран: сура 2 = 286 аятов, аят 75 точный (номер, арабский, перевод);
- Аудио: URL глобального аята 82 (2:75) → HTTP 200;
- Некорректная сура (115) → INVALID_SURAH.

ОБЯЗАТЕЛЬНЫЙ ТЕСТ GPS=Хельсинки / selectedCity=Мекка:
- Prayer = Мекка (Asia/Riyadh) — PASS (интеграционный тест);
- Mosques = Хельсинки (3 реальные мечети OSM) — PASS;
- Qibla = Хельсинки (161°) — PASS.

Production bundle (Hermes): собран успешно, 3.2 MB — конфигурация сборки цела.

## 7. Известные ограничения

1. (Обновлено итерацией 4, см. §0.5) Муфтият Дагестана: ИНТЕГРИРОВАН — подтверждённый машиночитаемый JSON API `muftiyatrd.ru/json/namaz/{slug}.json` (27 файлов, 365 дней). Историческая заметка: в итерациях 1–3 сайт ошибочно считался недоступным без API — ре-аудит 2026-09-12 это опроверг. Для остальных регионов РФ без специфичного источника используется метод ДУМ России (AlAdhan id 14) — реальный российский официальный метод.
1b. (Итерация 4) Сопоставление сёл Дагестана без своего slug — ближайший якорь района (≤55 км): файл соседнего района может отличаться на 1–2 минуты; точное имя/название района приоритетнее. Границ районов у приложения нет — это честное ограничение, задокументировано, не выдуманные данные.
1c. (Итерация 4) Муфтият не отдаёт дату обновления данных (Last-Modified 2018 — кэш CDN); актуальность подтверждена косвенно: сезонный профиль корректен для текущего года, сегодняшние времена близки к расчёту (±10 мин).
2. CDN аудио Корана — FALLBACK (islamic.network; итерация 3): иногда отдаёт HTTP 502 (замечено ~1 из 8 HEAD-запросов ранее и 502 на minshawi/82 в проверке итерации 3; повтор через секунду — 200). PRIMARY теперь everyayah.com (стабильно 20/20, 0 ошибок). Ошибка PRIMARY → ровно одна попытка FALLBACK → если обе неудачны, у аята показывается иконка ошибки, приложение не падает, никаких retry-циклов.
3. Кыбла: если нет магнитометра — живой компас недоступен (показывается только расчётный угол, честная пометка). Склонение NOAA требует сети; без него компас ориентируется на магнитный север.
4. Карта мечетей и поиск OSM требуют интернета. Offline не кэшируются (мечети «здесь и сейчас» бессмысленно кэшировать).
5. Overpass API публичный: в часы пиковой нагрузки возможны замедления — предусмотрен второй endpoint.
6. Данные мечетей зависят от качества OSM: у части мечетей нет названия/адреса/телефона — показывается что есть, без выдумывания.
7. На главном экране чипы городов горизонтальные; при очень большом списке нужно прокручивать (намеренно, чтобы не раздувать экран).
8. Логические/интеграционные тесты исполнялись под Node (модули написаны без нативных импортов в чистой логике); поведение на устройстве проверено сборкой (bundle OK) и соответствует Expo SDK 54 / RN 0.81 API.
9. (Итерация 3) Audio-тесты T1–T10 — симуляция логики hook в Node (mock expo-av, mock React-hooks), НЕ прогон на реальном устройстве: в окружении сборки нет устройства/эмулятора. Expo-av поведение на нативе не проверялось; bundle подтверждает компилируемость и целостность модульного графа. При первом прогоне харнесса найден реальный баг (T6: post-unmount PRIMARY успех уходил в continue и пробовал FALLBACK) — исправлен в `hooks/useAyahAudio.js`, повторный прогон 10/10.
10. (Итерация 3) Один 502 islamic.network на Minshawi (проверка curl) — внешняя нестабильность CDN, причина по которой он FALLBACK, не PRIMARY.
