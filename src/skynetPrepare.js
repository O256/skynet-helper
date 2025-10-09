const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

/**
 * 拷贝 skynet 目录并自动修正 Makefile
 * @param {string} extensionSkynetDir 插件内 skynet 目录
 * @param {string} targetDir 用户选择的 skynet 目录
 * @param {function} showInfo 信息提示回调
 * @param {function} showError 错误提示回调
 */
const { patchSkynetLua } = require('./patchSkynetLua');
const { patchMakefile } = require('./patchMakefile');

async function prepareSkynet(extensionSkynetDir, targetDir, showInfo, showError) {
    if (!fs.existsSync(extensionSkynetDir)) {
        showError('插件内未找到 skynet 目录');
        return;
    }
    try {
        await fse.copy(extensionSkynetDir, targetDir, { overwrite: true });
        const modified = patchMakefile(targetDir);
        let luaPatched = patchSkynetLua(targetDir);
        let msg = 'skynet 目录已成功拷贝到: ' + targetDir;
        if (modified) msg += '，Makefile 已自动修改。';
        else msg += '，未找到可修改的 Makefile。';
        if (luaPatched) msg += ' lualib/skynet.lua 已插入 vscode debug 代码。';
        showInfo(msg);
    } catch (err) {
        showError('拷贝或修改 skynet 目录失败: ' + err.message);
    }
}

module.exports = {
    prepareSkynet
};
