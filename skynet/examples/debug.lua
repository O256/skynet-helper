local skynet = require "skynet"

function test_handler()
    skynet.error("test timer")
end

function test_timer()
    local function _timer()
        skynet.timeout(100, _timer)
        test_handler()
    end
    skynet.timeout(100, _timer)
end

skynet.error("Debug service loaded")

skynet.start(function()
    skynet.error("Debug service start")
    test_timer()
end)
