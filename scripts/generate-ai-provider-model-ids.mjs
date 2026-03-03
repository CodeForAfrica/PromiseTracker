#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const PROVIDER_MODEL_TYPE_SOURCES = {
  google: {
    packageName: "@ai-sdk/google",
    typeName: "GoogleGenerativeAIModelId",
  },
  xai: {
    packageName: "@ai-sdk/xai",
    typeName: "XaiChatModelId",
  },
  openai: {
    packageName: "@ai-sdk/openai",
    typeName: "OpenAIChatModelId",
  },
  anthropic: {
    packageName: "@ai-sdk/anthropic",
    typeName: "AnthropicMessagesModelId",
  },
  mistral: {
    packageName: "@ai-sdk/mistral",
    typeName: "MistralChatModelId",
  },
  deepseek: {
    packageName: "@ai-sdk/deepseek",
    typeName: "DeepSeekChatModelId",
  },
  cerebras: {
    packageName: "@ai-sdk/cerebras",
    typeName: "CerebrasChatModelId",
  },
  groq: {
    packageName: "@ai-sdk/groq",
    typeName: "GroqChatModelId",
  },
  togetherai: {
    packageName: "@ai-sdk/togetherai",
    typeName: "TogetherAIChatModelId",
  },
  cohere: {
    packageName: "@ai-sdk/cohere",
    typeName: "CohereChatModelId",
  },
  fireworks: {
    packageName: "@ai-sdk/fireworks",
    typeName: "FireworksChatModelId",
  },
  deepinfra: {
    packageName: "@ai-sdk/deepinfra",
    typeName: "DeepInfraChatModelId",
  },
  perplexity: {
    packageName: "@ai-sdk/perplexity",
    typeName: "PerplexityLanguageModelId",
  },
  ollama: undefined,
};

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readTypeUnionLiterals = ({ packageName, typeName }) => {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const declarationPath = path.join(
    path.dirname(packageJsonPath),
    "dist/index.d.ts",
  );
  const source = fs.readFileSync(declarationPath, "utf8");

  const typeRegex = new RegExp(
    `type\\s+${escapeRegExp(typeName)}\\s*=\\s*([\\s\\S]*?);`,
  );
  const match = source.match(typeRegex);

  if (!match) {
    return [];
  }

  const literals = Array.from(match[1].matchAll(/'([^']+)'/g), (part) => part[1]);
  return [...new Set(literals)];
};

const output = {};

for (const [providerId, source] of Object.entries(PROVIDER_MODEL_TYPE_SOURCES)) {
  if (!source) {
    output[providerId] = [];
    continue;
  }

  try {
    output[providerId] = readTypeUnionLiterals(source);
  } catch {
    output[providerId] = [];
  }
}

const formatArray = (items) => {
  if (items.length === 0) {
    return "[]";
  }

  return `[\n${items.map((item) => `    ${JSON.stringify(item)}`).join(",\n")}\n  ]`;
};

const lines = [
  "// Generated from installed AI SDK provider type unions.",
  "// Regenerate by running: node scripts/generate-ai-provider-model-ids.mjs",
  "// Note: IDs reflect SDK-declared model names and may not always be deployed or enabled in provider accounts.",
  "",
  "export const GENERATED_PROVIDER_MODEL_IDS = {",
];

for (const providerId of Object.keys(PROVIDER_MODEL_TYPE_SOURCES)) {
  lines.push(`  ${providerId}: ${formatArray(output[providerId])},`);
}

lines.push("} as const;");
lines.push("");

const outPath = path.join(
  process.cwd(),
  "src/lib/ai/providerModelIds.generated.ts",
);

fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Wrote ${outPath}`);
for (const [providerId, modelIds] of Object.entries(output)) {
  console.log(`${providerId}: ${modelIds.length}`);
}
