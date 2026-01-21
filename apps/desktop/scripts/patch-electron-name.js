#!/usr/bin/env node
/**
 * Patches Electron's Info.plist to show "Library Manager" instead of "Electron"
 * in the macOS Dock and App Switcher during development.
 *
 * Run: node scripts/patch-electron-name.js
 * Or add to postinstall: "postinstall": "node scripts/patch-electron-name.js && electron-builder install-app-deps"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_NAME = 'Library Manager';
const BUNDLE_ID = 'com.example.librarymanager';

// Find Electron's Info.plist
const electronPath = path.dirname(require.resolve('electron'));
const possiblePaths = [
  path.join(electronPath, 'dist', 'Electron.app', 'Contents', 'Info.plist'),
  path.join(electronPath, '..', 'dist', 'Electron.app', 'Contents', 'Info.plist'),
];

let plistPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    plistPath = p;
    break;
  }
}

if (!plistPath) {
  console.log('⚠️  Could not find Electron Info.plist - skipping patch (not on macOS or Electron not installed)');
  process.exit(0);
}

console.log(`📝 Patching Electron Info.plist at: ${plistPath}`);

try {
  let content = fs.readFileSync(plistPath, 'utf8');

  // Check if already patched
  if (content.includes(`<string>${APP_NAME}</string>`)) {
    console.log('✅ Already patched - nothing to do');
    process.exit(0);
  }

  // Replace CFBundleName
  content = content.replace(
    /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleName</key>\n\t<string>${APP_NAME}</string>`
  );

  // Replace CFBundleDisplayName if exists, or add it
  if (content.includes('<key>CFBundleDisplayName</key>')) {
    content = content.replace(
      /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
      `<key>CFBundleDisplayName</key>\n\t<string>${APP_NAME}</string>`
    );
  } else {
    // Add after CFBundleName
    content = content.replace(
      /(<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>)/,
      `$1\n\t<key>CFBundleDisplayName</key>\n\t<string>${APP_NAME}</string>`
    );
  }

  // Replace CFBundleIdentifier
  content = content.replace(
    /<key>CFBundleIdentifier<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleIdentifier</key>\n\t<string>${BUNDLE_ID}</string>`
  );

  fs.writeFileSync(plistPath, content);
  console.log('✅ Patched successfully!');

  // Also patch helper apps if they exist
  const helpersDir = path.join(path.dirname(plistPath), 'Frameworks');
  if (fs.existsSync(helpersDir)) {
    const helpers = fs.readdirSync(helpersDir).filter(f => f.endsWith('.app'));
    for (const helper of helpers) {
      const helperPlist = path.join(helpersDir, helper, 'Contents', 'Info.plist');
      if (fs.existsSync(helperPlist)) {
        let helperContent = fs.readFileSync(helperPlist, 'utf8');

        // Update bundle name in helpers too
        const helperName = helper.replace('.app', '').replace('Electron', APP_NAME);
        helperContent = helperContent.replace(
          /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
          `<key>CFBundleName</key>\n\t\t<string>${helperName}</string>`
        );

        fs.writeFileSync(helperPlist, helperContent);
        console.log(`  ✅ Patched helper: ${helper}`);
      }
    }
  }

  // Re-sign the app (required after modifying Info.plist, otherwise macOS Gatekeeper blocks it)
  if (process.platform === 'darwin') {
    const appPath = path.join(path.dirname(plistPath), '..');
    try {
      console.log('🔏 Re-signing Electron.app...');
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'pipe' });
      console.log('✅ Re-signed successfully');
    } catch (error) {
      console.warn('⚠️  Could not re-sign app (may need Xcode command line tools):', error.message);
    }

    // Clear launch services cache to apply changes immediately
    try {
      execSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user', { stdio: 'ignore' });
      console.log('🔄 Cleared launch services cache');
    } catch {
      // Ignore - not critical
    }
  }

  console.log('\n💡 Restart the app to see changes in Cmd+Tab');

} catch (error) {
  console.error('❌ Failed to patch:', error.message);
  process.exit(1);
}
