local skynet = require "skynet"

local u = 9999
function test_handler()
    local a = 1
    local r = a + u
    return r
end

function test_timer()
    local function _timer()
        test_handler()
        skynet.timeout(100, _timer)
    end
    skynet.timeout(100, _timer)
end

skynet.error("Debug service loaded")

skynet.start(function()
    skynet.error("Debug service start")
    test_timer()
end)
