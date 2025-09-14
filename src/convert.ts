import * as fs from 'fs/promises';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import * as jsdom from 'jsdom';
import puppeteer from 'puppeteer';
import mime from 'mime';

async function fileToBase64(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  const mimeType = mime.getType(filePath) || 'application/octet-stream';
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

function createHtmlDocument(body: string, title: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 24px; }
  img { max-width: 100%; height: auto; }
  pre { background:#f6f8fa; padding:12px; overflow:auto }
  code { background:#f3f3f3; padding:2px 4px; border-radius:4px }
  a { color: #0366d6 }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>\\"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' } as any)[c]);
}

export async function convertMarkdownFileToPdf(mdPath: string): Promise<string> {
  const mdDir = path.dirname(mdPath);
  const mdText = await fs.readFile(mdPath, 'utf-8');

  const md = new MarkdownIt({ html: true, linkify: true })
    .use(markdownItAnchor, { permalink: false });

  let html = md.render(mdText);

  const dom = new jsdom.JSDOM(html);
  const document = dom.window.document;

  // embed images
  const imgElements = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
  for (const img of imgElements) {
    const src = img.getAttribute('src') || '';
    if (!src) continue;
    if (/^data:/.test(src) || /^(https?:)?\\/\\//.test(src)) continue;

    let imgPath = src;
    if (!path.isAbsolute(imgPath)) imgPath = path.resolve(mdDir, imgPath);

    try {
      const dataUrl = await fileToBase64(imgPath);
      img.setAttribute('src', dataUrl);
    } catch (e) {
      const warn = document.createElement('div');
      warn.style.color = 'red';
      warn.textContent = `⚠️ Failed to embed image: ${src}`;
      img.parentNode?.insertBefore(warn, img.nextSibling);
    }
  }

  // ensure headings have ids
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[];
  for (const h of headings) {
    if (!h.id) {
      const id = h.textContent?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';
      h.id = id;
    }
  }

  // normalize links
  const anchorElements = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
  for (const a of anchorElements) {
    const href = a.getAttribute('href') || '';
    if (!href) continue;
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;

    const [targetPathPart, hashPart] = href.split('#');
    if (targetPathPart && targetPathPart.endsWith('.md')) {
      const targetFull = path.isAbsolute(targetPathPart) ? targetPathPart : path.resolve(mdDir, targetPathPart);
      let anchor = '';
      if (path.resolve(targetFull) === path.resolve(mdPath)) {
        anchor = hashPart ? `#${hashPart}` : '#';
      } else {
        const base = path.basename(targetFull, '.md');
        anchor = hashPart ? `#${base}-${hashPart}` : `#${base}`;
      }
      a.setAttribute('href', anchor);
      continue;
    }

    if (/^#/.test(href)) continue;
  }

  const finalHtml = createHtmlDocument(document.body.innerHTML, path.basename(mdPath));

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    const pdfPath = mdPath.replace(/\\.md$/, '') + '.pdf';
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    return pdfPath;
  } finally {
    await browser.close();
  }
}
