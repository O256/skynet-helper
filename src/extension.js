const vscode = require('vscode');
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

	// 格式化sproto文件
	function formatSproto(text) {
		const lines = text.split(/\r?\n/)
			.map(line => line.trim())
			.filter(line => line.length > 0);
		let indent = 0;
		let inBlock = false;
		let blockType = '';
		let blockLines = [];
		let result = [];
		let requestLines = null;
		let responseLines = null;
		let lastBlockType = null; // 记录上一个块类型
		function alignColon(blocks) {
			// blocks: [requestLines, responseLines]
			const allLines = blocks.flat();
			const fieldLines = allLines.filter(l => /^\w+\s+\d+\s*:\s*\w+/.test(l));
			if (fieldLines.length === 0) return blocks;
			// 找字段名、编号、类型的最大长度
			let maxFieldLen = 0, maxNumLen = 0, maxTypeLen = 0;
			fieldLines.forEach(l => {
				const m = l.match(/^(\w+)\s+(\d+)\s*:\s*(\w+)/);
				if (m) {
					if (m[1].length > maxFieldLen) maxFieldLen = m[1].length;
					if (m[2].length > maxNumLen) maxNumLen = m[2].length;
					if (m[3].length > maxTypeLen) maxTypeLen = m[3].length;
				}
			});
			function formatLines(lines) {
				return lines.map(l => {
					const m = l.match(/^(\w+)\s+(\d+)\s*:\s*(\w+)(.*)$/);
					if (m) {
						const field = m[1];
						const num = m[2];
						const type = m[3];
						const rest = m[4] || '';
						const fieldPad = ' '.repeat(maxFieldLen - field.length);
						const numPad = ' '.repeat(maxNumLen - num.length);
						const typePad = ' '.repeat(maxTypeLen - type.length);
						return `${field}${fieldPad} ${num}${numPad} : ${type}${typePad}${rest}`;
					}
					return l;
				});
			}
			return blocks.map(formatLines);
		}
		const indentStr = '    ';
		let lastProtocolEnd = false;
		let pendingComments = [];
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// 收集协议块前的注释
			if (line.startsWith('#')) {
				pendingComments.push(line);
				continue;
			}
			// 判断是否为协议块开始
			if (/^\w+\s+\d+\s*\{$/.test(line)) {
				if (lastProtocolEnd) {
					// 协议块之间插入空行
					result.push('');
				}
				// 协议块和数据结构块之间插入空行
				if (lastBlockType && lastBlockType !== 'protocol') {
					if (result.length > 0 && result[result.length - 1] !== '') {
						result.push('');
					}
				}
				lastBlockType = 'protocol';
				// 输出注释
				if (pendingComments.length > 0) {
					pendingComments.forEach(c => result.push(c));
					pendingComments = [];
				}
				lastProtocolEnd = false;
				// 新增：协议块内 request/response 收集逻辑
				let protocolIndent = indent;
				let protocolLines = [];
				let protocolBlock = true;
				i++; // 跳过协议块开始行
				while (i < lines.length && protocolBlock) {
					let pline = lines[i];
					if (pline.endsWith('{')) {
						protocolLines.push(indentStr.repeat(protocolIndent + 1) + pline);
						protocolIndent++;
					} else if (pline.endsWith('}')) {
						protocolIndent--;
						protocolLines.push(indentStr.repeat(protocolIndent + 1) + pline);
						if (protocolIndent < indent) {
							protocolBlock = false;
						}
					} else {
						protocolLines.push(indentStr.repeat(protocolIndent + 1) + pline);
					}
					i++;
				}
				result.push(indentStr.repeat(indent) + line);
				protocolLines.forEach(l => result.push(l));
				lastProtocolEnd = true;
				i--;
				continue;
			}
			// 判断是否为数据结构块开始（如 .xxx {）
			if (/^\.[\w_]+\s*\{$/.test(line)) {
				if (lastBlockType && lastBlockType !== 'struct') {
					if (result.length > 0 && result[result.length - 1] !== '') {
						result.push('');
					}
				}
				lastBlockType = 'struct';
				// 数据结构块前的注释和数据结构作为整体输出
				if (pendingComments.length > 0) {
					pendingComments.forEach(c => result.push(c));
					pendingComments = [];
				}
			}
			if (line.endsWith('{')) {
				result.push(indentStr.repeat(Math.max(indent, 0)) + line);
				indent += 1;
				// 检查是否进入 request/response block
				if (/^(request|response)\s*\{$/.test(line)) {
					inBlock = true;
					blockType = line.replace('{', '').trim();
					blockLines = [];
					continue;
				}
				// 进入协议块，重置 request/response
				if (/^\w+\s+\d+\s*\{$/.test(line)) {
					requestLines = null;
					responseLines = null;
				}
			} else if (line.endsWith('}')) {
				indent -= 1;
				// 检查是否离开 request/response block
				if (inBlock) {
					if (blockType === 'request') {
						requestLines = blockLines.slice();
					} else if (blockType === 'response') {
						responseLines = blockLines.slice();
					}
					inBlock = false;
					blockType = '';
					blockLines = [];
					// 如果 request 和 response 都收集完毕，统一对齐
					if (requestLines && responseLines) {
						const [alignedReq, alignedRes] = alignColon([requestLines, responseLines]);
						alignedReq.forEach(l => {
							result.push(indentStr.repeat(Math.max(indent, 0) + 1) + l);
						});
						result.push(indentStr.repeat(Math.max(indent, 0)) + '}');
						result.push(indentStr.repeat(Math.max(indent, 0)) + 'response {');
						alignedRes.forEach(l => {
							result.push(indentStr.repeat(Math.max(indent, 0) + 1) + l);
						});
						result.push(indentStr.repeat(Math.max(indent, 0)) + '}');
						requestLines = null;
						responseLines = null;
						lastProtocolEnd = true;
						continue;
					} else {
						// 单独对齐（兼容只有 request 或只有 response 的情况）
						const [aligned] = alignColon([blockLines]);
						aligned.forEach(l => {
							result.push(indentStr.repeat(Math.max(indent, 0) + 1) + l);
						});
						result.push(indentStr.repeat(Math.max(indent, 0)) + line);
						lastProtocolEnd = true;
						continue;
					}
				}
				result.push(indentStr.repeat(Math.max(indent, 0)) + line);
				// 判断是否为协议块结束
				if (indent === 0) {
					lastProtocolEnd = true;
				}
			} else if (inBlock) {
				blockLines.push(line);
			} else {
				result.push(indentStr.repeat(Math.max(indent, 0)) + line);
			}
		}
		// 文件结尾还有注释，补充输出
		if (pendingComments.length > 0) {
			pendingComments.forEach(c => result.push(c));
		}
		return result.join('\n');
	}
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
