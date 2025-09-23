#!/usr/bin/env node

const WebSocket = require('ws');

function reloadApp() {
  try {
    // Try to connect to Metro's WebSocket for hot reloading
    const ws = new WebSocket('ws://localhost:8081/hot');

    ws.on('open', () => {
      console.log('📱 Reloading React Native app...');
      ws.send(JSON.stringify({
        type: 'reload'
      }));
      ws.close();
    });

    ws.on('error', (error) => {
      console.log('⚠️  Could not auto-reload app:', error.message);
      console.log('💡 Please manually reload by shaking the device and tapping "Reload"');
    });

  } catch (error) {
    console.log('⚠️  Auto-reload failed:', error.message);
    console.log('💡 Please manually reload by shaking the device and tapping "Reload"');
  }
}

// If called directly, reload immediately
if (require.main === module) {
  reloadApp();
}

module.exports = { reloadApp };