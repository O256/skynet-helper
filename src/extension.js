const vscode = require('vscode');
const { formatSproto } = require('./sprotoFormatter');
const { parseSprotoTypes } = require('./sprotoParser');

function activate(context) {
	console.log('Skynet Helper now active!');

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


	// 类型定义缓存 { 类型名: { uri, position } }
	let sprotoTypeDefs = {};

	// 扫描所有 .sproto 文件并收集类型定义
	async function scanWorkspaceSprotoTypes() {
		sprotoTypeDefs = {};
		const files = await vscode.workspace.findFiles('**/*.sproto');
		for (const file of files) {
			console.log('扫描 Sproto 文件:', file.fsPath);
			const document = await vscode.workspace.openTextDocument(file);
			const types = parseSprotoTypes(document);
			Object.entries(types).forEach(([name, pos]) => {
				sprotoTypeDefs[name] = { uri: file, position: pos };
				console.log(`[Sproto类型] ${name} 定义于:`, file.fsPath, pos);
			});
		}
	}

	// 激活时扫描一次
	scanWorkspaceSprotoTypes();
	// 文件保存时重新扫描
	vscode.workspace.onDidSaveTextDocument(doc => {
		if (doc.languageId === 'sproto') scanWorkspaceSprotoTypes();
	});

	// 注册 sproto 类型定义跳转提供者
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(
			{ language: 'sproto', scheme: 'file' },
			{
				provideDefinition(document, position) {
					const wordRange = document.getWordRangeAtPosition(position, /\b\w+\b/);
					console.log('触发类型定义跳转:', document.uri.fsPath, position, wordRange);
					if (!wordRange) return;
					const typeName = document.getText(wordRange);
					const def = sprotoTypeDefs[typeName] || sprotoTypeDefs['.' + typeName];
					console.log('查找类型定义:', typeName, def);
					if (def) {
						return new vscode.Location(def.uri, def.position);
					}
				}
			}
		)
	);

	// 注册 sproto 类型 Hover 提示
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			{ language: 'sproto', scheme: 'file' },
			{
				provideHover(document, position) {
					const wordRange = document.getWordRangeAtPosition(position, /\b\w+\b/);
					if (!wordRange) return;
					const typeName = document.getText(wordRange);
					const def = sprotoTypeDefs[typeName] || sprotoTypeDefs['.' + typeName];
					if (def) {
						// 读取类型定义文件内容，显示前面注释和完整类型定义（直到下一个类型/协议或文件结尾）
						return vscode.workspace.openTextDocument(def.uri).then(typeDoc => {
							const startLine = def.position.line;
							let endLine = typeDoc.lineCount - 1;
							const typeOrProtoRegex = /^\s*(\.|[\w_]+\s+\d+\s*\{)/;
							for (let i = startLine + 1; i < typeDoc.lineCount; i++) {
								if (typeOrProtoRegex.test(typeDoc.lineAt(i).text)) {
									endLine = i - 1;
									break;
								}
							}
							// 向上收集注释（只允许连续注释，遇到空行或非注释即停）
							let commentStart = startLine;
							for (let i = startLine - 1; i >= 0; i--) {
								const text = typeDoc.lineAt(i).text.trim();
								if (text.startsWith('#')) {
									commentStart = i;
								} else {
									break;
								}
							}
							// 向下收集类型定义，遇到下一个类型/协议或注释即停
							let trueEndLine = endLine;
							for (let i = startLine + 1; i <= endLine; i++) {
								const text = typeDoc.lineAt(i).text.trim();
								if (text.startsWith('#')) {
									trueEndLine = i - 1;
									break;
								}
							}
							const lines = [];
							for (let i = commentStart; i <= trueEndLine; i++) {
								lines.push(typeDoc.lineAt(i).text);
							}
							// 去除前置空行
							while (lines.length && lines[0].trim() === '') lines.shift();
							const codeBlock = [
								'```sproto',
								...lines,
								'```'
							].join('\n');
							return new vscode.Hover(codeBlock);
						});
					}
				}
			}
		)
	);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
