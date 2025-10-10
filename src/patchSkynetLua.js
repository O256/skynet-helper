const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

/**
 * 在 lualib/skynet.lua 文件 return skynet 之前插入 vscode debug 代码
 * @param {string} targetDir 目标 skynet 目录
 */
function patchSkynetLua(targetDir) {
    const luaPath = path.join(targetDir, 'lualib', 'skynet.lua');
    if (!fs.existsSync(luaPath)) return false;
    let content = fs.readFileSync(luaPath, 'utf8');
    const insertCode = `-- vscode debug\nlocal vscdebug = require "skynet.vscdebug"\nvscdebug.init(skynet, {\n\tsuspend = suspend,\n\tresume = coroutine_resume,\n})\n`;
    if (content.includes(insertCode)) return false;
    const patched = content.replace(/^(\s*)return\s+skynet\s*$/m, (m, p1) => insertCode + p1 + 'return skynet');
    if (patched !== content) {
        fs.writeFileSync(luaPath, patched, 'utf8');
        return true;
    }
    return false;
}

module.exports = {
    patchSkynetLua
};
