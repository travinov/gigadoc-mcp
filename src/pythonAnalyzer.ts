import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { PythonModuleAnalysis } from "./types.js";

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

export function analyzePythonModule(filePath: string): PythonModuleAnalysis {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Python module not found: ${resolvedPath}`);
  }
  if (path.extname(resolvedPath) !== ".py") {
    throw new Error(`Expected a Python file, got: ${resolvedPath}`);
  }

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
