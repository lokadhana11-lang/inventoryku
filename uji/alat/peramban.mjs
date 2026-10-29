// Memuat Playwright untuk uji layar: dari node_modules proyek jika ada, selain itu dari folder
// global (PLAYWRIGHT_DIR, bawaan /opt/node22/lib/node_modules/ di lingkungan Claude Code).
import { createRequire } from 'node:module';

export async function muatChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch (err) {
    const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
    return require('playwright').chromium;
  }
}
