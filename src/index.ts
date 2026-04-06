#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { analyzePythonModule } from "./pythonAnalyzer.js";
import { buildSberDocOutline } from "./outline.js";
import { validateSberDoc } from "./validator.js";

function asTextContent(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

const server = new McpServer({
  name: "qwen-sber-doc-mcp",
  version: "0.1.0",
});

server.registerTool(
  "analyze_python_module",
  {
    description: "Analyzes a Python module and returns structured information about classes, functions, and parameters.",
    inputSchema: z.object({
      path: z.string().min(1),
    }).shape,
  },
  async ({ path }) => asTextContent(analyzePythonModule(path))
);

server.registerTool(
  "build_sber_doc_outline",
  {
    description: "Builds a strict Sber-style documentation outline from a Python module analysis result.",
    inputSchema: z.object({
      module_name: z.string().min(1),
      analysis: z.unknown(),
    }).shape,
  },
  async ({ module_name, analysis }) => {
    return asTextContent(buildSberDocOutline(module_name, analysis as Parameters<typeof buildSberDocOutline>[1]));
  }
);

server.registerTool(
  "validate_sber_doc",
  {
    description: "Validates that a Markdown document follows the required Sber-style structure.",
    inputSchema: z.object({
      markdown: z.string().min(1),
    }).shape,
  },
  async ({ markdown }) => asTextContent(validateSberDoc(markdown))
);

const transport = new StdioServerTransport();
await server.connect(transport);
