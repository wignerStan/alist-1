#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const VERSION = '3.44.0';
const REPO_OWNER = 'AlistGo';
const REPO_NAME = 'alist';
const GITHUB_API = 'api.github.com';

const platform = process.platform;
const arch = process.arch;

function getOsName() {
  switch (platform) {
    case 'linux':
      return 'linux';
    case 'darwin':
      return 'darwin';
    case 'win32':
      return 'windows';
    case 'freebsd':
      return 'freebsd';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function getArchName() {
  switch (arch) {
    case 'x64':
      return 'amd64';
    case 'arm64':
      return 'arm64';
    case 'ia32':
      return '386';
    case 'arm':
      return 'arm';
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

function getArchiveFormat() {
  return platform === 'win32' ? 'zip' : 'tar.gz';
}

function getBinaryFileName() {
  const os = getOsName();
  const goarch = getArchName();
  const format = getArchiveFormat();
  return `alist-${os}-${goarch}.${format}`;
}

function getDownloadUrl() {
  const fileName = getBinaryFileName();
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${VERSION}/${fileName}`;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status code: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.pipe(file);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const progress = ((downloadedSize / totalSize) * 100).toFixed(2);
          process.stdout.write(`\r  Downloading: ${progress}%`);
        }
      });

      file.on('finish', () => {
        file.close();
        console.log('\r  Downloading: 100%');
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function extractTarGz(archivePath, destDir) {
  console.log('  Extracting archive...');

  try {
    await execAsync(`mkdir -p ${destDir}`);
    await execAsync(`tar -xzf "${archivePath}" -C "${destDir}"`);
    console.log('  Extracted successfully');
  } catch (err) {
    throw new Error(`Failed to extract archive: ${err.message}`);
  }
}

async function extractZip(archivePath, destDir) {
  console.log('  Extracting ZIP archive...');
  
  try {
    await execAsync(`mkdir -p ${destDir}`);
    
    if (platform === 'win32') {
      await execAsync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`);
    } else {
      await execAsync(`unzip -o "${archivePath}" -d "${destDir}"`);
    }
    
    console.log('  Extracted successfully');
  } catch (err) {
    throw new Error(`Failed to extract ZIP archive: ${err.message}`);
  }
}

function makeExecutable(binaryPath) {
  if (platform === 'win32') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    fs.chmod(binaryPath, 0o755, (err) => {
      if (err) {
        reject(new Error(`Failed to make binary executable: ${err.message}`));
      } else {
        resolve();
      }
    });
  });
}

async function downloadBinary() {
  console.log(`📦 Installing alist v${VERSION}`);
  console.log(`  Platform: ${getOsName()} ${getArchName()}`);
  
  const fileName = getBinaryFileName();
  const downloadUrl = getDownloadUrl();
  const tempDir = path.join(__dirname, '..');
  const archivePath = path.join(tempDir, fileName);
  const binDir = path.join(tempDir, 'bin');
  
  const format = getArchiveFormat();
  
  console.log(`  Source: ${downloadUrl}`);
  
  try {
    await downloadFile(downloadUrl, archivePath);
    
    if (format === 'tar.gz') {
      await extractTarGz(archivePath, binDir);
    } else if (format === 'zip') {
      await extractZip(archivePath, binDir);
    }
    
    const binaryName = platform === 'win32' ? 'alist.exe' : 'alist';
    const extractedPath = path.join(binDir, binaryName);
    
    if (fs.existsSync(extractedPath)) {
      await makeExecutable(extractedPath);
      console.log(`\n✅ alist installed successfully!`);
      console.log(`   Binary location: ${extractedPath}`);
      
      fs.unlinkSync(archivePath);
    } else {
      throw new Error('Binary not found in extracted archive');
    }
    
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    console.error('\nTroubleshooting:');
    console.error('  - Check your internet connection');
    console.error(`  - Verify version ${VERSION} exists at https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`);
    console.error('  - Ensure you have enough disk space');
    
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    
    process.exit(1);
  }
}

async function main() {
  try {
    const os = getOsName();
    const goarch = getArchName();
    const format = getArchiveFormat();
    
    console.log(`alist NPM package installer`);
    console.log(`Target: alist-${os}-${goarch}.${format}\n`);
    
    await downloadBinary();
    
    console.log('\nYou can now use alist!');
    console.log('  alist server    - Start the alist server');
    console.log('  alist version   - Show version information');
    console.log('  alist help       - Show all commands');
    
  } catch (err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { downloadBinary, getBinaryFileName, getDownloadUrl };
