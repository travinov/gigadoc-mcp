import type { ValidationIssue, ValidationResult } from "./types.js";

const REQUIRED_SECTION_VARIANTS = [
  ["Назначение"],
  ["Основные сущности"],
  ["Публичные методы", "Публичные методы и функции", "Публичные точки входа"],
  ["Параметры", "Параметры и возвращаемые значения", "Параметры и интерфейсы"],
  ["Примеры использования"],
  ["Практические замечания"],
];

const COLLOQUIAL_MARKERS = [
  "просто",
  "легко",
  "круто",
  "удобно",
  "магия",
  "штука",
];

export function validateSberDoc(markdown: string): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const sectionVariants of REQUIRED_SECTION_VARIANTS) {
    if (!sectionVariants.some((section) => markdown.includes(section))) {
      issues.push({
        code: "missing-section",
        level: "error",
        message: `Отсутствует обязательный раздел (ожидался один из: ${sectionVariants.join(", ")}).`,
      });
    }
  }

  if (!/\|.+\|.+\|/.test(markdown)) {
    issues.push({
      code: "missing-parameter-table",
      level: "warning",
      message: "Не обнаружена таблица параметров.",
    });
  }

  if (!/```[\s\S]+```/.test(markdown)) {
    issues.push({
      code: "missing-code-example",
      level: "warning",
      message: "Не обнаружен блок с примером кода.",
    });
  }

  const lower = markdown.toLowerCase();
  for (const marker of COLLOQUIAL_MARKERS) {
    if (lower.includes(marker)) {
      issues.push({
        code: "colloquial-style",
        level: "warning",
        message: `Обнаружен разговорный маркер: ${marker}.`,
      });
    }
  }

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    issues,
  };
}
