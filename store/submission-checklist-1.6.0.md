# Публикация LastSticker Search 1.6.0 в Chrome Web Store

## 0. Что уже готово

- Версия **1.6.0** — тёмная тема сайта и панелей поиска.
- Ветка подготовки: `release/1.6.0`.
- Настройки открываются по клику на иконку расширения (popup).
- Новых разрешений нет; настройки темы хранятся в `chrome.storage.local`.
- Тексты карточки: `store/listing-ru.md`.
- Подробное описание: `store/description-1.6.0.txt`.
- Что нового: `store/whats-new-1.6.0.txt`.
- Политика: `PRIVACY.md` и `docs/privacy.html`.

## 1. Проверить версию и собрать ZIP

```bash
git checkout release/1.6.0
npm ci
npm test -- --runInBand
npm run lint
npm run package
```

Проверить, что:

- в `manifest.json` и `package.json` версия **1.6.0**;
- ZIP содержит `manifest.json` в корне, а не во вложенной папке;
- внутри есть `theme.css`, `theme.js`, `theme-core.js`, `theme-store.js`, `popup.html`, `popup.css`, `popup.js`;
- в `manifest.json` есть `action.default_popup` и content script темы на `document_start`;
- popup содержит переключатель темы и не содержит выбора области «сайт/панели»;
- новых разрешений нет: `storage`, `scripting`, `offscreen`, `alarms`, host permissions.

## 2. Публичный URL политики

- главная: https://lavandii.github.io/laststicker-search/
- политика: https://lavandii.github.io/laststicker-search/privacy.html
- поддержка: https://github.com/lavandiI/laststicker-search/issues

## 3. Скриншоты

Пять файлов 1280×800, 24-бит PNG без альфа-канала:

1. `store/screenshot-dialogs-1.5.0.png` — поиск по всем диалогам.
2. `store/screenshot-forum-1.5.0.png` — глобальный поиск по темам форума.
3. `store/screenshot-theme-1.6.0.png` — тёмная тема, панель темы и жёлтая подсветка.
4. `store/screenshot-forum-indexing-1.5.0.png` — прогресс индексации темы.
5. `store/screenshot-highlight-1.5.0.png` — жёлтая подсветка результата и комментария.

В Dashboard заменить светлый скриншот темы (`screenshot-topic-1.5.0.png`) на тёмный `screenshot-theme-1.6.0.png`; остальные четыре оставить. В кадре нет реальных имён и сообщений — данные демонстрационные.

Рекламные изображения:

- `store/promo-440x280.png` — 440×280 PNG, **Small promo tile**;
- `store/marquee-1400x560.jpg` — 1400×560 JPEG, 24-бит без альфа-канала, **Marquee promo tile**.

## 4. Загрузить в Chrome Web Store

1. Открыть https://chrome.google.com/webstore/devconsole
2. Выбрать **LastSticker Search**.
3. Открыть **Package → Upload new package** и загрузить `laststicker-search-1.6.0.zip`.
4. Проверить карточку:
   - название: `LastSticker Search`;
   - краткое описание берётся из `manifest.json` → `description`;
   - подробное описание вставить из `store/description-1.6.0.txt` (plain text с `•`, без Markdown);
   - категория: Tools (группа Productivity);
   - язык: Русский;
   - иконка 128×128 уже внутри ZIP.
5. Заменить светлый скриншот темы на `store/screenshot-theme-1.6.0.png`; проверить остальные четыре и промо-изображения.
6. В **What's new** вставить `store/whats-new-1.6.0.txt`.
7. Проверить **Privacy practices**:
   - single purpose: диалоги и форум laststicker.ru;
   - обоснования `storage`, `scripting`, `offscreen`, `alarms`, host permissions;
   - data usage: Personal communications, Website content, Personally identifiable information — только локальное хранение;
   - настройки оформления хранятся локально, не передаются;
   - remote code: No;
   - privacy policy URL.
8. Проверить видимость: **Public — опубликовано для всех**.
9. Отправить на review.

## 5. После публикации

Chrome сам обновит расширение у пользователей. Проверить, что карточка показывает 1.6.0, а в расширении на странице `laststicker.ru` по клику на иконку открывается popup с темой.

Для следующей версии:

- обновить `CHANGELOG.md` и версии в `manifest.json`/`package.json`;
- не менять уже опубликованный пакет;
- повторить проверки и загрузку.
