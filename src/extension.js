const vscode = require('vscode');
const { formatSproto } = require('./sprotoFormatter');
const { parseSprotoTypes } = require('./sprotoParser');

const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

function activate(context) {
	console.log('Skynet Helper now active!');

	// 注册 skynet.debug 指令
	const skynetDebugCmd = vscode.commands.registerCommand('skynet.debug', async function () {
		// 让用户选择目标 skynet 目录
		const folders = await vscode.window.showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			openLabel: '选择 skynet 目录'
		});
		if (!folders || folders.length === 0) {
			vscode.window.showWarningMessage('未选择目录，操作已取消');
			return;
		}
		const targetDir = folders[0].fsPath;
		// 插件内 skynet 目录
		const extensionSkynetDir = path.join(__dirname, '../skynet');
		if (!fs.existsSync(extensionSkynetDir)) {
			vscode.window.showErrorMessage('插件内未找到 skynet 目录');
			return;
		}
		try {
			await fse.copy(extensionSkynetDir, targetDir, { overwrite: true });
			// 递归查找 Makefile
			const makefiles = [];
			function findMakefiles(dir) {
				const files = fs.readdirSync(dir);
				for (const file of files) {
					const fullPath = path.join(dir, file);
					const stat = fs.statSync(fullPath);
					if (stat.isDirectory()) {
						findMakefiles(fullPath);
					} else if (file === 'Makefile') {
						makefiles.push(fullPath);
					}
				}
			}
			findMakefiles(targetDir);
			let modified = false;
			for (const mkfile of makefiles) {
				let content = fs.readFileSync(mkfile, 'utf8');
				let changed = false;
				// 处理多行 LUA_CLIB_SKYNET
				const lines = content.split(/\r?\n/);
				let start = -1, end = -1;
				for (let i = 0; i < lines.length; i++) {
					if (start === -1 && /^LUA_CLIB_SKYNET\s*=/.test(lines[i])) {
						start = i;
						end = i;
						// 向下查找续行
						while (end + 1 < lines.length && /\\\s*$/.test(lines[end])) {
							end++;
						}
						break;
					}
				}
				if (start !== -1) {
					// 收集所有源码文件
					let block = lines.slice(start, end + 1);
					let blockStr = block.join('\n');
					if (!/lua-vscdebugaux\.c/.test(blockStr)) {
						// 找到最后一个源码文件（最后一个非空且不是 \\ 的行）
						let insertIdx = end;
						for (let i = end; i >= start; i--) {
							if (lines[i].trim() !== '' && !/^\s*\\\s*$/.test(lines[i])) {
								insertIdx = i;
								break;
							}
						}
						// 插入 lua-vscdebugaux.c
						const indent = lines[insertIdx].match(/^\s*/)[0] || '';
						lines.splice(insertIdx + 1, 0, `${indent}lua-vscdebugaux.c \\`);
						changed = true;
					}
				}
				// 处理 LUA_CLIB 多行，添加 cjson（无 .so，带反斜杠）
				let clibStart = -1, clibEnd = -1;
				for (let i = 0; i < lines.length; i++) {
					if (clibStart === -1 && /^LUA_CLIB\s*=/.test(lines[i])) {
						clibStart = i;
						clibEnd = i;
						while (clibEnd + 1 < lines.length && /\\\s*$/.test(lines[clibEnd])) {
							clibEnd++;
						}
						break;
					}
				}
				if (clibStart !== -1) {
					let block = lines.slice(clibStart, clibEnd + 1);
					let blockStr = block.join('\n');
					// 检查是否已包含 cjson（不带.so）
					if (!/(^|\s)cjson(\s|\\|$)/.test(blockStr)) {
						// 找到最后一个非空且不是 \\ 的行
						let insertIdx = clibEnd;
						for (let i = clibEnd; i >= clibStart; i--) {
							if (lines[i].trim() !== '' && !/^\s*\\\s*$/.test(lines[i])) {
								insertIdx = i;
								break;
							}
						}
						// 在该行末尾加 cjson \\，注意处理已有反斜杠
						let line = lines[insertIdx].replace(/\s*\\\s*$/, '');
						line = line.replace(/\s*$/, '');
						lines[insertIdx] = line + ' cjson \\';
						changed = true;
					}
				}
				// 添加 cjson 编译规则（如无则加，插入到 clean 之前）
				const cjsonRule = '$(LUA_CLIB_PATH)/cjson.so : 3rd/lua-cjson/lua_cjson.c 3rd/lua-cjson/fpconv.c 3rd/lua-cjson/strbuf.c | $(LUA_CLIB_PATH)';
				const cjsonCmd = '\t$(CC) $(CFLAGS) $(SHARED) -I3rd/lua-cjson $^ -o $@';
				if (!content.includes('$(LUA_CLIB_PATH)/cjson.so')) {
					let cleanIdx = lines.findIndex(line => /^\s*clean\s*:/.test(line));
					if (cleanIdx === -1) {
						// 没有 clean，插入末尾
						lines.push('', cjsonRule, cjsonCmd, '');
					} else {
						// 插入到 clean 规则前
						lines.splice(cleanIdx, 0, '', cjsonRule, cjsonCmd, '');
					}
					changed = true;
				}
				if (changed) {
					content = lines.join('\n');
					fs.writeFileSync(mkfile, content, 'utf8');
					modified = true;
				}
			}
			vscode.window.showInformationMessage('skynet 目录已成功拷贝到: ' + targetDir + (modified ? '，Makefile 已自动修改。' : '，未找到可修改的 Makefile。'));
		} catch (err) {
			vscode.window.showErrorMessage('拷贝或修改 skynet 目录失败: ' + err.message);
		}
	});
	context.subscriptions.push(skynetDebugCmd);

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
