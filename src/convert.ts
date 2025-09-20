import puppeteer from 'puppeteer-core';
import chromeLauncher from 'chrome-launcher';
import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import * as jsdom from 'jsdom';
import mime from 'mime';

async function fileToBase64(filePath: string): Promise<string> {
	const data = await fs.readFileSync(filePath);
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
		code { background:yellow; font-size: 16px; padding:2px 4px; border-radius:4px }
		a { color: #0366d6 }
		.break-page {break-after: page; page-break-after: always;}
		</style>
		</head>
		<body>
		${body}
		</body>
		</html>`;
}

function escapeHtml(s: string) {
	return s.replace(/[&<>\\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
}

/**
 * 遞迴讀取 markdown，並展開相對連結
 * @param filePath 檔案路徑
 * @param idMapping filePath => id
 * @param id 編號
 */
async function loadFile(filePath: string, idMapping: Record<string, number> = {}, id: number = 0): Promise<string> {
	if (!fs.existsSync(filePath)) {
		return '';
	}
	const base = Object.keys(idMapping).length;
	const isRoot = id === 0;
	const mdDir = path.dirname(filePath);
	const raw = fs.readFileSync(filePath, 'utf-8');
	const md = new MarkdownIt({
		html: true,
		linkify: true
	}).use(markdownItAnchor, {
		permalink: false
	});
	const html = md.render(raw);
	const dom = new jsdom.JSDOM(html);
	const document = dom.window.document;
	await (async function (document) {
		const elementList = document.querySelectorAll("img");
		for (let i = 0; i < elementList.length; i += 1) {
			const element: HTMLImageElement = elementList[i];
			const src = element.getAttribute('src');
			// ignore img tag if src is undefined
			if (typeof src !== "string") {
				continue;
			}
			// src is base64 string
			else if (/^data:/.test(src)) {
				continue;
			}
			// handle http(s) images: fetch and embed as base64
			else if (/^(https?:)?\/\//.test(src)) {
				try {
					const response = await fetch(src);
					if (!response.ok) throw new Error(`Failed to fetch image: ${src}`);
					const buffer = Buffer.from(await response.arrayBuffer());
					const mimeType = response.headers.get('content-type') || 'application/octet-stream';
					const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
					element.setAttribute('src', dataUrl);
				} catch (e) {
					// ignore remote image if fetch failure
					continue;
				}

			}

			let imgPath = src;
			if (!path.isAbsolute(imgPath)) {
				imgPath = path.resolve(mdDir, imgPath);
			}
			try {
				const dataUrl = await fileToBase64(imgPath);
				element.setAttribute('src', dataUrl);
			} catch (e) {
			}

		}
	})(document);
	const fileList: string[] = [];
	document.querySelectorAll("a")
		.forEach(function (element: HTMLAnchorElement) {
			let href = element.getAttribute('href');
			if (href === null) {
				return;
			}
			if (!path.isAbsolute(href)) {
				href = path.join(mdDir, href);
			}
			if (!fs.existsSync(href)) {
				return;
			}
			let linkId: number | undefined = idMapping[href];
			if (typeof linkId === "undefined") {
				linkId = Object.keys(idMapping).length + 1;
				fileList.push(href);
				idMapping[href] = linkId;
			}
			element.setAttribute(`href`, `#id${linkId}`);
		});

	const result: string[] = await (async function (list) {
		const result: string[] = [];
		for (let i = 0; i < list.length; i += 1) {
			const filePath = list[i];
			const content = await loadFile(filePath, idMapping, base + i + 1);
			result.push(content);
		}
		return result;
	})([...fileList]);
	return [
		`<div id="id${id}">${document.body.innerHTML}</div>`,
		...result
	].join(`<div class="break-page"></div>`);
}

async function getChromePath(): Promise<string | undefined> {
	const chrome = await chromeLauncher.Launcher.getInstallations();
	return chrome[0];
}

async function generatePdf(content: string, pdfPath: string) {
	const executablePath = await getChromePath();

	const browser = await puppeteer.launch({
		executablePath,
		headless: true,
	});

	const page = await browser.newPage();
	// await browser.close();
	try {
		await page.setContent(content, { waitUntil: 'networkidle0' });
		await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
		return pdfPath;
	} finally {
		await browser.close();
	}
}

/**
 * Converts a Markdown file to a PDF file.
 *
 * This function reads a Markdown file, renders it to HTML, embeds all images (local and remote) as base64,
 * normalizes links, ensures headings have IDs, and then generates a PDF using Puppeteer.
 *
 * - Local and remote images are embedded as base64 data URLs.
 * - Headings (h1-h6) are assigned IDs if missing.
 * - Markdown links to other `.md` files are normalized for PDF navigation.
 *
 * @param mdPath - The absolute path to the Markdown file to convert.
 * @returns A promise that resolves to the absolute path of the generated PDF file.
 * @throws If reading the Markdown file or generating the PDF fails.
 */
export async function convert(mdPath: string, pdfPath: string): Promise<void> {
	// const pdfDir = path.dirname(pdfPath);
	const html = await loadFile(mdPath);
	const finalHtml = createHtmlDocument(html, path.basename(mdPath));
	await generatePdf(finalHtml, pdfPath);
}
