const { DebugSession, InitializedEvent, TerminatedEvent, OutputEvent, Breakpoint, StoppedEvent } = require('vscode-debugadapter');
const { spawn } = require('child_process');

class SkynetDebugSession extends DebugSession {
    constructor() {
        super();
        this.debugProcess = null;
    }

    initializeRequest(response, args) {
        this.sendEvent(new OutputEvent('收到 initialize 请求: ' + JSON.stringify(args) + '\n', 'console'));
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }

    launchRequest(response, args) {
        this.sendEvent(new OutputEvent('收到 launch 请求: ' + JSON.stringify(args) + '\n', 'console'));
        const { workdir, program, config, service } = args;
        if (workdir) {
            try {
                process.chdir(workdir);
                this.sendEvent(new OutputEvent(`工作目录已更改为: ${workdir}\n`, 'console'));
            } catch (err) {
                this.sendEvent(new OutputEvent(`更改工作目录失败: ${err.message}\n`, 'console'));
            }
        }

        const child = spawn(program, [config], { stdio: ['pipe', 'pipe', 'pipe'] });
        this.debugProcess = child;

        let buffer = '';
        let contentLength = null;

        child.stdout.on('data', data => {
            buffer += data.toString();

            while (true) {
                if (contentLength == null) {
                    // 查找 Content-Length 头
                    const match = buffer.match(/Content-Length: (\d+)\r\n\r\n/);
                    if (match) {
                        contentLength = parseInt(match[1], 10);
                        buffer = buffer.slice(match.index + match[0].length);
                    } else {
                        break; // 没有完整头，等待更多数据
                    }
                }

                if (contentLength != null && buffer.length >= contentLength) {
                    const jsonStr = buffer.slice(0, contentLength);
                    buffer = buffer.slice(contentLength);
                    contentLength = null;
                    try {
                        const json = JSON.parse(jsonStr);
                        this.sendEvent(new OutputEvent(json.body.output, 'console'));
                    } catch (err) {
                        // 解析失败处理
                        this.sendEvent(new OutputEvent('无法解析输出为 JSON: ' + err.message + '\n原始数据: ' + jsonStr, 'stderr'));
                    }
                } else {
                    break; // 等待更多数据
                }
            }
        });
        child.stderr.on('data', data => {
            this.sendEvent(new OutputEvent('子进程错误: ' + data.toString(), 'console'));
            this.sendEvent(new OutputEvent(data.toString(), 'stderr'));
        });
        child.on('exit', (code, signal) => {
            this.sendEvent(new OutputEvent(`调试程序已退出: code=${code}, signal=${signal}\n`, 'console'));
            this.sendEvent(new TerminatedEvent());
        });

        this.sendResponse(response);
    }

    setBreakPointsRequest(response, args) {
        this.sendEvent(new OutputEvent('收到 setBreakPoints 请求: ' + JSON.stringify(args) + '\n', 'console'));
        const breakpoints = (args.breakpoints || []).map(bp => new Breakpoint(true, bp.line));
        response.body = { breakpoints };
        this.sendResponse(response);
    }

    // 其他 DAP 请求可按需实现
}

DebugSession.run(SkynetDebugSession);