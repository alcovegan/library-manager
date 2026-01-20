import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Launching Electron app...');
  const electronApp = await electron.launch({
    args: [path.join(__dirname, 'src/main.cjs')],
    env: { ...process.env, NODE_ENV: 'test' }
  });

  const window = await electronApp.firstWindow();
  console.log('Window title:', await window.title());
  
  // Wait for app to load
  await window.waitForTimeout(2000);
  
  // Take screenshot in light mode
  await window.screenshot({ path: '/tmp/theme-light.png' });
  console.log('Light theme screenshot saved to /tmp/theme-light.png');
  
  // Get computed styles
  const bodyBg = await window.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const surfaceColor = await window.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface'));
  const cardBg = await window.evaluate(() => {
    const card = document.querySelector('.card');
    return card ? getComputedStyle(card).backgroundColor : 'no card found';
  });
  
  console.log('Body background:', bodyBg);
  console.log('--surface CSS var:', surfaceColor);
  console.log('Card background:', cardBg);
  
  // Click settings to open settings modal
  await window.click('#openSettingsBtn');
  await window.waitForTimeout(500);
  await window.screenshot({ path: '/tmp/theme-settings.png' });
  console.log('Settings screenshot saved to /tmp/theme-settings.png');
  
  await electronApp.close();
}

main().catch(console.error);
