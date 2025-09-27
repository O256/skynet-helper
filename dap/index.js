const readline = require('readline');
const fs = require('fs');

function log(message) {
    // 写入文件
    fs.appendFileSync('./dap.log', message + '\n');
    // 通过 DAP output 事件发送日志
    sendResponse({
        seq: 0,
        type: 'event',
        event: 'output',
        body: {
            category: 'console',
            output: message + '\n'
        }
    });
}

log("arguments: " + process.argv.join(' '));

function sendResponse(response) {
    const json = JSON.stringify(response);
    // DAP 消息需要 Content-Length 头
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}`;
    process.stdout.write(header + '\r\n\r\n' + json);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let buffer = '';

function handleRequest(request) {
    log('收到请求: ' + JSON.stringify(request));
    // 模拟响应
    switch (request.command) {
        case 'initialize':
            sendResponse({
                seq: request.seq,
                type: 'response',
                request_seq: request.seq,
                success: true,
                command: 'initialize',
                body: {
                    supportsConfigurationDoneRequest: true
                }
            });
            break;
        case 'launch':
            // 读取参数
            const { workdir, program, config, service } = request.arguments || {};
            log(`启动参数: workdir=${workdir}, program=${program}, config=${config}, service=${service}`);
            // 切换工作目录
            if (workdir) {
                try {
                    process.chdir(workdir);
                    log(`切换工作目录到: ${workdir}`);
                } catch (e) {
                    log(`切换工作目录失败: ${e.message}`);
                }
            }
            // 设置环境变量
            process.env.vscdbg_workdir = workdir || '';
            process.env.vscdbg_service = service || '';
            log(`设置环境变量: vscdbg_workdir=${process.env.vscdbg_workdir}, vscdbg_service=${process.env.vscdbg_service}`);

            sendResponse({
                seq: request.seq,
                type: 'response',
                request_seq: request.seq,
                success: true,
                command: 'launch',
                body: {}
            });
            break;
        case 'setBreakpoints':
            sendResponse({
                seq: request.seq,
                type: 'response',
                request_seq: request.seq,
                success: true,
                command: 'setBreakpoints',
                body: {
                    breakpoints: (request.arguments.breakpoints || []).map(bp => ({
                        verified: true,
                        line: bp.line
                    }))
                }
            });
            break;
        default:
            sendResponse({
                seq: request.seq,
                type: 'response',
                request_seq: request.seq,
                success: true,
                command: request.command,
                body: {}
            });
    }
}

// 解析 DAP 消息（Content-Length 头 + JSON）
process.stdin.on('data', chunk => {
    buffer += chunk.toString();
    while (true) {
        const headerMatch = buffer.match(/Content-Length: (\d+)\r\n\r\n/);
        if (!headerMatch) break;
        const len = parseInt(headerMatch[1], 10);
        const headerLen = headerMatch[0].length;
        if (buffer.length < headerLen + len) break;
        const jsonStr = buffer.substr(headerLen, len);
        buffer = buffer.substr(headerLen + len);
        try {
            const request = JSON.parse(jsonStr);
            handleRequest(request);
        } catch (e) {
            console.error('解析 DAP 消息失败:', e);
        }
    }
});


