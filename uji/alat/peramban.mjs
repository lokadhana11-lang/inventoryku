// Memuat Playwright untuk uji layar: dari node_modules proyek jika ada, selain itu dari folder
// global (PLAYWRIGHT_DIR, bawaan /opt/node22/lib/node_modules/ di lingkungan Claude Code).
// Setiap konteks peramban memakai jam uji yang sama dengan server tiruan (jam.mjs, butir 424).
import { createRequire } from 'node:module';
import { pasangJamPeramban } from './jam.mjs';

async function muatPlaywright() {
  try {
    return (await import('playwright')).chromium;
  } catch (err) {
    const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
    return require('playwright').chromium;
  }
}

export async function muatChromium() {
  const chromium = await muatPlaywright();
  return {
    async launch(opsi) {
      const browser = await chromium.launch(opsi);
      const konteksAsli = browser.newContext.bind(browser);
      browser.newContext = async (...a) => {
        const ctx = await konteksAsli(...a);
        await pasangJamPeramban(ctx);
        return ctx;
      };
      return browser;
    }
  };
}
