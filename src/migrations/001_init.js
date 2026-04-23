const { spawn } = require('child_process');
const path = require('path');

module.exports = {
  version: 1,
  name: 'Initial estimator schema bootstrap',
  up: async () => {
    await runNodeScript(path.join(__dirname, '..', 'seedEstimatorWorkbook.js'));
  }
};

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Script failed with exit code ${code}`));
    });
  });
}