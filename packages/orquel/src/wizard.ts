import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface WizardChoices {
  embeddings: string[];
  vectorStore: string[];
  answerer: string[];
}

const ADAPTER_PACKAGES = {
  embeddings: {
    'OpenAI Embeddings': '@orquel/embeddings-openai',
  },
  vectorStore: {
    'Memory Store (for development)': '@orquel/store-memory',
    'pgvector (PostgreSQL)': '@orquel/store-pgvector',
    'Qdrant': '@orquel/store-qdrant',
  },
  answerer: {
    'OpenAI (GPT-4)': '@orquel/answer-openai',
  },
};

export async function runSetupWizard(): Promise<void> {
  console.log('🔧 Orquel Setup Wizard\n');
  
  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'embeddings',
      message: 'Select embeddings adapter(s):',
      choices: Object.keys(ADAPTER_PACKAGES.embeddings),
      default: ['OpenAI Embeddings'],
      validate: (input) => input.length > 0 || 'Please select at least one embeddings adapter',
    },
    {
      type: 'checkbox',
      name: 'vectorStore',
      message: 'Select vector store adapter(s):',
      choices: Object.keys(ADAPTER_PACKAGES.vectorStore),
      default: ['Memory Store (for development)'],
      validate: (input) => input.length > 0 || 'Please select at least one vector store adapter',
    },
    {
      type: 'checkbox',
      name: 'answerer',
      message: 'Select answer adapter(s):',
      choices: Object.keys(ADAPTER_PACKAGES.answerer),
      default: ['OpenAI (GPT-4)'],
    },
  ]) as WizardChoices;

  // Collect packages to install
  const packagesToInstall: string[] = [];
  
  answers.embeddings.forEach(choice => {
    const pkg = ADAPTER_PACKAGES.embeddings[choice as keyof typeof ADAPTER_PACKAGES.embeddings];
    if (pkg) packagesToInstall.push(pkg);
  });
  
  answers.vectorStore.forEach(choice => {
    const pkg = ADAPTER_PACKAGES.vectorStore[choice as keyof typeof ADAPTER_PACKAGES.vectorStore];
    if (pkg) packagesToInstall.push(pkg);
  });
  
  answers.answerer.forEach(choice => {
    const pkg = ADAPTER_PACKAGES.answerer[choice as keyof typeof ADAPTER_PACKAGES.answerer];
    if (pkg) packagesToInstall.push(pkg);
  });

  if (packagesToInstall.length === 0) {
    console.log('No adapters selected. You can install them manually later.');
    return;
  }

  console.log(`\n📦 Installing packages: ${packagesToInstall.join(', ')}\n`);

  try {
    // Detect package manager
    const packageManager = await detectPackageManager();
    const installCommand = getInstallCommand(packageManager, packagesToInstall);
    
    console.log(`Running: ${installCommand}`);
    const { stdout, stderr } = await execAsync(installCommand);
    
    if (stderr && !stderr.includes('warn')) {
      console.error('Installation warnings:', stderr);
    }
    
    console.log('✅ Packages installed successfully!\n');
    
    // Generate usage example
    generateUsageExample(answers);
    
  } catch (error) {
    console.error('❌ Installation failed:', error);
    console.log('\nYou can install the packages manually:');
    packagesToInstall.forEach(pkg => console.log(`  npm install ${pkg}`));
  }
}

async function detectPackageManager(): Promise<'npm' | 'pnpm' | 'yarn'> {
  try {
    await execAsync('pnpm --version');
    return 'pnpm';
  } catch {
    try {
      await execAsync('yarn --version');
      return 'yarn';
    } catch {
      return 'npm';
    }
  }
}

function getInstallCommand(packageManager: string, packages: string[]): string {
  const packagesStr = packages.join(' ');
  switch (packageManager) {
    case 'pnpm':
      return `pnpm add ${packagesStr}`;
    case 'yarn':
      return `yarn add ${packagesStr}`;
    default:
      return `npm install ${packagesStr}`;
  }
}

function generateUsageExample(choices: WizardChoices): void {
  console.log('📝 Here\'s a minimal usage example:\n');
  
  const imports: string[] = [
    'import { createOrquel } from "@orquel/core";'
  ];
  
  const adapters: string[] = [];
  
  if (choices.embeddings.includes('OpenAI Embeddings')) {
    imports.push('import { openAIEmbeddings } from "@orquel/embeddings-openai";');
    adapters.push('  embeddings: openAIEmbeddings(),');
  }
  
  if (choices.vectorStore.includes('Memory Store (for development)')) {
    imports.push('import { memoryStore } from "@orquel/store-memory";');
    adapters.push('  vector: memoryStore(),');
  }
  
  if (choices.answerer.includes('OpenAI (GPT-4)')) {
    imports.push('import { openAIAnswerer } from "@orquel/answer-openai";');
    adapters.push('  answerer: openAIAnswerer(),');
  }

  const example = `${imports.join('\n')}

const orq = createOrquel({
${adapters.join('\n')}
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
  console.log('\n💡 Don\'t forget to set your environment variables (e.g., OPENAI_API_KEY)');
  console.log('📚 Check the documentation for more examples and configuration options.');
}