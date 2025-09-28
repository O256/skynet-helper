const { DebugSession, InitializedEvent, TerminatedEvent, OutputEvent, Breakpoint, StoppedEvent } = require('vscode-debugadapter');
const { spawn } = require('child_process');

class SkynetDebugSession extends DebugSession {
    constructor() {
        super();
        this.debugProcess = null;
    }

    initializeRequest(response, args) {
        // this.sendEvent(new OutputEvent('收到 initialize 请求: ' + JSON.stringify(args) + '\n', 'console'));
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
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

        const child = spawn(program, [config], { stdio: 'inherit', env: env });
        this.debugProcess = child;

        // 等待子进程退出, 然后退出自己
        child.on('exit', (code, signal) => {
            this.sendEvent(new OutputEvent(`skynet debugger stop!\n`, 'console'));
            this.sendEvent(new TerminatedEvent());
            this.shutdown();
        });

        this.sendEvent(new OutputEvent(`skynet debugger start!\n`, 'console'));
        this.sendResponse(response);
    }
}

DebugSession.run(SkynetDebugSession);