import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type {
  PythonModuleAnalysis,
  PythonProjectAnalysis,
  PythonProjectModuleSummary,
  PythonTargetAnalysis,
} from "./types.js";

const PYTHON_AST_SCRIPT = String.raw`
import ast
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1]).resolve()
source = path.read_text(encoding="utf-8")
tree = ast.parse(source)

def text(value):
    if value is None:
        return None
    try:
        return ast.unparse(value)
    except Exception:
        return None

def extract_parameters(node):
    positional = list(node.args.posonlyargs) + list(node.args.args)
    defaults = [None] * (len(positional) - len(node.args.defaults)) + list(node.args.defaults)
    params = []
    for arg, default in zip(positional, defaults):
        params.append({
            "name": arg.arg,
            "annotation": text(arg.annotation),
            "defaultValue": text(default),
            "kind": "positional",
        })
    if node.args.vararg:
        params.append({
            "name": node.args.vararg.arg,
            "annotation": text(node.args.vararg.annotation),
            "defaultValue": None,
            "kind": "vararg",
        })
    for arg, default in zip(node.args.kwonlyargs, node.args.kw_defaults):
        params.append({
            "name": arg.arg,
            "annotation": text(arg.annotation),
            "defaultValue": text(default),
            "kind": "kwonly",
        })
    if node.args.kwarg:
        params.append({
            "name": node.args.kwarg.arg,
            "annotation": text(node.args.kwarg.annotation),
            "defaultValue": None,
            "kind": "kwarg",
        })
    return params

def function_data(node):
    return {
        "name": node.name,
        "line": getattr(node, "lineno", 0),
        "decorators": [text(item) or "" for item in node.decorator_list],
        "parameters": extract_parameters(node),
        "returns": text(node.returns),
        "docstring": ast.get_docstring(node),
        "visibility": "private" if node.name.startswith("_") else "public",
    }

classes = []
functions = []
imports = []

for node in tree.body:
    if isinstance(node, ast.Import):
        imports.extend(alias.name for alias in node.names)
    elif isinstance(node, ast.ImportFrom):
        module = node.module or ""
        imports.append(module)
    elif isinstance(node, ast.ClassDef):
        methods = [
            function_data(item)
            for item in node.body
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]
        classes.append({
            "name": node.name,
            "line": getattr(node, "lineno", 0),
            "bases": [text(base) or "" for base in node.bases],
            "decorators": [text(item) or "" for item in node.decorator_list],
            "docstring": ast.get_docstring(node),
            "methods": methods,
        })
    elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        functions.append(function_data(node))

payload = {
    "path": str(path),
    "moduleName": path.stem,
    "docstring": ast.get_docstring(tree),
    "imports": imports,
    "classes": classes,
    "functions": functions,
}

print(json.dumps(payload, ensure_ascii=False))
`;

const EXCLUDED_DIRS = new Set([
  ".git",
  ".venv",
  "venv",
  "__pycache__",
  "node_modules",
  "dist",
  "build",
]);

function resolvePythonFile(filePath: string): string {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Python module not found: ${resolvedPath}`);
  }
  if (path.extname(resolvedPath) !== ".py") {
    throw new Error(`Expected a Python file, got: ${resolvedPath}`);
  }
  return resolvedPath;
}

function parsePythonModule(resolvedPath: string): PythonModuleAnalysis {
  const result = spawnSync("python3", ["-c", PYTHON_AST_SCRIPT, resolvedPath], {
    encoding: "utf-8",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "python3 analysis failed");
  }

  return JSON.parse(result.stdout) as PythonModuleAnalysis;
}

function collectPythonFiles(rootPath: string, maxModules: number): string[] {
  const files: string[] = [];
  const stack = [rootPath];

  while (stack.length > 0 && files.length < maxModules) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".py")) {
        files.push(fullPath);
        if (files.length >= maxModules) {
          break;
        }
      }
    }
  }

  files.sort();
  return files;
}

function toProjectAnalysis(
  targetPath: string,
  modules: PythonModuleAnalysis[],
  includeModules: boolean
): PythonProjectAnalysis {
  const moduleSummaries: PythonProjectModuleSummary[] = modules.map((moduleItem) => {
    const publicFunctionCount =
      moduleItem.functions.filter((item) => item.visibility === "public").length +
      moduleItem.classes.reduce(
        (count, classItem) =>
          count + classItem.methods.filter((method) => method.visibility === "public").length,
        0
      );

    return {
      moduleName: moduleItem.moduleName,
      path: moduleItem.path,
      publicClassCount: moduleItem.classes.length,
      publicFunctionCount,
    };
  });

  return {
    targetPath,
    projectName: path.basename(targetPath),
    moduleCount: modules.length,
    totalClasses: modules.reduce((count, moduleItem) => count + moduleItem.classes.length, 0),
    totalFunctions: modules.reduce((count, moduleItem) => count + moduleItem.functions.length, 0),
    totalPublicFunctions: moduleSummaries.reduce((count, item) => count + item.publicFunctionCount, 0),
    modules: includeModules ? modules : [],
    moduleSummaries,
  };
}

export function analyzePythonModule(filePath: string): PythonModuleAnalysis {
  return parsePythonModule(resolvePythonFile(filePath));
}

export function analyzePythonTarget(
  targetPath: string,
  maxModules = 200,
  includeModules = true
): PythonTargetAnalysis {
  const resolvedPath = path.resolve(targetPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Target path not found: ${resolvedPath}`);
  }

  const targetStat = fs.statSync(resolvedPath);
  if (targetStat.isFile()) {
    return { kind: "module", module: analyzePythonModule(resolvedPath) };
  }

  if (!targetStat.isDirectory()) {
    throw new Error(`Target is not a file or directory: ${resolvedPath}`);
  }

  const files = collectPythonFiles(resolvedPath, maxModules);
  if (files.length === 0) {
    throw new Error(`No Python files found in directory: ${resolvedPath}`);
  }

  const modules = files.map((item) => parsePythonModule(item));
  return {
    kind: "project",
    project: toProjectAnalysis(resolvedPath, modules, includeModules),
  };
}
