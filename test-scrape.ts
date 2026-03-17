import puppeteer from 'puppeteer';

async function run() {
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true
    });
    const page = await browser.newPage();
    await page.goto('https://agrinetzero.moa.gov.tw/zh-TW/CarbonFootprintSearch/List', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait a bit more
    await new Promise(r => setTimeout(r, 5000));
    
    page.on('response', async response => {
        if (response.url().includes('1594') || response.url().includes('Detail')) {
            console.log('Intercepted response:', response.url());
            console.log('Status:', response.status());
            const text = await response.text();
            console.log('Body:', text.substring(0, 200));
        }
    });
    const html = await page.evaluate(async () => {
        await new Promise(r => setTimeout(r, 5000)); // wait 5s
        const btn = document.querySelector('.btnDetail[data-id="1594"]') as HTMLButtonElement;
        if (btn) btn.click();
        await new Promise(r => setTimeout(r, 3000)); // wait for ajax
        const modals = document.querySelectorAll('.modal');
        let res = '';
        modals.forEach(m => res += m.innerHTML.substring(0, 200) + '\n---\n');
        return res;
    });
    
    console.log(html);
    await browser.close();
}

run().catch(console.error);
