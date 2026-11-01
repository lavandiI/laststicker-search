# Публикация LastSticker Search 1.5.0 в Chrome Web Store

## 0. Что уже готово

- Версия **1.2.1 опубликована** для всех.
- Следующая версия — **1.5.0**; она включает изменения 1.3.0, 1.3.1, 1.4.0 и поиск по форуму.
- 1.4.0 отдельно не загружаем, чтобы не проходить два ревью подряд.
- Ветка подготовки: `release/1.5.0`.
- Тексты карточки: `store/listing-ru.md`.
- Политика конфиденциальности: `PRIVACY.md` и `docs/privacy.html`.
- ZIP: `dist/laststicker-search-1.5.0.zip`.

## 1. Проверить версию и собрать ZIP

```bash
git checkout release/1.5.0
npm ci
npm test -- --runInBand
npm run lint
npm run package
```

Проверить, что:

- в `manifest.json` и `package.json` версия **1.5.0**;
- ZIP содержит `manifest.json` в корне, а не во вложенной папке;
- внутри есть `forum-parser.js`, `forum-storage.js`, `forum-indexer.js`.

## 2. Публичный URL политики

Политика должна открываться без входа:

- главная: https://lavandii.github.io/laststicker-search/
- политика: https://lavandii.github.io/laststicker-search/privacy.html
- поддержка: https://github.com/lavandiI/laststicker-search/issues

## 3. Скриншоты

Три файла 1280×800, 24-бит PNG без альфа-канала:

1. `store/screenshot-dialogs-1.5.0.png` — панель поиска по диалогам.
2. `store/screenshot-forum-1.5.0.png` — глобальный поиск по темам форума.
3. `store/screenshot-topic-1.5.0.png` — панель темы с поиском только по ней.

В кадре нет реальных имён и сообщений — данные демонстрационные.

Рекламные изображения:

- `store/promo-440x280.png` — 440×280 PNG, **Small promo tile**;
- `store/marquee-1400x560.jpg` — 1400×560 JPEG, 24-бит без альфа-канала, **Marquee promo tile**.

## 4. Загрузить в Chrome Web Store

1. Открыть https://chrome.google.com/webstore/devconsole
2. Выбрать **LastSticker Search**.
3. Открыть **Package → Upload new package** и загрузить `laststicker-search-1.5.0.zip`.
4. Проверить карточку:
   - название: `LastSticker Search`;
   - краткое описание из `store/listing-ru.md`;
   - подробное описание с форумом;
   - категория: Tools (группа Productivity);
   - язык: Русский;
   - иконка 128×128 уже внутри ZIP.
5. Загрузить три скриншота 1.5.0, `store/promo-440x280.png` в **Small promo tile** и `store/marquee-1400x560.jpg` в **Marquee promo tile**.
6. Проверить **Privacy practices**:
   - single purpose: диалоги и форум laststicker.ru;
   - обоснования `storage`, `scripting`, `offscreen`, `alarms`, host permissions;
   - data usage: Personal communications, Website content, Personally identifiable information — только локальное хранение;
   - remote code: No;
   - privacy policy URL.
7. Проверить видимость: сейчас расширение **Public — опубликовано для всех**.
8. Отправить на review.

## 5. После публикации

Chrome сам обновит расширение у пользователей. Для следующей версии:

1. Поднять версию в `manifest.json`, `package.json`, `package-lock.json`.
2. Обновить `CHANGELOG.md`.
3. Собрать новый ZIP.
4. Загрузить его в дашборд и отправить на review.

Теги и GitHub Releases не обновляют расширение в Chrome — источник автообновлений только Chrome Web Store.

## 6. Если review отклонит

Частые причины:

- недостаточно понятное обоснование host permissions;
- нет публичной privacy policy;
- скриншоты не показывают реальную работу расширения;
- расширение выглядит как scraping без объяснения пользы.

Что делать: уточнить описание, добавить пояснение, что расширение работает только с собственными диалогами и форумом пользователя и хранит данные локально.
