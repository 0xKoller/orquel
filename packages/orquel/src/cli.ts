#!/usr/bin/env node

import { Command } from 'commander';
import { runSetupWizard } from './wizard.js';

const program = new Command();

program
  .name('orquel')
  .description('Orquel RAG toolkit CLI')
  .version('0.1.0');

program
  .command('setup')
  .description('Run the setup wizard to install and configure adapters')
  .action(async () => {
    try {
      await runSetupWizard();
    } catch (error) {
      console.error('Setup failed:', error);
      process.exit(1);
    }
  });

program.parse();