const vscode = require('vscode');
const { formatSproto } = require('./sprotoFormatter');

function activate(context) {
	console.log('Congratulations, your extension "hello" is now active!');

	// 注册 sproto 格式化命令
	const formatSprotoCmd = vscode.commands.registerCommand('sproto.format', async function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document.languageId !== 'sproto') {
			vscode.window.showWarningMessage('请在 .sproto 文件中使用此命令');
			return;
		}
		const text = editor.document.getText();
		const formatted = formatSproto(text);
		await editor.edit(editBuilder => {
			const fullRange = new vscode.Range(
				0,
				0,
				editor.document.lineCount,
				editor.document.lineAt(editor.document.lineCount - 1).text.length
			);
			editBuilder.replace(fullRange, formatted);
		});
		vscode.window.showInformationMessage('Sproto 格式化完成');
	});
	context.subscriptions.push(formatSprotoCmd);

	// 注册 sproto 文档格式化提供者
	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('sproto', {
		provideDocumentFormattingEdits(document) {
			const text = document.getText();
			const formatted = formatSproto(text);
			const firstLine = document.lineAt(0);
			const lastLine = document.lineAt(document.lineCount - 1);
			const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
			return [vscode.TextEdit.replace(fullRange, formatted)];
		}
	}));

}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
