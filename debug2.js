import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating...');
    await page.goto('https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if tabs exist
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.tab, [role=\"tab\"], li')).map(e => e.textContent.trim()).filter(t => t.includes('溫室')));
    console.log('Tabs:', tabs);
    
    // Click the tab
    await page.evaluate(() => {
        Array.from(document.querySelectorAll('.tab, [role=\"tab\"], li, a')).forEach(e => {
            if(e.textContent.includes('溫室氣體增量抵換')) e.click();
        });
    });
    
    console.log('Wait another 5s...');
    await new Promise(r => setTimeout(r, 5000));
    
    const content = await page.evaluate(() => document.body.innerText);
    console.log('Content contains 方法學?', content.includes('方法學'));
    console.log('Content contains 案例查詢?', content.includes('案例'));
    console.log('Content contains 法規?', content.includes('法規'));
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
