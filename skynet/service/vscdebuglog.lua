local skynet = require "skynet"
require "skynet.manager"
local cjson = require "cjson"
local vscdebugaux = require "skynet.vscdebugaux"

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
        -- local data = string.format("Content-Length: %s\r\n\r\n%s\n", #msg, msg)
        local data = string.format("%s\r\n", msg)
        output:write(data)
        output:flush()
    else
        output:write(string.format("send_event - error: %s\n", msg))
    end
end

-- register protocol text before skynet.start would be better.
skynet.register_protocol {
    name = "text",
    id = skynet.PTYPE_TEXT,
    unpack = skynet.tostring,
    dispatch = function(_, address, msg)
        if msg:find("co.vsc.db.", 1, true) == 1 then
            local line, source, message = msg:match("co.vsc.db.([^|]+)|([^|]+)|(.+)$")
            if not (line and source and message) then
                return -- 格式不对直接丢弃
            end
            source = {
                path = source
            }

            send_event("output", {
                category = "stdout",
                output = string.format("%s.%02d [:%08x] %s\n", os.date("%Y-%m-%d %H:%M:%S"), skynet.now() % 100, address, message),
                source = source,
                line = tonumber(line)
            })
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
end)
