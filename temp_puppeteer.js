import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating...');
    await page.goto('https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro?CurrentTab=IncrementalGreenhouseGasOffset', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Waiting 8s...');
    await new Promise(r => setTimeout(r, 8000));
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:\\Users\\enachu\\Desktop\\04淨零資訊網\\-\\farm_ss.png', fullPage: true });
    
    // Dump HTML
    const html = await page.content();
    fs.writeFileSync('C:\\Users\\enachu\\Desktop\\04淨零資訊網\\-\\farm_dump.html', html);
    
    console.log('Saved screenshot and HTML text.');
  } catch (e) {
    console.error('Puppeteer Error:', e);
  } finally {
    await browser.close();
  }
})();
