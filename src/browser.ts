import { chromium, Browser, BrowserContext } from 'playwright';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

export async function getBrowser(): Promise<BrowserContext> {
  if (!browser || !browser.isConnected()) {
    console.log('[Browser] Iniciando Chrome do sistema...');
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      viewport: { width: 1280, height: 800 },
    });
    console.log('[Browser] Pronto.');
  }
  return context!;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
}
