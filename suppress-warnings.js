#!/usr/bin/env node

// Suppress specific deprecation warnings while keeping others
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, type, code, ...otherArgs) {
  // Suppress the specific util.isArray deprecation warning
  if (
    typeof warning === 'string' &&
    warning.includes('util.isArray') &&
    warning.includes('deprecated')
  ) {
    return;
  }

  // Let other warnings through
  return originalEmitWarning.call(process, warning, type, code, ...otherArgs);
};

// Run the expo command
const { spawn } = require('child_process');
const args = process.argv.slice(2);
const expo = spawn('npx', ['expo', ...args], {
  stdio: 'inherit',
  shell: true
});

expo.on('exit', (code) => {
  process.exit(code);
});