# Prayer Times (Expo SDK 54)

Приложение для показа времени намаза с автоматическим определением города по геолокации и ручным выбором города.

## Установка

```bash
npm install
```

Команда `npm install` установит зависимости из `package.json`, зафиксированные под Expo SDK 54.
Если Expo предупредит о несовпадении версий каких-то пакетов, выровняйте их одной командой:

```bash
npx expo install --fix
```

## Запуск

```bash
npx expo start
```

Откройте приложение в **Expo Go** (SDK 54) — отсканируйте QR-код из терминала/браузера.

## Как работает определение местоположения

1. При первом запуске (нет сохранённого города) приложение вызывает `expo-location` и запрашивает разрешение `requestForegroundPermissionsAsync()`.
2. Если разрешение получено — берутся координаты (`getCurrentPositionAsync`), затем они превращаются в город и страну через встроенный обратный геокодер устройства (`Location.reverseGeocodeAsync`) — отдельного API-ключа для этого не нужно.
3. По координатам запрашивается время намаза через публичный AlAdhan API (`services/prayerApi.js`).
4. Если пользователь отклонил запрос геолокации — показывается предложение выбрать город вручную (вкладка «Местоположение», поиск через `services/geocodingApi.js`, использующий бесплатный Open-Meteo Geocoding API).
5. Выбранный город/тема/метод расчёта сохраняются в `AsyncStorage` (`utils/storage.js`), поэтому при следующем запуске приложение не спрашивает всё заново — сразу показывает сохранённые данные.

## Разрешения Android

В `app.json` указаны:

```json
"permissions": ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
```

Этого достаточно для получения геопозиции переднего плана (foreground) через `expo-location`. Фоновая геолокация не используется и не требуется.

## Структура проекта

```
app/
  _layout.js              — корневой layout: ThemeProvider + AppDataProvider + Stack
  (tabs)/
    _layout.js             — нижняя навигация (Tabs)
    index.js                — Главная: город, дата, ближайший намаз, карточки времён
    location.js             — Местоположение: авто-определение / поиск города
    settings.js             — Настройки: тема, метод расчёта, повторное определение
components/
  PrayerCard.js
  LocationHeader.js
  NextPrayer.js
  CitySearch.js
  ThemeSelector.js
services/
  locationApi.js           — геолокация + обратное геокодирование (expo-location)
  geocodingApi.js           — поиск городов с подсказками (Open-Meteo Geocoding API)
  prayerApi.js               — время намаза (AlAdhan API) + список методов расчёта
theme/
  colors.js                  — единая палитра цветов (светлая/тёмная)
  ThemeContext.js             — контекст темы (light/dark/system)
utils/
  storage.js                  — обёртка над AsyncStorage
  time.js                      — вычисление ближайшего намаза и обратного отсчёта
  AppDataContext.js             — состояние приложения: город, время намаза, статус загрузки
```

## Используемые внешние API (без ключей)

- **AlAdhan API** — `https://api.aladhan.com/v1/timings/{date}` — время намаза по координатам.
- **Open-Meteo Geocoding API** — `https://geocoding-api.open-meteo.com/v1/search` — поиск городов.
- **expo-location** — геолокация устройства и обратное геокодирование (координаты → город/страна).

## Обработка ошибок

- Загрузка: индикатор `ActivityIndicator` на главном экране.
- Нет интернета/ошибка API: понятное сообщение + кнопка «Повторить».
- Отказ в геолокации: понятное сообщение с предложением выбрать город вручную + кнопка повторной попытки.
