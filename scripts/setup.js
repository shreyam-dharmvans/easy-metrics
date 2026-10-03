const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const aiDir = path.join(rootDir, 'services', 'ai-agent');

function logStep(step, message) {
  console.log(`\n\x1b[1m\x1b[36m[${step}]\x1b[0m \x1b[1m${message}\x1b[0m`);
}

function logSuccess(message) {
  console.log(`\x1b[32m✔ ${message}\x1b[0m`);
}

function logWarn(message) {
  console.log(`\x1b[33m⚠️  ${message}\x1b[0m`);
}

function logError(message) {
  console.log(`\x1b[31m✖ ${message}\x1b[0m`);
}

// 1. Detect System Python
function getSystemPython() {
  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      const res = spawnSync(cmd, ['--version'], { encoding: 'utf-8' });
      if (res.status === 0) {
        return cmd;
      }
    } catch (_) {}
  }
  return null;
}

// 2. Detect Venv Python
function getVenvPython() {
  const isWin = process.platform === 'win32';
  const venvPython = isWin
    ? path.join(aiDir, 'venv', 'Scripts', 'python.exe')
    : path.join(aiDir, 'venv', 'bin', 'python');

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return null;
}

console.log('\x1b[1m\x1b[35m' + '='.repeat(60));
console.log('⚡ EasyMetrics Automated Local Environment Setup');
console.log('='.repeat(60) + '\x1b[0m');

// STEP 1: Verify System Prerequisites
logStep('1/6', 'Checking system prerequisites...');

const nodeVer = process.version;
console.log(`  • Node.js: ${nodeVer}`);
const major = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
if (major < 20) {
  logError(`Node.js version 20 or higher is required. Found: ${nodeVer}`);
  process.exit(1);
}
logSuccess('Node.js version is compatible.');

const systemPython = getSystemPython();
if (!systemPython) {
  logError('Python 3.11 or 3.12 is required but could not be found on your PATH.');
  process.exit(1);
}
console.log(`  • System Python: ${systemPython}`);
logSuccess('Python is installed.');

try {
  execSync('docker compose version', { stdio: 'pipe' });
  console.log('  • Docker Compose: Available');
  logSuccess('Docker Compose is ready.');
} catch (err) {
  logError('Docker or Docker Compose is not installed or not running in the background.');
  logWarn('Please start Docker Desktop and run "npm run setup" again.');
  process.exit(1);
}

// STEP 2: Configure Environment Variables (.env)
logStep('2/6', 'Setting up environment file (.env)...');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExamplePath, envPath);
  logSuccess('Created .env from .env.example.');
} else {
  logSuccess('.env already exists (preserving existing settings).');
}

// Load environment variables so child processes (like Prisma) have DATABASE_URL
try {
  require('dotenv').config({ path: envPath });
} catch (_) {}

// STEP 3: Setup Node.js Dependencies & Build SDK
logStep('3/6', 'Verifying Node.js dependencies and building SDK...');
try {
  execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
  logSuccess('Node.js dependencies and workspace symlinks ready.');
  console.log('  Compiling @easy-metrics/node SDK package...');
  execSync('npm run build --workspace=packages/sdk', { cwd: rootDir, stdio: 'inherit' });
  logSuccess('@easy-metrics/node SDK built successfully.');
} catch (err) {
  logError('Failed to install Node.js dependencies or build SDK.');
  process.exit(1);
}

// STEP 4: Setup Python Virtual Environment (for AI Agent)
logStep('4/6', 'Configuring Python virtual environment for AI Agent...');
let venvPy = getVenvPython();

if (!venvPy) {
  console.log('  Creating new virtual environment in services/ai-agent/venv...');
  try {
    execSync(`${systemPython} -m venv venv`, { cwd: aiDir, stdio: 'inherit' });
    venvPy = getVenvPython();
  } catch (err) {
    logError('Failed to create Python virtual environment.');
    process.exit(1);
  }
}

console.log('  Installing Python dependencies (FastAPI, LangGraph, FastMCP)...');
try {
  execSync(`"${venvPy}" -m pip install -r requirements.txt`, { cwd: aiDir, stdio: 'inherit' });
  logSuccess('Python virtual environment and packages ready.');
} catch (err) {
  logError('Failed to install Python dependencies from requirements.txt.');
  process.exit(1);
}

// STEP 5: Start PostgreSQL via Docker Compose
logStep('5/6', 'Starting PostgreSQL container with Docker Compose...');
try {
  execSync('docker compose up -d', { cwd: rootDir, stdio: 'inherit' });
  logSuccess('PostgreSQL container is running.');
} catch (err) {
  logError('Failed to start Docker container. Check if port 5432 is already in use.');
  process.exit(1);
}

// STEP 6: Sync Prisma Database Schema
logStep('6/6', 'Syncing Prisma database tables and generating client...');
try {
  execSync('npm run prisma:generate --workspace=apps/api', { cwd: rootDir, stdio: 'inherit', env: process.env });
  execSync('npm run prisma:push --workspace=apps/api', { cwd: rootDir, stdio: 'inherit', env: process.env });
  logSuccess('Database tables synchronized successfully.');
} catch (err) {
  logError('Failed to push Prisma schema to PostgreSQL.');
  process.exit(1);
}

// FINAL INSTRUCTIONS & GROQ KEY REMINDER
console.log('\n\x1b[1m\x1b[32m' + '='.repeat(60));
console.log('🎉 EasyMetrics Local Environment Setup Complete!');
console.log('='.repeat(60) + '\x1b[0m\n');

// Check if GROQ_API_KEY is still placeholder
const envContent = fs.readFileSync(envPath, 'utf-8');
const hasRealGroqKey = envContent.includes('GROQ_API_KEY=') && 
  !envContent.includes('gsk_your_groq_api_key_here') && 
  !envContent.includes('GROQ_API_KEY=""') &&
  !envContent.includes("GROQ_API_KEY=''");

if (!hasRealGroqKey) {
  console.log('\x1b[1m\x1b[33m⚠️  IMPORTANT NEXT STEP:\x1b[0m');
  console.log('  Open \x1b[1m.env\x1b[0m and add your \x1b[1mGROQ_API_KEY\x1b[0m:');
  console.log('  👉 Get a free key at: \x1b[36mhttps://console.groq.com\x1b[0m');
  console.log('  (This is required for the AI Copilot and FastMCP features).\n');
}

console.log('\x1b[1m\x1b[37m🚀 To start EasyMetrics now, run:\x1b[0m');
console.log('   \x1b[1m\x1b[32mnpm run dev\x1b[0m\n');
console.log('Then open \x1b[36mhttp://localhost:3000\x1b[0m in your browser!\n');
