# Публикация LastSticker Search в Chrome Web Store

## 0. Что уже готово

- Версия: **1.2.1 на review**; следующая — 1.3.1.
- 1.3.1 включает изменения 1.3.0, отдельно 1.3.0 загружать не нужно.
- ZIP 1.3.1: `laststicker-search-1.3.1.zip` в GitHub Release (после тега).
- Тексты карточки: `store/listing-ru.md`.
- Политика конфиденциальности: `PRIVACY.md`.
- Не загружать новые версии, пока 1.2.1 на review.

## 1. Подготовить публичный URL политики

Chrome Web Store требует публичный URL, который открывается без входа.

Варианты:

1. GitHub Gist (публичный) с содержимым `PRIVACY.md`.
2. GitHub Pages в отдельном публичном репозитории.
3. Собственный сайт/домен.

Публичные URL после включения GitHub Pages:

- главная: https://lavandii.github.io/laststicker-search/
- политика: https://lavandii.github.io/laststicker-search/privacy.html
- поддержка: https://github.com/lavandiI/laststicker-search/issues

## 2. Подготовить скриншоты

Три скриншота 1280×800, 24-бит PNG без альфа-канала:

1. `store/screenshot-main-1.3.0.png` — панель с результатами поиска.
2. `store/screenshot-stale-1.3.0.png` — баннер устаревшего индекса.
3. `store/screenshot-talk-1.3.0.png` — панель на странице диалога.

В кадре нет реальных имён и сообщений — данные демонстрационные.

Рекламные изображения:

- `store/promo-440x280.png` — 440×280 PNG, **Small promo tile**;
- `store/marquee-1400x560.jpg` — 1400×560 JPEG, 24-бит без альфа-канала, **Marquee promo tile**.

## 3. Скачать ZIP

Скачать `laststicker-search-1.3.1.zip` из GitHub Release:

https://github.com/lavandiI/laststicker-search/releases/download/v1.3.1/laststicker-search-1.3.1.zip

Проверить, что внутри есть `manifest.json` в корне, а не вложенная папка.

## 4. Загрузить в Chrome Web Store

1. Открыть https://chrome.google.com/webstore/devconsole
2. Выбрать уже созданный **LastSticker Search** (1.2.1 уже на review).
3. Открыть **Package → Upload new package** и загрузить ZIP 1.3.0.
4. Проверить/заполнить карточку:
   - название: `LastSticker Search`;
   - краткое описание из `store/listing-ru.md`;
   - подробное описание;
   - категория: Tools (группа Productivity);
   - язык: Русский;
   - иконка 128×128 уже внутри ZIP.
5. Загрузить скриншоты, `store/promo-440x280.png` в **Small promo tile** и `store/marquee-1400x560.jpg` в **Marquee promo tile**.
6. Заполнить **Privacy practices**:
   - single purpose;
   - обоснования `storage`, `scripting`, host permissions;
   - data usage: Personal communications, Website content, Personally identifiable information — локальное хранение;
   - remote code: No;
   - privacy policy URL.
7. Выбрать видимость:
   - **Unlisted** — доступ только по ссылке, автообновления работают;
   - **Public** — доступен всем.
8. Отправить на review.

## 5. После публикации

Chrome сам обновляет расширение у пользователей. Для новой версии:

1. Поднять версию в `manifest.json`, `package.json`, `package-lock.json`.
2. Обновить `CHANGELOG.md`.
3. Собрать новый ZIP.
4. Загрузить его в дашборд и отправить на review.

Теги и GitHub Releases не обновляют расширение в Chrome — источником автообновлений служит только Chrome Web Store.

## 6. Если review отклонит

Частые причины:

- недостаточно понятное обоснование host permissions;
- нет публичной privacy policy;
- скриншоты не показывают реальную работу расширения;
- расширение выглядит как scraping без объяснения пользы.

Что делать: уточнить описание, добавить пояснение, что расширение работает только с собственными диалогами пользователя и хранит данные локально.
