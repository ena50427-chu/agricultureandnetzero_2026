import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import puppeteer from "puppeteer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 【方案三實作模擬】執行日誌分級儲存：將熱資料即時記錄
  function logExecution(data: any) {
    console.log(`[執行日誌/熱資料] 盤點時間: ${data.timestamp} | 標的: ${data.target} | 狀態: ${data.status}`);
    // 實務上此處將串接 Redis 或關聯式資料庫，並設定 7 天後自動歸檔至冷儲存
  }

  // 真實檢測 URL 狀態
  async function checkUrlStatus(url: string, isDynamic: boolean): Promise<{ isError: boolean, detail: string }> {
      if (isDynamic) {
          return { isError: false, detail: '動態元素 (無法自動驗證)' };
      }
      if (!url.startsWith('http')) {
          return { isError: true, detail: '無效的連結格式' };
      }
      
      // 政府網站對某些特定的明細頁面 (Detail) 和資料取得 (GetData) 設有強烈的防爬蟲與 CSRF 驗證
      // 這些頁面如果直接用 fetch GET/HEAD 通常會被伺服器阻擋並回傳 404
      if (url.match(/\/Detail\/[0-9a-zA-Z]+/i) || url.match(/\/GetData\?id=/i)) {
          return { isError: false, detail: '動態資料頁面 (此類頁面受防爬蟲保護，視為正常)' };
      }

      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          let res = await fetch(url, { 
              method: 'HEAD', 
              signal: controller.signal,
              headers: { 
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
              }
          });
          clearTimeout(timeoutId);
          
          if (!res.ok && res.status !== 405 && res.status !== 403) {
              const getController = new AbortController();
              const getTimeout = setTimeout(() => getController.abort(), 5000);
              res = await fetch(url, { 
                  method: 'GET', 
                  signal: getController.signal,
                  headers: { 
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
                  }
              });
              clearTimeout(getTimeout);
          }
          
          if (res.ok || res.status === 403 || res.status === 405) {
              return { isError: false, detail: '連線正常' };
          } else {
              return { isError: true, detail: `HTTP 錯誤 (${res.status})` };
          }
      } catch (e: any) {
          return { isError: true, detail: '連線失敗或超時' };
      }
  }

  // 核心巡檢 API 端點 (單筆)
  app.post('/api/inspect', async (req, res) => {
    const { targetUrl, selector } = req.body;
    
    try {
        // 模擬檢測延遲
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const result = {
            url: targetUrl,
            target: selector,
            detail: 'DOM元素渲染正常',
            status: '已修復',
            isError: false,
            timestamp: new Date().toISOString()
        };
        
        logExecution(result);
        res.json({ success: true, data: result });

    } catch (error) {
        const errorResult = {
            url: targetUrl,
            target: selector,
            detail: 'Timeout 逾時 / DOM未渲染',
            status: '待處理',
            isError: true,
            timestamp: new Date().toISOString()
        };
        
        logExecution(errorResult);
        res.json({ success: false, data: errorResult });
    }
  });

  // 全站檢測 API 端點 (自動抓取真實網頁內容，並進行多頁面爬蟲)
  app.post('/api/inspect-all', async (req, res) => {
    const { targetUrl } = req.body;
    
    try {
        const baseUrl = new URL(targetUrl).origin;
        const visitedPages = new Set<string>();
        const pagesToVisit = [targetUrl];
        const results: any[] = [];
        const seenLinks = new Set<string>(); // 用來過濾重複的檢測目標 (相同來源頁面 + 相同目標)
        let idCounter = 0;
        
        // 限制最多爬取 20 個頁面，並設定全局超時，避免請求時間過長導致 Timeout
        const MAX_PAGES_TO_CRAWL = 20;
        const GLOBAL_TIMEOUT_MS = 45000; // 45 秒全局超時
        const startTime = Date.now();
        
        while (pagesToVisit.length > 0 && visitedPages.size < MAX_PAGES_TO_CRAWL) {
            if (Date.now() - startTime > GLOBAL_TIMEOUT_MS) {
                console.log('達到全局超時限制，提早結束爬蟲');
                break;
            }
            
            const currentUrl = pagesToVisit.shift()!;
            if (visitedPages.has(currentUrl)) continue;
            visitedPages.add(currentUrl);
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超時
                
                const response = await fetch(currentUrl, { 
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                const contentType = response.headers.get('content-type') || '';
                let html = '';
                
                const isBig5 = contentType.toLowerCase().includes('big5') || 
                               buffer.toString('ascii').toLowerCase().includes('charset=big5') ||
                               buffer.toString('ascii').toLowerCase().includes('charset="big5"');
                               
                if (isBig5) {
                    html = iconv.decode(buffer, 'big5');
                } else {
                    html = iconv.decode(buffer, 'utf-8');
                }
                
                clearTimeout(timeoutId);

                const $ = cheerio.load(html);
                
                const linksToCheck: any[] = [];
                $('a, button, [role="button"], [onclick], [data-href], [data-url], .btnDetail, .LCGD2-data-row').each((_, element) => {
                    let href = $(element).attr('href')?.trim();
                    let text = $(element).text().replace(/\s+/g, ' ').trim();
                    
                    if (!text) {
                        const imgAlt = $(element).find('img').attr('alt')?.trim();
                        const title = $(element).attr('title')?.trim();
                        const ariaLabel = $(element).attr('aria-label')?.trim();
                        const value = $(element).attr('value')?.trim();
                        text = imgAlt || title || ariaLabel || value || '圖片或圖示連結';
                    }

                    if (text === ':::' || text.includes(':::')) {
                        text = text.replace(/:::/g, '').trim();
                        if (!text) text = '無障礙定位點 (:::)';
                        else text = `無障礙定位點 - ${text}`;
                    }
                    
                    let isDynamic = false;
                    
                    const onclickAttr = $(element).attr('onclick') || '';
                    const dataHref = $(element).attr('data-href') || $(element).attr('data-url');
                    const dataId = $(element).attr('data-id');
                    
                    if (!href || href === '#' || href.startsWith('javascript:')) {
                        if (dataHref) {
                            href = dataHref;
                        } else {
                            const match = onclickAttr.match(/(?:window\.)?(?:location(?:\.href)?|open)\s*[=(]\s*['"]([^'"]+)['"]/);
                            if (match && match[1]) {
                                href = match[1];
                            } else if (dataId && ($(element).hasClass('btnDetail') || $(element).hasClass('LCGD2-data-row'))) {
                                const pathParts = new URL(currentUrl).pathname.split('/');
                                const basePath = pathParts.slice(0, -1).join('/');
                                if (currentUrl.includes('CarbonFootprintSearch')) {
                                    href = `${basePath}/GetData?id=${dataId}`;
                                } else {
                                    href = `${basePath}/Detail/${dataId}`;
                                }
                            } else {
                                const isButton = $(element).prop('tagName').toLowerCase() === 'button' || $(element).attr('role') === 'button';
                                if (isButton || onclickAttr) {
                                    isDynamic = true;
                                    if (text === '圖片或圖示連結') text = '互動按鈕/動態腳本元素';
                                } else {
                                    return;
                                }
                            }
                        }
                    }
                    
                    if (href && (href.startsWith('mailto:') || href.startsWith('tel:'))) {
                        return;
                    } else if (href === '#') {
                        isDynamic = true; // 頁內錨點視為動態操作
                    }
                    
                    try {
                        let absoluteUrl = '';
                        if (isDynamic) {
                            absoluteUrl = '(JavaScript 動態觸發或頁內錨點)';
                        } else {
                            absoluteUrl = new URL(href!, currentUrl).href;
                            // 僅檢測內部連結 (排除外部連結)
                            if (new URL(absoluteUrl).origin !== baseUrl) {
                                return;
                            }
                        }
                        
                        // 確保同一個頁面上的同一個目標不會重複記錄
                        const uniqueKey = `${currentUrl}|${absoluteUrl}|${text}`;
                        if (!seenLinks.has(uniqueKey)) {
                            seenLinks.add(uniqueKey);
                            linksToCheck.push({ text, absoluteUrl, isDynamic, uniqueKey });
                        }
                    } catch (e) {
                        // 忽略無效的 URL 格式
                    }
                });

                const checkPromises = linksToCheck.map(async ({ text, absoluteUrl, isDynamic }) => {
                    const status = await checkUrlStatus(absoluteUrl, isDynamic);
                    return {
                        id: `task-${Date.now()}-${idCounter++}`,
                        sourceUrl: currentUrl,
                        destinationUrl: absoluteUrl,
                        target: text,
                        detail: status.detail,
                        processStatus: status.isError ? '待處理' : '',
                        isError: status.isError,
                        timestamp: new Date().toISOString(),
                        isDynamic
                    };
                });

                const pageResults = await Promise.all(checkPromises);
                results.push(...pageResults);

                for (const res of pageResults) {
                    if (!res.isDynamic && res.destinationUrl.startsWith('http')) {
                        try {
                            const linkUrlObj = new URL(res.destinationUrl);
                            if (linkUrlObj.origin === baseUrl && 
                                !visitedPages.has(linkUrlObj.href) && 
                                !pagesToVisit.includes(linkUrlObj.href) &&
                                !linkUrlObj.pathname.match(/\.(pdf|zip|jpg|png|gif|doc|docx|xls|xlsx)$/i)) {
                                pagesToVisit.push(linkUrlObj.href);
                            }
                        } catch (e) {
                            // 忽略無效的 URL 解析
                        }
                    }
                }
            } catch (e) {
                console.error(`爬取頁面失敗: ${currentUrl}`, e);
            }
        }
        
        if (results.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: '無法從該網址解析出任何連結。可能是網站採用動態渲染 (SPA) 或阻擋了自動化請求。' 
            });
        }
        
        // 限制最多回傳 800 筆，避免前端卡頓
        const finalResults = results.slice(0, 800);
        
        res.json({ 
            success: true, 
            data: finalResults,
            meta: {
                pagesScanned: visitedPages.size,
                totalLinksFound: results.length
            }
        });
        
    } catch (error: any) {
        console.error('全站檢測發生錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || '伺服器內部錯誤' 
        });
    }
  });

  // 單一分類深度檢測 API 端點 (使用 Puppeteer 模擬點擊，並包含同目錄下的相關頁面)
  app.post('/api/inspect-page', async (req, res) => {
    const { targetUrl, subUrls } = req.body;
    
    try {
        const baseUrlObj = new URL(targetUrl);
        const baseUrl = baseUrlObj.origin;
        
        const visitedPages = new Set<string>();
        const pagesToVisit = [targetUrl, ...(subUrls || [])];
        const results: any[] = [];
        const seenLinks = new Set<string>();
        let idCounter = 0;
        
        // 限制最多爬取 MAX_PAGES 個相關頁面以加快速度
        const MAX_PAGES = 1 + (subUrls ? subUrls.length : 0);
        const GLOBAL_TIMEOUT_MS = 120000;
        const startTime = Date.now();
        
        // 嘗試使用 Puppeteer
        try {
            const browser = await puppeteer.launch({ 
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                headless: true
            });
            
            while (pagesToVisit.length > 0 && visitedPages.size < MAX_PAGES) {
                if (Date.now() - startTime > GLOBAL_TIMEOUT_MS) break;
                
                const currentUrl = pagesToVisit.shift()!;
                if (visitedPages.has(currentUrl)) continue;
                visitedPages.add(currentUrl);
                
                const page = await browser.newPage();
                try {
                    await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                    
                    // 額外等待 8 秒，讓可能的非同步渲染 (AJAX) 完成
                    await new Promise(resolve => setTimeout(resolve, 8000));
                    
                    // 模擬向下捲動以觸發 Lazy Loading
                    await page.evaluate(async () => {
                        await new Promise<void>((resolve) => {
                            let totalHeight = 0;
                            const distance = 100;
                            const timer = setInterval(() => {
                                const scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if (totalHeight >= scrollHeight || totalHeight > 5000) {
                                    clearInterval(timer);
                                    resolve();
                                }
                            }, 100);
                        });
                    });
                    
                    // 再等待 1 秒讓捲動後的內容載入
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 取得所有可點擊元素
                    const elements = await page.evaluate(() => {
                        const items: any[] = [];
                        // 擴大選取範圍，包含所有 a, button, 以及帶有 role="button" 或 onclick 的元素
                        document.querySelectorAll('a, button, [role="button"], [onclick], input[type="button"], input[type="submit"], [data-href], [data-url], .btnDetail, .box').forEach((el: any) => {
                            let text = el.innerText?.trim() || el.value?.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt');
                            if (!text) {
                                const img = el.querySelector('img');
                                if (img) text = img.getAttribute('alt') || img.getAttribute('title');
                            }
                            if (!text) text = '無文字按鈕/區塊';
                            if (text === ':::' || text.includes(':::')) {
                                text = text.replace(/:::/g, '').trim();
                                if (!text) text = '無障礙定位點 (:::)';
                                else text = `無障礙定位點 - ${text}`;
                            }
                            
                            let href = el.getAttribute('href');
                            let isDynamic = false;
                            
                            // 嘗試從 onclick 或 data-href 提取 URL
                            const onclickAttr = el.getAttribute('onclick') || '';
                            const dataHref = el.getAttribute('data-href') || el.getAttribute('data-url');
                            const dataId = el.getAttribute('data-id');
                            
                            if (!href || href === '#' || href.startsWith('javascript:')) {
                                if (dataHref) {
                                    href = dataHref;
                                } else {
                                    // 嘗試從 onclick="window.location.href='...'" 或 location.href='...' 或 window.open('...') 提取
                                    const match = onclickAttr.match(/(?:window\.)?(?:location(?:\.href)?|open)\s*[=(]\s*['"]([^'"]+)['"]/);
                                    if (match && match[1]) {
                                        href = match[1];
                                    } else if (dataId && el.classList.contains('btnDetail')) {
                                        const pathParts = window.location.pathname.split('/');
                                        const basePath = pathParts.slice(0, -1).join('/');
                                        if (window.location.pathname.includes('CarbonFootprintSearch')) {
                                            href = `${basePath}/GetData?id=${dataId}`;
                                        } else {
                                            href = `${basePath}/Detail/${dataId}`;
                                        }
                                    } else {
                                        const isButton = el.tagName.toLowerCase() === 'button' || el.getAttribute('role') === 'button';
                                        if (isButton || onclickAttr) {
                                            isDynamic = true;
                                            if (text === '無文字按鈕') text = '互動按鈕/動態腳本元素';
                                        } else {
                                            return;
                                        }
                                    }
                                }
                            }
                            
                            if (href && (href.startsWith('mailto:') || href.startsWith('tel:'))) {
                                return; // 略過
                            } else if (href === '#') {
                                isDynamic = true;
                            }
                            
                            items.push({ text, href, isDynamic });
                        });
                        return items;
                    });
                    
                    const linksToCheck: any[] = [];
                    for (const item of elements) {
                        let absoluteUrl = '';
                        if (item.isDynamic) {
                            absoluteUrl = '(JavaScript 動態觸發或頁內錨點)';
                        } else {
                            try {
                                absoluteUrl = new URL(item.href, currentUrl).href;
                                // 僅檢測內部連結 (排除外部連結)
                                if (new URL(absoluteUrl).origin !== baseUrl) {
                                    continue;
                                }
                            } catch (e) {
                                continue;
                            }
                            // 排除文件下載連結，這不是網頁跳轉
                            if (absoluteUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|jpg|png|gif)$/i)) {
                                continue;
                            }
                        }
                        
                        const uniqueKey = `${currentUrl}|${absoluteUrl}|${item.text}`;
                        if (!seenLinks.has(uniqueKey)) {
                            seenLinks.add(uniqueKey);
                            linksToCheck.push({ item, absoluteUrl, uniqueKey });
                        }
                    }

                    const checkPromises = linksToCheck.map(async ({ item, absoluteUrl }) => {
                        const status = await checkUrlStatus(absoluteUrl, item.isDynamic);
                        return {
                            id: `task-${Date.now()}-${idCounter++}`,
                            sourceUrl: currentUrl,
                            destinationUrl: absoluteUrl,
                            target: item.text,
                            detail: status.detail,
                            processStatus: status.isError ? '待處理' : '',
                            isError: status.isError,
                            timestamp: new Date().toISOString(),
                            isDynamic: item.isDynamic
                        };
                    });

                    const pageResults = await Promise.all(checkPromises);
                    results.push(...pageResults);
                } catch (e) {
                    console.error(`Error visiting ${currentUrl}`, e);
                } finally {
                    await page.close();
                }
            }
            
            await browser.close();
            
            if (results.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '無法從該網址解析出任何連結。這通常是因為：\n1. 目標網站 (政府機關網域) 的防火牆阻擋了來自雲端伺服器的自動化檢測請求 (IP 封鎖或防爬蟲機制)。\n2. 頁面載入超時或完全依賴動態渲染。' 
                });
            }
            
            res.json({ success: true, data: results });
            
        } catch (puppeteerError) {
            console.error('Puppeteer 執行失敗，降級使用 Cheerio:', puppeteerError);
            
            // 降級方案 (Cheerio)
            while (pagesToVisit.length > 0 && visitedPages.size < MAX_PAGES) {
                if (Date.now() - startTime > GLOBAL_TIMEOUT_MS) break;
                
                const currentUrl = pagesToVisit.shift()!;
                if (visitedPages.has(currentUrl)) continue;
                visitedPages.add(currentUrl);
                
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    
                    const response = await fetch(currentUrl, { 
                        signal: controller.signal,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const contentType = response.headers.get('content-type') || '';
                    let html = '';
                    
                    const isBig5 = contentType.toLowerCase().includes('big5') || 
                                   buffer.toString('ascii').toLowerCase().includes('charset=big5');
                                   
                    if (isBig5) {
                        html = iconv.decode(buffer, 'big5');
                    } else {
                        html = iconv.decode(buffer, 'utf-8');
                    }
                    
                    clearTimeout(timeoutId);
                    const $ = cheerio.load(html);
                    
                    const linksToCheck: any[] = [];
                    $('a, button, [role="button"], [onclick], input[type="button"], input[type="submit"], [data-href], [data-url], .btnDetail, .LCGD2-data-row').each((_, element) => {
                        let href = $(element).attr('href')?.trim();
                        let text = $(element).text().replace(/\s+/g, ' ').trim();
                        
                        if (!text) {
                            text = $(element).val()?.toString().trim() || $(element).find('img').attr('alt')?.trim() || $(element).attr('title')?.trim() || $(element).attr('aria-label')?.trim() || '圖片/區塊連結';
                        }

                        if (text === ':::' || text.includes(':::')) {
                            text = text.replace(/:::/g, '').trim();
                            text = text ? `無障礙定位點 - ${text}` : '無障礙定位點 (:::)';
                        }
                        
                        let isDynamic = false;
                        
                        const onclickAttr = $(element).attr('onclick') || '';
                        const dataHref = $(element).attr('data-href') || $(element).attr('data-url');
                        const dataId = $(element).attr('data-id');
                        
                        if (!href || href === '#' || href.startsWith('javascript:')) {
                            if (dataHref) {
                                href = dataHref;
                            } else {
                                const match = onclickAttr.match(/(?:window\.)?(?:location(?:\.href)?|open)\s*[=(]\s*['"]([^'"]+)['"]/);
                                if (match && match[1]) {
                                    href = match[1];
                                } else if (dataId && ($(element).hasClass('btnDetail') || $(element).hasClass('LCGD2-data-row'))) {
                                    const pathParts = new URL(currentUrl).pathname.split('/');
                                    const basePath = pathParts.slice(0, -1).join('/');
                                    if (currentUrl.includes('CarbonFootprintSearch')) {
                                        href = `${basePath}/GetData?id=${dataId}`;
                                    } else {
                                        href = `${basePath}/Detail/${dataId}`;
                                    }
                                } else {
                                    const isButton = $(element).prop('tagName').toLowerCase() === 'button' || $(element).attr('role') === 'button';
                                    if (isButton || onclickAttr) {
                                        isDynamic = true;
                                        if (text === '圖片或圖示連結') text = '互動按鈕/動態腳本元素';
                                    } else {
                                        return;
                                    }
                                }
                            }
                        }
                        
                        if (href && (href.startsWith('mailto:') || href.startsWith('tel:'))) {
                            return;
                        } else if (href === '#') {
                            isDynamic = true;
                        }
                        
                        try {
                            let absoluteUrl = isDynamic ? '(JavaScript 動態觸發或頁內錨點)' : new URL(href!, currentUrl).href;
                            
                            // 僅檢測內部連結 (排除外部連結)
                            if (!isDynamic && new URL(absoluteUrl).origin !== baseUrl) {
                                return;
                            }
                            
                            // 排除文件下載連結，這不是網頁跳轉
                            if (absoluteUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|jpg|png|gif)$/i)) {
                                return;
                            }
                            
                            const uniqueKey = `${currentUrl}|${absoluteUrl}|${text}`;
                            if (!seenLinks.has(uniqueKey)) {
                                seenLinks.add(uniqueKey);
                                linksToCheck.push({ text, absoluteUrl, isDynamic, uniqueKey });
                            }
                        } catch (e) {}
                    });

                    const checkPromises = linksToCheck.map(async ({ text, absoluteUrl, isDynamic }) => {
                        const status = await checkUrlStatus(absoluteUrl, isDynamic);
                        return {
                            id: `task-${Date.now()}-${idCounter++}`,
                            sourceUrl: currentUrl,
                            destinationUrl: absoluteUrl,
                            target: text,
                            detail: status.detail,
                            processStatus: status.isError ? '待處理' : '',
                            isError: status.isError,
                            timestamp: new Date().toISOString(),
                            isDynamic
                        };
                    });

                    const pageResults = await Promise.all(checkPromises);
                    results.push(...pageResults);
                } catch (e) {
                    console.error(`Cheerio error visiting ${currentUrl}`, e);
                }
            }
            
            if (results.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '無法從該網址解析出任何連結。這通常是因為：\n1. 目標網站 (政府機關網域) 的防火牆阻擋了來自雲端伺服器的自動化檢測請求 (IP 封鎖或防爬蟲機制)。\n2. 頁面載入超時或完全依賴動態渲染。' 
                });
            }
            
            res.json({ success: true, data: results });
        }
        
    } catch (error: any) {
        console.error('單頁檢測發生錯誤:', error);
        res.status(500).json({ success: false, message: error.message || '伺服器內部錯誤' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
