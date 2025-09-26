const vscode = require('vscode');
function activate(context) {
	console.log('Congratulations, your extension "hello" is now active!');
	const disposable = vscode.commands.registerCommand('hello.helloWorld', function () {
		vscode.window.showInformationMessage('Hello World from my tooooo!');
	});

	context.subscriptions.push(disposable);
}
function deactivate() { }
module.exports = {
	activate,
	deactivate
}
