<p align="center">
  <img src="docs/assets/icon128.png" width="96" height="96" alt="LastSticker Search">
</p>

<h1 align="center">LastSticker Search</h1>

<p align="center">
  Локальный поиск по сообщениям в ваших диалогах на <a href="https://laststicker.ru">laststicker.ru</a>
</p>

<p align="center">
  <a href="https://github.com/lavandiI/laststicker-search/actions/workflows/ci.yml"><img src="https://github.com/lavandiI/laststicker-search/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/lavandiI/laststicker-search/releases/latest"><img src="https://img.shields.io/github/v/release/lavandiI/laststicker-search?label=version&color=2444bc" alt="Последняя версия"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f" alt="Лицензия MIT"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-2444bc" alt="Manifest V3">
</p>

<p align="center">
  <a href="https://lavandii.github.io/laststicker-search/">Сайт</a> ·
  <a href="https://lavandii.github.io/laststicker-search/privacy.html">Конфиденциальность</a> ·
  <a href="https://github.com/lavandiI/laststicker-search/releases">Релизы</a> ·
  <a href="https://github.com/lavandiI/laststicker-search/issues">Поддержка</a> ·
  <a href="CHANGELOG.md">CHANGELOG</a>
</p>

<p align="center">
  <img src="docs/assets/marquee.jpg" alt="LastSticker Search — поиск по сообщениям в диалогах" width="100%">
</p>

**LastSticker Search** — расширение Chrome (Manifest V3), которое индексирует ваши собственные диалоги на `laststicker.ru` и помогает находить нужные сообщения за секунды. Индекс хранится локально в браузере и никуда не отправляется.

## Возможности

| Возможность | Что делает |
| --- | --- |
| **Поиск по всем диалогам** | Ищет по тексту сообщений и именам собеседников в основной и архивной переписке. |
| **Переход к сообщению** | Открывает нужную страницу диалога в текущей вкладке и подсвечивает найденное сообщение целиком. |
| **Поиск внутри диалога** | На странице `/users/my_talks/{id}/` ищет только по этому разговору и показывает число сообщений. |
| **Инкрементальная индексация** | При повторном запуске пропускает диалоги, у которых не изменился счётчик сообщений. |
| **Прогресс и отмена** | Показывает, сколько диалогов обработано, и позволяет остановить длинную индексацию. |
| **Локальное хранение** | Сохраняет индекс в `chrome.storage.local`; данные не уходят на внешние серверы. |
| **Встроенная панель** | Работает прямо на странице сайта, без отдельных окон и переключения вкладок. |
| **Клавиатура** | Стрелки выбирают результат, Enter открывает, `/` фокусирует поиск. |
| **Контроль индекса** | Показывает размер индекса, предупреждает об устаревании и ошибках загрузки. |
| **Включение и отключение** | Клик по иконке расширения включает и выключает его. |

<p align="center">
  <img src="docs/assets/screenshot.png" alt="Панель поиска LastSticker Search на странице диалогов" width="820">
</p>

## Установка

### Chrome Web Store

Публикация готовится. После прохождения ревью расширение можно будет установить из магазина, и Chrome будет обновлять его автоматически.

### Вручную из ZIP

1. Скачайте `laststicker-search-1.3.1.zip` со [страницы последнего релиза](https://github.com/lavandiI/laststicker-search/releases/latest).
2. Распакуйте архив в отдельную папку.
3. Откройте `chrome://extensions/` и включите **режим разработчика**.
4. Нажмите **«Загрузить распакованное расширение»** и выберите папку, где лежит `manifest.json`.

### Из исходников

```bash
git clone https://github.com/lavandiI/laststicker-search.git
cd laststicker-search
git checkout v1.3.1
```

Далее загрузите папку через `chrome://extensions/` → «Загрузить распакованное расширение».

## Как пользоваться

1. Откройте страницу `/users/my_talks/` на `laststicker.ru`.
2. Нажмите **«Индексировать»** — начнётся сбор и сохранение сообщений.
3. Введите текст или имя собеседника в строку поиска — результаты обновятся автоматически.
4. Откройте отдельный диалог, если нужно искать только внутри него.
5. Используйте **«Показать ещё»** для больших выборок.
6. Кнопка **«Очистить»** полностью удаляет индекс из локального хранилища.

Индексация запускается только вручную. Новые сообщения попадают в поиск после повторного нажатия «Индексировать».

## Конфиденциальность

- Текст сообщений, имена собеседников, даты и идентификаторы хранятся только в `chrome.storage.local`.
- Нет аналитики, рекламы и внешних серверов.
- Данные не продаются и не передаются третьим лицам.
- Расширение не запрашивает доступ к истории просмотров и не читает вкладки других сайтов.
- Индекс удаляется кнопкой «Очистить» или при удалении расширения.

Подробнее: [политика конфиденциальности](https://lavandii.github.io/laststicker-search/privacy.html) · [PRIVACY.md](PRIVACY.md).

## Разработка

Требуется Node.js 20.19 или новее.

```bash
npm install      # установка зависимостей
npm run lint     # ESLint, без предупреждений
npm test         # Jest, 58 тестов
npm run package  # ZIP для Chrome Web Store в dist/
npm run format   # Prettier
```

Релиз: пуш тега `vX.Y.Z` запускает GitHub Actions, проверяет версии, собирает ZIP и прикладывает его к Release.

Структура проекта:

```text
manifest.json           # Manifest V3
background.js           # service worker: индексация и сетевые запросы
content.js              # content script: парсинг страниц и подсветка
inline-panel.js         # встроенная панель: поиск и навигация
inline-ui.js            # отрисовка панели
inline-storage.js       # chrome.storage.local и миграция
inline-styles.css       # стили панели
fetch-retry.js          # таймауты и повторы сетевых запросов
icons/                  # иконки 16–128 px
scripts/                # сборка ZIP для Chrome Web Store
tests/                  # unit-тесты Jest и HTML-фикстуры
docs/                   # сайт и политика для GitHub Pages
store/                  # материалы для Chrome Web Store
```

## Ограничения

- Расширение работает только с `laststicker.ru` и `www.laststicker.ru`; канонический хост — `www.laststicker.ru`.
- При индексации открываются страницы диалогов, поэтому сайт может отметить их прочитанными. Если это важно, индексируйте архив (`/users/my_talks/hide/`) — он уже прочитан.
- Повторная индексация пропускает диалоги с неизменившимся счётчиком сообщений. Для полного обновления очистите индекс.
- Первая индексация большого архива может занять несколько минут; прогресс и отмена доступны в панели.
- Расширение не связано с администрацией laststicker.ru.

## Лицензия

[MIT](LICENSE) © 2026 lavandil
