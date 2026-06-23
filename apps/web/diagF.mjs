import { chromium } from '@playwright/test';
const SHOT = 'C:/Users/anton/AppData/Local/Temp/claude/C--Users-anton-OneDrive-Desktop-Projects-nordhem/b68d1951-e8b6-4e4b-bb51-adb24da6ea30/scratchpad';
const browser = await chromium.launch();
// mobile footer
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto('http://localhost:3007', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.getByText('Behind the scenes').scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOT}/f-footer.png` });
await ctx.close();
// desktop footer too
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page2 = await ctx2.newPage();
await page2.goto('http://localhost:3007', { waitUntil: 'load' });
await page2.waitForTimeout(1500);
await page2.getByText('Behind the scenes').scrollIntoViewIfNeeded();
await page2.waitForTimeout(600);
await page2.screenshot({ path: `${SHOT}/f-footer-desktop.png`, clip:{x:600,y:0,width:680,height:800} });
await ctx2.close();
await browser.close();
