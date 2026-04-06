import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { analyzePythonModule } from "../src/pythonAnalyzer.js";
import { buildSberDocOutline } from "../src/outline.js";
import { validateSberDoc } from "../src/validator.js";

const queryEnginePath = path.resolve(
  process.cwd(),
  "../claw-code/src/query_engine.py"
);

test("analyze_python_module extracts public classes and methods", () => {
  const analysis = analyzePythonModule(queryEnginePath);

  assert.equal(analysis.moduleName, "query_engine");
  assert.ok(analysis.classes.some((item) => item.name === "QueryEnginePort"));

  const queryEnginePort = analysis.classes.find((item) => item.name === "QueryEnginePort");
  assert.ok(queryEnginePort);
  assert.ok(analysis.classes.some((item) => item.methods.some((method) => method.name === "submit_message")));
});

test("build_sber_doc_outline returns required sections", () => {
  const analysis = analyzePythonModule(queryEnginePath);
  const outline = buildSberDocOutline("query_engine", analysis);

  assert.equal(outline.moduleName, "query_engine");
  assert.ok(outline.sections.some((section) => section.title === "Назначение"));
  assert.ok(outline.sections.some((section) => section.title === "Примеры использования"));
});

test("validate_sber_doc reports structural problems", () => {
  const invalid = validateSberDoc("# Черновик\n\nТекст без структуры");
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.code === "missing-section"));

  const valid = validateSberDoc(`
# Модуль query_engine

## Назначение
Текст.

## Основные сущности
Текст.

## Публичные методы
Текст.

## Параметры
| Поле | Значение |
| --- | --- |
| prompt | запрос |

## Примеры использования
\`\`\`python
print("ok")
\`\`\`

## Практические замечания
Текст.
`);
  assert.equal(valid.ok, true);
});
