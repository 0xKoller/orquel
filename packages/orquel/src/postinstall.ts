import { runSetupWizard } from './wizard.js';

async function postinstall() {
  // Skip in CI or non-interactive environments
  if (
    process.env.CI ||
    process.env.ORQUEL_NO_POSTINSTALL ||
    !process.stdout.isTTY
  ) {
    console.log('✨ Orquel installed! Run "npx orquel setup" to configure adapters.');
    return;
  }

  try {
    console.log('🎯 Welcome to Orquel!');
    console.log('Let\'s set up your RAG toolkit...\n');
    
    await runSetupWizard();
  } catch (error) {
    console.error('Setup wizard failed:', error);
    console.log('\nYou can run "npx orquel setup" later to configure adapters.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  postinstall().catch(console.error);
}