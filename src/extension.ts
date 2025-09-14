import * as vscode from 'vscode';
import { convertMarkdownFileToPdf } from './convert';

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
      const pdfPath = await convertMarkdownFileToPdf(doc.uri.fsPath);
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

export function deactivate() {}
