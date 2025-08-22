#!/usr/bin/env node
#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import inquirer from "inquirer";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var program = new Command();
program.name("create-orquel-app").description("Create a new Orquel application").version("0.1.0").argument("[project-name]", "Name of the project").option("--template <template>", "Template to use (minimal-node, nextjs-api)").option("--no-install", "Skip package installation").action(async (projectName, options) => {
  try {
    const config = await gatherConfig(projectName, options);
    await createProject(config);
  } catch (error) {
    console.error("\u274C Failed to create project:", error);
    process.exit(1);
  }
});
async function gatherConfig(projectName, options) {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Project name:",
      default: projectName || "my-orquel-app",
      validate: (input) => input.trim().length > 0 || "Project name is required"
    },
    {
      type: "list",
      name: "template",
      message: "Select template:",
      choices: [
        { name: "Minimal Node.js", value: "minimal-node" },
        { name: "Next.js API Routes", value: "nextjs-api" }
      ],
      default: options?.template || "minimal-node"
    },
    {
      type: "list",
      name: "embeddings",
      message: "Embeddings adapter:",
      choices: [
        { name: "OpenAI Embeddings", value: "@orquel/embeddings-openai" }
      ],
      default: "@orquel/embeddings-openai"
    },
    {
      type: "list",
      name: "vectorStore",
      message: "Vector store adapter:",
      choices: [
        { name: "Memory Store (development)", value: "@orquel/store-memory" },
        { name: "pgvector (PostgreSQL)", value: "@orquel/store-pgvector" },
        { name: "Qdrant", value: "@orquel/store-qdrant" }
      ],
      default: "@orquel/store-memory"
    },
    {
      type: "list",
      name: "answerer",
      message: "Answer adapter:",
      choices: [
        { name: "OpenAI (GPT-4)", value: "@orquel/answer-openai" }
      ],
      default: "@orquel/answer-openai"
    }
  ]);
  return {
    name: answers.name,
    template: answers.template,
    adapters: {
      embeddings: answers.embeddings,
      vectorStore: answers.vectorStore,
      answerer: answers.answerer
    },
    install: options?.install !== false
  };
}
async function createProject(config) {
  const projectPath = path.resolve(config.name);
  console.log(`
\u{1F680} Creating Orquel app: ${config.name}`);
  console.log(`\u{1F4C2} Location: ${projectPath}`);
  console.log(`\u{1F4CB} Template: ${config.template}
`);
  await fs.mkdir(projectPath, { recursive: true });
  const templatePath = path.join(__dirname, "templates", config.template);
  await copyTemplate(templatePath, projectPath, config);
  console.log("\u2705 Project created successfully!\n");
  console.log("Next steps:");
  console.log(`  cd ${config.name}`);
  if (config.install) {
    console.log("  # Dependencies are being installed...");
  } else {
    console.log("  npm install");
  }
  console.log("  # Set up your environment variables");
  console.log("  cp .env.example .env");
  console.log("  # Edit .env with your API keys");
  console.log("  npm run dev");
}
async function copyTemplate(templatePath, projectPath, config) {
  try {
    const files = await fs.readdir(templatePath, { recursive: true });
    for (const file of files) {
      const srcPath = path.join(templatePath, file);
      const destPath = path.join(projectPath, file);
      const stats = await fs.stat(srcPath);
      if (stats.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
      } else {
        let content = await fs.readFile(srcPath, "utf-8");
        content = processTemplate(content, config);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, content);
      }
    }
  } catch (error) {
    await createInlineTemplate(projectPath, config);
  }
}
function processTemplate(content, config) {
  return content.replace(/{{PROJECT_NAME}}/g, config.name).replace(/{{EMBEDDINGS_ADAPTER}}/g, config.adapters.embeddings).replace(/{{VECTOR_STORE_ADAPTER}}/g, config.adapters.vectorStore).replace(/{{ANSWERER_ADAPTER}}/g, config.adapters.answerer);
}
async function createInlineTemplate(projectPath, config) {
  const packageJson = {
    name: config.name,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "node src/index.js",
      build: "tsc",
      start: "node dist/index.js"
    },
    dependencies: {
      "@orquel/core": "^0.1.0",
      [config.adapters.embeddings]: "^0.1.0",
      [config.adapters.vectorStore]: "^0.1.0",
      [config.adapters.answerer]: "^0.1.0"
    },
    devDependencies: {
      typescript: "^5.6.3",
      "@types/node": "^20.17.6"
    }
  };
  const indexTs = `import { createOrquel } from '@orquel/core';
import { openAIEmbeddings } from '${config.adapters.embeddings}';
import { memoryStore } from '${config.adapters.vectorStore}';
import { openAIAnswerer } from '${config.adapters.answerer}';

const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: memoryStore(),
  answerer: openAIAnswerer(),
});

async function main() {
  console.log('\u{1F3AF} Welcome to your Orquel app!');
  
  // Ingest sample content
  const { chunks } = await orq.ingest({
    source: { title: 'Sample Document' },
    content: \`# Welcome to Orquel

Orquel is a TypeScript-first, open-source toolkit for building knowledge bases and retrieval-augmented generation (RAG) systems.

## Features

- Adapter-driven architecture
- Composable design
- TypeScript-first
- Production-ready\`
  });

  console.log(\`\u{1F4C4} Created \${chunks.length} chunks\`);

  // Index the chunks
  await orq.index(chunks);
  console.log('\u{1F4DA} Indexed chunks successfully');

  // Ask a question
  const { answer, contexts } = await orq.answer('What is Orquel?');
  
  console.log('\\n\u2753 Question: What is Orquel?');
  console.log(\`\u{1F4A1} Answer: \${answer}\`);
  console.log(\`\u{1F4D6} Used \${contexts.length} context chunks\`);
}

main().catch(console.error);`;
  const envExample = `# OpenAI API Key (required for embeddings and answering)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Customize OpenAI model
# OPENAI_MODEL=gpt-4
# OPENAI_EMBEDDING_MODEL=text-embedding-3-small`;
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      skipLibCheck: true,
      outDir: "./dist",
      rootDir: "./src"
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"]
  };
  const readme = `# ${config.name}

A Orquel RAG application.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your API keys
   \`\`\`

3. Run the application:
   \`\`\`bash
   npm run dev
   \`\`\`

## Learn More

- [Orquel Documentation](https://github.com/0xkoller/orquel)
- [OpenAI API Keys](https://platform.openai.com/api-keys)`;
  await fs.mkdir(path.join(projectPath, "src"), { recursive: true });
  await fs.writeFile(path.join(projectPath, "package.json"), JSON.stringify(packageJson, null, 2));
  await fs.writeFile(path.join(projectPath, "src/index.ts"), indexTs);
  await fs.writeFile(path.join(projectPath, ".env.example"), envExample);
  await fs.writeFile(path.join(projectPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));
  await fs.writeFile(path.join(projectPath, "README.md"), readme);
}
program.parse();
//# sourceMappingURL=index.js.map