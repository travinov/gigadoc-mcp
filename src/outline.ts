import type { OutlineSection, PythonClass, PythonFunction, PythonModuleAnalysis, SberDocOutline } from "./types.js";

function describeFunction(item: PythonFunction): string {
  const params = item.parameters.map((parameter) => parameter.name).join(", ") || "без параметров";
  return `\`${item.name}\`: параметры ${params}; возвращаемое значение ${item.returns ?? "не указано"}.`;
}

function describeClass(item: PythonClass): string {
  const publicMethods = item.methods.filter((method) => method.visibility === "public");
  if (publicMethods.length === 0) {
    return `\`${item.name}\`: публичные методы отсутствуют или не выделены отдельно.`;
  }
  return `\`${item.name}\`: публичные методы ${publicMethods.map((method) => `\`${method.name}\``).join(", ")}.`;
}

export function buildSberDocOutline(
  moduleName: string,
  analysis: PythonModuleAnalysis
): SberDocOutline {
  const entityBullets = [
    ...analysis.classes.map(describeClass),
    ...analysis.functions.filter((item) => item.visibility === "public").map(describeFunction),
  ];

  const methodsBullets = [
    ...analysis.classes.flatMap((item) =>
      item.methods
        .filter((method) => method.visibility === "public")
        .map((method) => `\`${item.name}.${method.name}\`: описать назначение, параметры и результат.`)
    ),
    ...analysis.functions
      .filter((item) => item.visibility === "public")
      .map((item) => `\`${item.name}\`: описать назначение, параметры и результат.`),
  ];

  const sections: OutlineSection[] = [
    {
      title: "Назначение",
      bullets: [
        `Указать роль модуля \`${moduleName}\` в составе проекта.`,
        "Зафиксировать границы ответственности и связи с соседними компонентами.",
      ],
    },
    {
      title: "Основные сущности",
      bullets: entityBullets.length > 0 ? entityBullets : ["Выделить публичные сущности модуля."],
    },
    {
      title: "Публичные методы и функции",
      bullets: methodsBullets.length > 0 ? methodsBullets : ["Описать доступные публичные точки входа."],
    },
    {
      title: "Параметры и возвращаемые значения",
      bullets: [
        "Для каждого публичного метода оформить таблицу параметров.",
        "Для каждого метода зафиксировать тип или смысл возвращаемого значения.",
      ],
    },
    {
      title: "Примеры использования",
      bullets: [
        "Подобрать примеры только из реального кода, тестов или CLI-сценариев.",
        "Показать не менее одного практического сценария вызова.",
      ],
    },
    {
      title: "Практические замечания",
      bullets: [
        "Зафиксировать ограничения реализации, допущения и особенности поведения.",
      ],
    },
  ];

  return {
    moduleName,
    recommendedTitle: `Модуль \`${moduleName}\``,
    sections,
  };
}
