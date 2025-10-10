const { DebugSession, InitializedEvent, TerminatedEvent, OutputEvent, Breakpoint, StoppedEvent } = require('vscode-debugadapter');
const { spawn } = require('child_process');

class SkynetDebugSession extends DebugSession {
    constructor() {
        super();
        this.debugProcess = null;
    }

    initializeRequest(response, args) {
        // this.sendEvent(new OutputEvent('收到 initialize11 请求: ' + JSON.stringify(args) + '\n', 'console'));
        response.body = {
            supportsConfigurationDoneRequest: true,
            supportsSetVariable: false,
            supportsConditionalBreakpoints: true,
            supportsHitConditionalBreakpoints: true,
        }
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());

    }

    configurationDoneRequest(response, args) {
        super.configurationDoneRequest(response, args);
        this.sendResponse(response);
    }

    launchRequest(response, args) {
        const { workdir, program, config, service } = args;
        if (workdir) {
            try {
                process.chdir(workdir);
            } catch (err) {
            }
        }

        // 设置环境变量 vscdbg_open 为 on
        const env = Object.assign({}, process.env, {
            vscdbg_open: 'on',
            vscdbg_service: service,
            vscdbg_bps: {},
            vscdbg_workdir: workdir,
        });

        const child = spawn(program, [config], { stdio: 'pipe', env: env });
        this.debugProcess = child;

        this.sendEvent(new OutputEvent(`skynet debugger start!\n`, 'console'));
        this.sendResponse(response);

        // 绑定子进程的输出和错误输出
        if (child.stdout) {
            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\r\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        // this.sendEvent(new OutputEvent(`来自子进程: ${JSON.stringify(event)}\n`, 'console'));
                        if (event.type === "event") {
                            this.sendEvent(event);
                        } else if (event.type === "response") {
                            this.sendResponse(event);
                        }
                    } catch (e) {
                        this.sendEvent(new OutputEvent(`error: ${line} ${e}\n`, 'console'));
                    }
                }
            });
        }

        if (child.stderr) {
            child.stderr.on('data', (data) => {
                this.sendEvent(new OutputEvent(`stderr: ${data}\n`, 'console'));
            });
        }

        child.on('close', (code) => {
            this.sendEvent(new OutputEvent(`skynet debugger exited with code ${code} \n`, 'console'));
            this.sendEvent(new TerminatedEvent());
        });
    }

    dispatchRequest(request, response) {
        // this.sendEvent(new OutputEvent(`来自VSCode请求: ` + JSON.stringify(request) + '\n', 'console'));

        // 原封不动转发给 子进程
        if (this.debugProcess && this.debugProcess.stdin.writable) {
            // this.sendEvent(new OutputEvent(`转发请求给子进程: ${JSON.stringify(request)}\n`, 'console'));
            this.debugProcess.stdin.write(JSON.stringify(request) + '\r\n');
        } else {
            super.dispatchRequest(request, response);
        }
    }
}

DebugSession.run(SkynetDebugSession);