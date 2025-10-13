
# 欢迎使用您的 VS Code 扩展


## 文件夹内容简介


* 此文件夹包含了扩展所需的所有文件。
* `package.json` - 这是声明扩展和命令的清单文件。
  * 示例插件注册了一个命令，并定义了其标题和命令名称。通过这些信息，VS Code 可以在命令面板中显示该命令，但此时还不需要加载插件。
* `extension.js` - 这是实现命令的主文件。
  * 该文件导出一个名为 `activate` 的函数，在扩展首次被激活时（例如执行命令时）调用。在 `activate` 函数内部会调用 `registerCommand`。
  * 我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。


## 立即开始使用


* 按下 `F5`，即可在新窗口中加载您的扩展。
* 在命令面板中（`Ctrl+Shift+P` 或 Mac 上的 `Cmd+Shift+P`）输入 `Hello World` 运行您的命令。
* 在 `extension.js` 文件中设置断点以调试您的扩展。
* 在调试控制台中查看扩展的输出。


## 进行更改


* 修改 `extension.js` 代码后，可以通过调试工具栏重新启动扩展。
* 也可以通过 `Ctrl+R`（或 Mac 上的 `Cmd+R`）重新加载 VS Code 窗口以加载更改。


## 探索 API


* 打开 `node_modules/@types/vscode/index.d.ts` 文件即可查看完整的 API。


## 运行测试


* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* 在活动栏中打开测试视图，点击“Run Test”按钮，或使用快捷键 `Ctrl/Cmd + ; A`
* 在测试结果视图中查看测试输出。
* 修改 `test/extension.test.js` 或在 `test` 文件夹中创建新的测试文件。
  * 提供的测试运行器只会考虑文件名匹配 `**.test.js` 的文件。
  * 您可以在 `test` 文件夹中创建子文件夹，自由组织测试结构。


## 深入探索


 * [遵循 UX 指南](https://code.visualstudio.com/api/ux-guidelines/overview)，打造与 VS Code 原生界面和模式无缝集成的扩展。
 * [发布您的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)到 VS Code 扩展市场。
 * 通过设置 [持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) 实现自动化构建。
 * 集成到 [问题反馈](https://code.visualstudio.com/api/get-started/wrapping-up#issue-reporting) 流程，便于用户提交问题和功能请求。
