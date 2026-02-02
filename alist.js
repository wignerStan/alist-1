#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const platform = process.platform;
const arch = process.arch;

function getBinaryName() {
  let os, goarch;

  switch (platform) {
    case 'linux':
      os = 'linux';
      break;
    case 'darwin':
      os = 'darwin';
      break;
    case 'win32':
      os = 'windows';
      break;
    case 'freebsd':
      os = 'freebsd';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  switch (arch) {
    case 'x64':
      goarch = 'amd64';
      break;
    case 'arm64':
      goarch = 'arm64';
      break;
    case 'ia32':
      goarch = '386';
      break;
    case 'arm':
      goarch = 'arm';
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  return `alist-${os}-${goarch}`;
}

function getBinaryPath() {
  const binaryName = getBinaryName();
  const binaryDir = path.join(__dirname, 'bin');

  const binaryFile = platform === 'win32' ? 'alist.exe' : 'alist';
  return path.join(binaryDir, binaryFile);
}

function checkBinaryExists() {
  const binaryPath = getBinaryPath();
  return fs.existsSync(binaryPath);
}

function runBinary() {
  const binaryPath = getBinaryPath();

  if (!checkBinaryExists()) {
    console.error('❌ Alist binary not found!');
    console.error('Please run: npm install');
    console.error(`Expected location: ${binaryPath}`);
    process.exit(1);
  }

  if (platform !== 'win32') {
    try {
      fs.accessSync(binaryPath, fs.constants.X_OK);
    } catch (err) {
      console.error('❌ Binary is not executable!');
      console.error(`Please run: chmod +x ${binaryPath}`);
      process.exit(1);
    }
  }

  const args = process.argv.slice(2);
  const child = spawn(binaryPath, args, {
    stdio: 'inherit'
  });

  child.on('error', (err) => {
    console.error('❌ Failed to run alist:', err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code);
  });
}

try {
  runBinary();
} catch (err) {
  console.error('❌ Error:', err.message);
  console.error('\nPlease ensure you are on a supported platform:');
  console.error('  - Linux (amd64, arm64, 386, arm)');
  console.error('  - macOS (amd64, arm64)');
  console.error('  - Windows (amd64, 386)');
  console.error('  - FreeBSD (amd64, arm64, 386, arm)');
  process.exit(1);
}
