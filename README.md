# MarkdownMerger

**Markdown → PDF (embed images & internal links)**

MarkdownMerger is a VSCode extension that converts Markdown files into PDF documents with embedded images (base64) and internal links that scroll to headings. It also supports merging multiple Markdown files into a single PDF.

## Features

- Convert Markdown to PDF with embedded images.
- Preserve internal links and headings.
- Merge multiple Markdown files into one PDF.
- Easy-to-use VSCode command palette integration.

## How it Works

MarkdownMerger leverages the following open-source libraries:

- **[markdown-it](https://github.com/markdown-it/markdown-it)** – A powerful Markdown parser for converting Markdown content to HTML.
- **[html-pdf-node](https://github.com/marcbachmann/node-html-pdf)** – Converts HTML content (including embedded images and links) into PDF files.

The extension first converts Markdown to HTML using `markdown-it`, then generates a PDF with `html-pdf-node`, ensuring that images and internal links are preserved.

## Usage

1. Open a Markdown file or select multiple Markdown files in VSCode.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the Command Palette.
3. Type `MarkdownMerger: Export to PDF` and hit Enter.
4. Choose the output location for the PDF.

## Requirements

- VSCode ^1.60.0
- Node.js 16+

## Extension Settings

Currently, MarkdownMerger does not provide configurable settings. All conversions use default PDF formatting.
