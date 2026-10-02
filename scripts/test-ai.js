const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const aiAgentDir = path.resolve(__dirname, '../services/ai-agent');

function getPythonExecutable() {
  const isWindows = process.platform === 'win32';
  const venvPythonWin = path.join(aiAgentDir, 'venv', 'Scripts', 'python.exe');
  const venvPythonUnix = path.join(aiAgentDir, 'venv', 'bin', 'python');

  if (isWindows && fs.existsSync(venvPythonWin)) {
    return venvPythonWin;
  }
  if (!isWindows && fs.existsSync(venvPythonUnix)) {
    return venvPythonUnix;
  }

  return isWindows ? 'python' : 'python3';
}

const pythonBin = getPythonExecutable();
console.log(`🧪 Running AI Agent Pytest suite via: ${pythonBin}`);

const child = spawn(pythonBin, ['-m', 'pytest', 'tests/'], {
  cwd: aiAgentDir,
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error('Failed to run Pytest suite:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
