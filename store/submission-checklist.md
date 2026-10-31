# Публикация LastSticker Search в Chrome Web Store

## 0. Что уже готово

- Версия: 1.2.1.
- ZIP расширения: `laststicker-search-1.2.1.zip` в GitHub Release.
- Тексты карточки: `store/listing-ru.md`.
- Политика конфиденциальности: `PRIVACY.md`.

## 1. Подготовить публичный URL политики

Chrome Web Store требует публичный URL, который открывается без входа.

Варианты:

1. GitHub Gist (публичный) с содержимым `PRIVACY.md`.
2. GitHub Pages в отдельном публичном репозитории.
3. Собственный сайт/домен.

Готовый публичный URL политики:

https://gist.github.com/lavandiI/cf987c5fabdf10f52d1b65d3698bb21d

Его нужно вставить в дашборд Chrome Web Store.

## 2. Подготовить скриншоты

Минимум один скриншот:

- 1280×800 (рекомендуется) или 640×400;
- панель поиска с результатами;
- без реальных имён и сообщений — используйте тестовые данные или размытие.

Желательно два скриншота:

1. Главная панель с результатами поиска.
2. Панель на странице диалога или прогресс индексации.

## 3. Скачать ZIP

Скачать `laststicker-search-1.2.1.zip` из GitHub Release:

https://github.com/lavandiI/laststicker-search/releases/download/v1.2.1/laststicker-search-1.2.1.zip

Проверить, что внутри есть `manifest.json` в корне, а не вложенная папка.

## 4. Загрузить в Chrome Web Store

1. Открыть https://chrome.google.com/webstore/devconsole
2. Нажать **New item** / **Добавить новый элемент**.
3. Загрузить ZIP.
4. Заполнить карточку:
   - название: `LastSticker Search`;
   - краткое описание из `store/listing-ru.md`;
   - подробное описание;
   - категория: Productivity;
   - язык: Русский;
   - иконка 128×128 уже внутри ZIP.
5. Загрузить скриншоты.
6. Заполнить **Privacy practices**:
   - single purpose;
   - обоснования `storage`, `scripting`, `tabs`, host permissions;
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
