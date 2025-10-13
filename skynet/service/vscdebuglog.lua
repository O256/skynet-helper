local skynet = require "skynet"
require "skynet.manager"
local cjson = require "cjson"
local vscdebugaux = require "skynet.vscdebugaux"
CMD = {}

local log_model = tonumber(skynet.getenv("logmodel")) or 0
local log_model_define = {
    general = 0, -- 通用模式
    fold = 1 -- 折叠模式, 只打印第一行,需要展开查看详细内容
}

local function send_event(event, body)
    local res = {
        seq = vscdebugaux.nextseq(),
        type = "event",
        event = event,
        body = body
    }
    local output = io.stdout
    local ok, msg = pcall(cjson.encode, res)
    if ok then
        local data = string.format("%s\r\n", msg)
        output:write(data)
        output:flush()
    else
        output:write(string.format("send_event - error: %s\n", msg))
    end
end

local function send_response(cmd, succ, rseq, content)
    local body, message
    if succ then
        body = content
    else
        message = content
    end
    local res = {
        -- seq = vscdebugaux.nextseq(),
        type = "response",
        success = succ,
        request_seq = rseq,
        command = cmd,
        body = body,
        message = message
    }
    local output = io.stdout
    local ok, msg = pcall(cjson.encode, res)
    if ok then
        local data = string.format("%s\r\n", msg)
        if output:write(data) then
            output:flush()
            return true
        end
    else
        skynet.error("send_response - error", msg)
    end
end

-- 日志变量处理
local logger_variable_id = 100000000 -- 从1亿开始
local get_next_logger_variable_id = function()
    logger_variable_id = logger_variable_id + 1
    return logger_variable_id
end

-- 保存日志到对应的变量
local logger_variables = {}
local function save_logger_variable(id, log)
    logger_variables[id] = log
end

local function get_logger_variable(id)
    return logger_variables[id]
end

-- 保存多行日志
local function save_logger_lines(header, lines, color_begin, color_end)
    -- 封装第一层
    local first_id = get_next_logger_variable_id()
    local next_id = get_next_logger_variable_id()
    local first_variable_data = {
        name = "log",
        value = string.format("%s... (%d lines)%s", color_begin, #lines, color_end),
        type = "string",
        variablesReference = next_id
    }

    local variables = {}
    table.insert(variables, first_variable_data)
    save_logger_variable(first_id, variables)

    -- 封装第二层
    local variables2 = {}
    for i = 1, #lines do
        local line_data = {
            name = "",
            value = lines[i],
            type = "string",
            variablesReference = 0
        }
        table.insert(variables2, line_data)
    end
    save_logger_variable(next_id, variables2)

    return first_id
end

function CMD.variables(req)
    local varref = req.arguments.variablesReference
    local vars = get_logger_variable(varref)

    if not vars then
        return send_response(req.command, false, req.seq, "no such variable")
    end
    send_response(req.command, true, req.seq, {
        variables = vars
    })

end

-- register protocol text before skynet.start would be better.
skynet.register_protocol {
    name = "text",
    id = skynet.PTYPE_TEXT,
    unpack = skynet.tostring,
    dispatch = function(_, address, msg)
        local line, source
        if msg:find("co.vsc.db.", 1, true) == 1 then
            line, source, msg = msg:match("co.vsc.db.([^|]+)|([^|]+)|(.+)$")
        end

        if source then
            source = {
                path = source
            }
        end

        -- 获取msg中的终端颜色码，开头类似 \x1b[32m ， 结尾类似 \x1b[0m
        -- 将msg中的颜色码提取出来并删掉
        -- #define KNRM "\x1B[0m"
        -- #define KRED "\x1B[31m"

        local reg = "\27%[[0-9;]*m"
        local color_codes = {}
        msg:gsub(reg, function(codes)
            table.insert(color_codes, codes)
        end)
        msg = msg:gsub(reg, "")

        local color_begin = color_codes[1] or ""
        local color_end = color_codes[#color_codes] or ""

        -- 将msg通过\n分割成多行
        local lines = {}
        for l in msg:gmatch("([^\n]*)\n?") do
            if l ~= "" then
                table.insert(lines, l)
            end
        end
        local category = "test1111"
        local header = string.format("%s%s.%02d [:%08x] %s%s\n", color_begin, os.date("%Y-%m-%d %H:%M:%S"), skynet.now() % 100, address, lines[1], color_end)

        if #lines <= 1 then
            send_event("output", {
                category = category,
                source = source,
                line = tonumber(line),
                output = header
            })
        else
            if log_model == log_model_define.general then
                -- 通用模式
                for i = 1, #lines do
                    local line_output = string.format("%s%s%s\n", color_begin, lines[i], color_end)
                    send_event("output", {
                        category = category,
                        source = source,
                        line = tonumber(line),
                        output = line_output
                    })
                end
                return
            else
                -- 折叠模式
                local variable_id = save_logger_lines(header, lines, color_begin, color_end)
                send_event("output", {
                    category = category,
                    source = source,
                    line = tonumber(line),
                    output = header,
                    variablesReference = variable_id
                })
            end
        end
    end
}

skynet.register_protocol {
    name = "SYSTEM",
    id = skynet.PTYPE_SYSTEM,
    unpack = function(...)
        return ...
    end,
    dispatch = function()
        -- reopen signal
    end
}

skynet.start(function()
    skynet.register(".vscdebuglog")

    skynet.dispatch("lua", function(_, _, cmd, ...)
        local f = CMD[cmd]
        if f then
            skynet.ret(skynet.pack(f(...)))
        else
            skynet.error(string.format("vscdebuglog unknown command %s", cmd))
        end
    end)
end)
