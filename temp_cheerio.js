import * as cheerio from 'cheerio';
import fs from 'fs';

const html = fs.readFileSync('C:\\Users\\enachu\\Desktop\\04淨零資訊網\\-\\farm_dump.html', 'utf8');
const $ = cheerio.load(html);

const links = [];
$('a, button, .box, .item').each((_, el) => {
   const text = $(el).text().trim().replace(/\s+/g, ' ');
   if(text.length > 0) links.push(text);
});

console.log('Links found:', links.length);
console.log(links.slice(0, 50).join('\n'));
