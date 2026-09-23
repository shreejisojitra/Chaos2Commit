/**
 * Cross-platform launcher for Chaos2Commit Enhanced UI Server
 */
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'backend', 'server-enhanced.js');
console.log('Starting Chaos2Commit Enhanced Server:', serverPath);

const proc = spawn(process.execPath, [serverPath], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit'
});

proc.on('close', code => {
  console.log(`Enhanced server process exited with code ${code}`);
});
