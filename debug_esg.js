import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  let output = '';
  const log = (msg: string) => { output += msg + '\n'; };

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  
  for (const url of [
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Cases',
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Match'
  ]) {
    log(`\n=== ${url} ===`);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 8000));
    
    // Scroll
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let totalHeight = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, 100);
          totalHeight += 100;
          if (totalHeight >= document.body.scrollHeight || totalHeight > 5000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Dump the full body HTML
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    log(`\nFull body length: ${bodyHTML.length}`);
    
    // Find main content area
    const contentHTML = await page.evaluate(() => {
      const selectors = ['.content-wrapper', '.main-content', '.page-content', 'main', 'article', '#ContentPlaceHolder'];
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el) return `[${s}] ${el.innerHTML.substring(0, 5000)}`;
      }
      // fallback: look for anything with "case" or "match" or "card" or "list" class
      const cards = document.querySelectorAll('[class*="card"], [class*="case"], [class*="match"], [class*="list-group"], [class*="item"], .box');
      let result = `Found ${cards.length} card/list elements:\n`;
      cards.forEach((el, i) => {
        if (i < 20) result += `  [${el.tagName}.${el.className}] text="${el.innerText?.substring(0, 100)}"\n`;
      });
      return result;
    });
    log(contentHTML);
    
    // Check all links (a tags)
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        href: a.href,
        text: a.innerText?.trim().substring(0, 60),
        cls: a.className?.substring(0, 80)
      })).filter(l => l.text && l.text.length > 1);
    });
    log(`\nAll links (${links.length}):`);
    links.forEach(l => log(`  "${l.text}" -> ${l.href} [${l.cls}]`));
    
    // Check for .box elements specifically (the Puppeteer selector already includes .box)
    const boxes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.box, .card, .k-grid, .k-listview, [class*="grid"], [class*="list"]')).map(el => ({
        tag: el.tagName,
        cls: el.className?.toString().substring(0, 120),
        childCount: el.children.length,
        text: el.innerText?.substring(0, 200)
      }));
    });
    log(`\nGrid/list/box elements (${boxes.length}):`);
    boxes.forEach(b => log(`  [${b.tag}.${b.cls}] children=${b.childCount} text="${b.text}"`));
    
    await page.close();
  }
  
  await browser.close();
  fs.writeFileSync('debug_esg_output.txt', output, 'utf-8');
  console.log('Done! Output written to debug_esg_output.txt');
})();
