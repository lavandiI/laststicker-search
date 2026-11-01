# LastSticker Search — Privacy Policy / Политика конфиденциальности

Effective date / Дата вступления в силу: 2026-11-01

## Русский

**LastSticker Search** — расширение Chrome для локальной индексации и поиска сообщений в собственных диалогах и на форуме `laststicker.ru`.

### Какие данные обрабатываются

- текст сообщений в диалогах и комментариев на форуме;
- имена собеседников и авторов комментариев;
- даты и время сообщений;
- идентификаторы диалогов, тем и сообщений;
- URL страниц диалогов и тем;
- названия тем, категории и метки форума;
- последний поисковый запрос и время индексации.

### Где хранятся данные

Данные сохраняются только локально в браузере пользователя:

- индекс личных диалогов — в `chrome.storage.local`;
- индекс форума — в IndexedDB расширения (`laststicker-search-forum`).

При обновлении со старой версии данные диалогов могут быть перенесены из `localStorage` сайта и удалены оттуда. Расширение не отправляет данные на серверы разработчика или третьих лиц.

### Как используются данные

Только для отображения статистики, поиска по сообщениям и перехода к найденному сообщению. Данные не продаются, не передаются и не используются для рекламы.

### Автообновление

Автообновление диалогов включено по умолчанию. Если оно включено, расширение раз в 6 часов проверяет список диалогов и обновляет локальный индекс. Автообновление пропускается, если в аккаунте есть непрочитанные сообщения или ещё не был выполнен полный индекс. Автообновление не работает, когда браузер закрыт. Его можно отключить в панели расширения.

Форум индексируется только вручную: пользователь открывает тему и нажимает «Индексировать тему». Автоматического обхода всего форума нет.

### Доступ к сайту

Расширение работает только на `laststicker.ru` и `www.laststicker.ru`. Оно читает страницы диалогов и форума, которые пользователь и так может открыть. Расширение не обходит авторизацию и не получает доступ к чужим аккаунтам.

### Разрешения

- `storage` — локальное хранение индекса;
- `scripting` — внедрение панели поиска и парсера на страницы `laststicker.ru`;
- `offscreen` — локальный парсинг HTML без открытой вкладки;
- `alarms` — периодическая проверка автообновления;
- host permissions — доступ только к `laststicker.ru` и `www.laststicker.ru`.

Расширение не запрашивает доступ к истории просмотров и не читает вкладки других сайтов.

### Удаление данных

Кнопка «Очистить» в панели диалогов удаляет индекс диалогов, кнопка «Очистить» на странице форума — индекс форума. Удаление расширения также удаляет оба локальных индекса.

### Дети

Расширение не предназначено для детей.

### Изменения

Актуальная версия политики публикуется по этому же URL.

### Контакт

Связаться с разработчиком можно через страницу расширения в Chrome Web Store.

## English

**LastSticker Search** is a Chrome extension that locally indexes and searches messages in your own dialogs and on the forum at `laststicker.ru`.

### Data processed

- message text in dialogs and comments on the forum;
- conversation partner and comment author names;
- message dates and times;
- dialog, topic, and message identifiers;
- dialog and topic page URLs;
- topic titles, categories, and forum tags;
- the last search query and the last indexing time.

### Where data is stored

Data is stored only locally in the user's browser:

- the dialog index in `chrome.storage.local`;
- the forum index in the extension's IndexedDB (`laststicker-search-forum`).

When upgrading from an older version, dialog data may be migrated from the site's `localStorage` and removed from there. The extension does not send data to the developer's or any third party's servers.

### How data is used

Only to show statistics, search messages, and navigate to a found message. Data is not sold, shared, or used for advertising.

### Automatic refresh

Automatic refresh of dialogs is enabled by default. When enabled, the extension checks the dialog list and updates the local index every 6 hours. It is skipped when the account has unread messages or when a complete index has not been built yet. It does not run while the browser is closed. It can be disabled in the extension panel.

The forum is indexed manually: the user opens a topic and clicks "Index topic". There is no automatic crawl of the entire forum.

### Site access

The extension works only on `laststicker.ru` and `www.laststicker.ru`. It reads dialog and forum pages that the user can already open. It does not bypass authentication or access other users' accounts.

### Permissions

- `storage` - local storage of the index;
- `scripting` - inject the search panel and parser into `laststicker.ru` pages;
- `offscreen` - local HTML parsing without an open tab;
- `alarms` - periodic automatic refresh;
- host permissions - access only `laststicker.ru` and `www.laststicker.ru`.

The extension does not request access to browsing history and does not read tabs on other sites.

### Data deletion

The "Clear" button in the dialog panel deletes the dialog index; the "Clear" button on the forum page deletes the forum index. Uninstalling the extension also deletes both local indexes.

### Children

The extension is not intended for children.

### Changes

The current version of this policy is published at this URL.

### Contact

Contact the developer through the extension's Chrome Web Store page.
