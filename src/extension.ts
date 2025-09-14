import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { convert } from "./convert";

function getAvailablePdfPath(mdPath: string): string {
	const dir = path.dirname(mdPath);
	const base = path.basename(mdPath, '.md');
	let pdfPath = path.join(dir, `${base}.pdf`);
	let counter = 1;
	while (fs.existsSync(pdfPath)) {
		pdfPath = path.join(dir, `${base}-${counter}.pdf`);
		counter++;
	}
	return pdfPath;
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('markdownToPdf.convert', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor with a Markdown file. Open a .md file and try again.');
			return;
		}

		const doc = editor.document;
		if (doc.languageId !== 'markdown' && !doc.fileName.endsWith('.md')) {
			vscode.window.showErrorMessage('Active file is not a Markdown file.');
			return;
		}

		try {
			const pdfPath = getAvailablePdfPath(doc.uri.fsPath);
			await convert(doc.uri.fsPath, pdfPath);
			const open = 'Open PDF';
			const choice = await vscode.window.showInformationMessage(`Saved PDF: ${pdfPath}`, open);
			if (choice === open) {
				const docUri = vscode.Uri.file(pdfPath);
				await vscode.commands.executeCommand('vscode.open', docUri);
			}
		} catch (err: any) {
			vscode.window.showErrorMessage('Failed to convert Markdown to PDF: ' + (err.message || String(err)));
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
