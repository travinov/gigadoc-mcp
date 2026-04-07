# Gigadoc MCP (Gigacode/Gemini + Qwen)

MCP server для Gigacode/Gemini/Qwen CLI, который автоматизирует анализ Python-кода и контроль качества документации.
Поддерживает как отдельные `.py` файлы, так и директории проекта.

## Публичные ссылки

1. Репозиторий MCP server: [https://github.com/travinov/gigadoc-mcp](https://github.com/travinov/gigadoc-mcp)
2. Репозиторий extension: [https://github.com/travinov/gigadoc-extension](https://github.com/travinov/gigadoc-extension)
3. Форк с документированным модулем: [https://github.com/travinov/claw-code](https://github.com/travinov/claw-code)
4. Релизы MCP: [https://github.com/travinov/gigadoc-mcp/releases](https://github.com/travinov/gigadoc-mcp/releases)
5. npm-пакет: [https://www.npmjs.com/package/gigadoc-mcp](https://www.npmjs.com/package/gigadoc-mcp)

## Актуальная версия

`gigadoc-mcp`: `0.4.3`

## Зачем это нужно

Сервер решает две основные проблемы:

1. Полнота: вытягивает реальные классы, методы и параметры из Python AST.
2. Контроль стандарта: проверяет, что Markdown соблюдает обязательную структуру и стиль.

Итог: документация становится воспроизводимой и пригодной для командного использования.

## Для кого полезно

1. Команды платформенной разработки и SDK.
2. Технические писатели и DevRel.
3. Инженеры, поддерживающие внутренние runbook/API docs.

## Инструменты MCP

1. `analyze_python_module`
Вход: `{"path":".../module.py"}`
Выход: структурированный JSON с сущностями модуля.

2. `analyze_python_target`
Вход:
- `{"path":".../module.py"}`
- `{"path":".../project_dir","max_modules":200}`
- `{"path":".../project_dir","max_modules":40,"include_modules":false}` (context-safe режим)
Выход:
- `kind=module` с анализом одного файла;
- `kind=project` с обзором проекта, списком модулей и агрегированными метриками.

3. `build_sber_doc_outline`
Вход: `{"module_name":"query_engine","analysis":{...}}`
Выход: строгий каркас документа с обязательными разделами.

4. `build_sber_project_outline`
Вход: `{"project_name":"my_project","analysis":{...}}`
Выход: каркас проектной документации для директории.

5. `validate_sber_doc`
Вход: `{"markdown":"# ..."}`
Выход: `ok` + список нарушений/предупреждений.

## Архитектура

1. Node.js сервер на `@modelcontextprotocol/sdk` (stdio transport).
2. Анализ Python выполняется через `python3` + стандартный `ast`.
3. Контракт tool-ответов JSON-friendly и удобен для интеграции с командами Qwen.

## Установка

Требования:

1. Node.js 22+
2. Python 3.x в `PATH`

```bash
git clone https://github.com/travinov/gigadoc-mcp.git gigadoc-mcp
cd gigadoc-mcp
npm install
npm run build
npm test
```

Проверка запуска:

```bash
node dist/src/index.js
```

После публикации в npm можно использовать пакет без клонирования:

```bash
npx --yes gigadoc-mcp
```

## Подключение к CLI (Gigacode/Gemini/Qwen)

В конфиге клиента (`~/.gigacode/settings.json`, `~/.qwen/settings.json` или аналог):

```json
{
  "mcpServers": {
    "gigadoc-mcp": {
      "command": "npx",
      "args": ["--yes", "gigadoc-mcp@0.4.3"],
      "timeout": 60000
    }
  }
}
```

## Ветвление по окружению

### Вариант A: стандартная сеть (рекомендуется)

Используйте конфиг выше с `npx`.

### Вариант B: корпоративные сертификаты и SSL inspection

Если npm возвращает `SELF_SIGNED_CERT_IN_CHAIN`, добавьте:

```json
{
  "mcpServers": {
    "gigadoc-mcp": {
      "command": "npx",
      "args": ["--yes", "gigadoc-mcp@0.4.3"],
      "env": {
        "NPM_CONFIG_STRICT_SSL": "false"
      },
      "timeout": 60000
    }
  }
}
```

Примечание: это временный workaround. Для постоянного варианта настройте корпоративный CA: `npm config set cafile /path/to/corp-ca.pem`.

### Вариант C: альтернативное окружение (неподхватываемый PATH)

Если CLI не находит `node`/`npx`, укажите абсолютные пути:

```json
{
  "mcpServers": {
    "gigadoc-mcp": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/npm/bin/npx-cli.js",
        "--yes",
        "gigadoc-mcp@0.4.3"
      ],
      "env": {
        "PATH": "/absolute/path/to/node/bin:/usr/bin:/bin:/usr/sbin:/sbin"
      },
      "timeout": 60000
    }
  }
}
```

### Вариант D: локальный запуск без npm registry

```bash
git clone https://github.com/travinov/gigadoc-mcp.git gigadoc-mcp
cd gigadoc-mcp
npm install
npm run build
```

```json
{
  "mcpServers": {
    "gigadoc-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/gigadoc-mcp/dist/src/index.js"],
      "timeout": 60000
    }
  }
}
```

## Проверка доступности MCP

1. Проверка пакета в npm:

```bash
npm view gigadoc-mcp version
```

2. Проверка, что сервер стартует:

```bash
npx --yes gigadoc-mcp
```

Сервер должен запуститься и ждать клиента по stdio.

## Управление контекстом (рекомендуется для больших репозиториев)

Если модель получает `API Error: terminated` или ответы становятся слишком длинными:

1. Используйте `analyze_python_target` с `max_modules=40`.
2. Для обзорного шага указывайте `include_modules=false`, чтобы не передавать детальный AST всех модулей.
3. Сначала генерируйте обзор проекта, затем отдельными шагами документируйте выбранные модули.

## Настройка под себя

Можно адаптировать поведение MCP под свою команду:

1. Скорость/объем анализа:
   - уменьшить `max_modules` (например, `20` или `40`);
   - использовать `include_modules=false` для обзорного шага.
2. Детализация:
   - сначала строить обзор проекта;
   - затем запускать документирование по конкретным файлам.
3. Совместимость с вашей сетью:
   - для корпоративного SSL включать `NPM_CONFIG_STRICT_SSL=false` как временный обход;
   - для постоянного варианта настроить `cafile`.
4. Стабильность версий:
   - фиксировать конкретную версию в args, например `gigadoc-mcp@0.4.3`.

## Companion extension

- `gigadoc-extension` содержит launcher и готовую команду `/doc:sber`.

## Примеры типовых задач

1. Аудит покрытия документации после релизных изменений API.
2. Быстрое построение шаблона docs для нового Python-модуля.
3. Валидация PR с документацией перед merge.
4. Унификация оформления техдоков в нескольких репозиториях.

## Практические сценарии

1. Перед написанием docs:
   - `analyze_python_target` -> получить факты по модулю или проекту.
2. Перед генерацией Markdown:
   - `build_sber_doc_outline` или `build_sber_project_outline` -> получить разделы и чек-лист.
3. Перед публикацией:
   - `validate_sber_doc` -> обнаружить пропуски структуры/примеров.
