#!/usr/bin/env node
#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";

// src/wizard.ts
import inquirer from "inquirer";
import { exec } from "child_process";
import { promisify } from "util";
var execAsync = promisify(exec);
var ADAPTER_PACKAGES = {
  embeddings: {
    "OpenAI Embeddings": "@orquel/embeddings-openai"
  },
  vectorStore: {
    "Memory Store (for development)": "@orquel/store-memory",
    "pgvector (PostgreSQL)": "@orquel/store-pgvector",
    "Qdrant": "@orquel/store-qdrant"
  },
  answerer: {
    "OpenAI (GPT-4)": "@orquel/answer-openai"
  }
};
async function runSetupWizard() {
  console.log("\u{1F527} Orquel Setup Wizard\n");
  const answers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "embeddings",
      message: "Select embeddings adapter(s):",
      choices: Object.keys(ADAPTER_PACKAGES.embeddings),
      default: ["OpenAI Embeddings"],
      validate: (input) => input.length > 0 || "Please select at least one embeddings adapter"
    },
    {
      type: "checkbox",
      name: "vectorStore",
      message: "Select vector store adapter(s):",
      choices: Object.keys(ADAPTER_PACKAGES.vectorStore),
      default: ["Memory Store (for development)"],
      validate: (input) => input.length > 0 || "Please select at least one vector store adapter"
    },
    {
      type: "checkbox",
      name: "answerer",
      message: "Select answer adapter(s):",
      choices: Object.keys(ADAPTER_PACKAGES.answerer),
      default: ["OpenAI (GPT-4)"]
    }
  ]);
  const packagesToInstall = [];
  answers.embeddings.forEach((choice) => {
    const pkg = ADAPTER_PACKAGES.embeddings[choice];
    if (pkg) packagesToInstall.push(pkg);
  });
  answers.vectorStore.forEach((choice) => {
    const pkg = ADAPTER_PACKAGES.vectorStore[choice];
    if (pkg) packagesToInstall.push(pkg);
  });
  answers.answerer.forEach((choice) => {
    const pkg = ADAPTER_PACKAGES.answerer[choice];
    if (pkg) packagesToInstall.push(pkg);
  });
  if (packagesToInstall.length === 0) {
    console.log("No adapters selected. You can install them manually later.");
    return;
  }
  console.log(`
\u{1F4E6} Installing packages: ${packagesToInstall.join(", ")}
`);
  try {
    const packageManager = await detectPackageManager();
    const installCommand = getInstallCommand(packageManager, packagesToInstall);
    console.log(`Running: ${installCommand}`);
    const { stdout, stderr } = await execAsync(installCommand);
    if (stderr && !stderr.includes("warn")) {
      console.error("Installation warnings:", stderr);
    }
    console.log("\u2705 Packages installed successfully!\n");
    generateUsageExample(answers);
  } catch (error) {
    console.error("\u274C Installation failed:", error);
    console.log("\nYou can install the packages manually:");
    packagesToInstall.forEach((pkg) => console.log(`  npm install ${pkg}`));
  }
}
async function detectPackageManager() {
  try {
    await execAsync("pnpm --version");
    return "pnpm";
  } catch {
    try {
      await execAsync("yarn --version");
      return "yarn";
    } catch {
      return "npm";
    }
  }
}
function getInstallCommand(packageManager, packages) {
  const packagesStr = packages.join(" ");
  switch (packageManager) {
    case "pnpm":
      return `pnpm add ${packagesStr}`;
    case "yarn":
      return `yarn add ${packagesStr}`;
    default:
      return `npm install ${packagesStr}`;
  }
}
function generateUsageExample(choices) {
  console.log("\u{1F4DD} Here's a minimal usage example:\n");
  const imports = [
    'import { createOrquel } from "@orquel/core";'
  ];
  const adapters = [];
  if (choices.embeddings.includes("OpenAI Embeddings")) {
    imports.push('import { openAIEmbeddings } from "@orquel/embeddings-openai";');
    adapters.push("  embeddings: openAIEmbeddings(),");
  }
  if (choices.vectorStore.includes("Memory Store (for development)")) {
    imports.push('import { memoryStore } from "@orquel/store-memory";');
    adapters.push("  vector: memoryStore(),");
  }
  if (choices.answerer.includes("OpenAI (GPT-4)")) {
    imports.push('import { openAIAnswerer } from "@orquel/answer-openai";');
    adapters.push("  answerer: openAIAnswerer(),");
  }
  const example = `${imports.join("\n")}

const orq = createOrquel({
${adapters.join("\n")}
});

async function main() {
  const { chunks } = await orq.ingest({ 
    source: { title: "My Document" }, 
    content: "# Hello Orquel\\nThis is a sample document." 
  });
  
  await orq.index(chunks);
  
  const { answer } = await orq.answer("What is this document about?");
  console.log(answer);
}

main().catch(console.error);`;
  console.log(example);
  console.log("\n\u{1F4A1} Don't forget to set your environment variables (e.g., OPENAI_API_KEY)");
  console.log("\u{1F4DA} Check the documentation for more examples and configuration options.");
}

// src/cli.ts
var program = new Command();
program.name("orquel").description("Orquel RAG toolkit CLI").version("0.1.0");
program.command("setup").description("Run the setup wizard to install and configure adapters").action(async () => {
  try {
    await runSetupWizard();
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  }
});
program.parse();
//# sourceMappingURL=cli.js.map