const path = require('path');
const fs = require('fs');

/**
 * 修补 skynet 目录下所有 Makefile
 * @param {string} targetDir skynet 目录
 * @returns {boolean} 是否有文件被修改
 */
function patchMakefile(targetDir) {
    // 只处理指定目录下的 Makefile，不递归
    const mkfile = path.join(targetDir, 'Makefile');
    if (!fs.existsSync(mkfile)) {
        return false;
    }
    let content = fs.readFileSync(mkfile, 'utf8');
    let changed = false;
    const lines = content.split(/\r?\n/);
    // LUA_CLIB_SKYNET
    let start = -1, end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (start === -1 && /^LUA_CLIB_SKYNET\s*=/.test(lines[i])) {
            start = i;
            end = i;
            while (end + 1 < lines.length && /\\\s*$/.test(lines[end])) {
                end++;
            }
            break;
        }
    }
    if (start !== -1) {
        let block = lines.slice(start, end + 1);
        let blockStr = block.join('\n');
        if (!/lua-vscdebugaux\.c/.test(blockStr)) {
            let insertIdx = end;
            for (let i = end; i >= start; i--) {
                if (lines[i].trim() !== '' && !/^\s*\\\s*$/.test(lines[i])) {
                    insertIdx = i;
                    break;
                }
            }
            const indent = lines[insertIdx].match(/^\s*/)[0] || '';
            lines.splice(insertIdx + 1, 0, `${indent}lua-vscdebugaux.c \\`);
            changed = true;
        }
    }
    // LUA_CLIB
    let clibStart = -1, clibEnd = -1;
    for (let i = 0; i < lines.length; i++) {
        if (clibStart === -1 && /^LUA_CLIB\s*=/.test(lines[i])) {
            clibStart = i;
            clibEnd = i;
            while (clibEnd + 1 < lines.length && /\\\s*$/.test(lines[clibEnd])) {
                clibEnd++;
            }
            break;
        }
    }
    if (clibStart !== -1) {
        let block = lines.slice(clibStart, clibEnd + 1);
        let blockStr = block.join('\n');
        if (!/(^|\s)cjson(\s|\\|$)/.test(blockStr)) {
            let insertIdx = clibEnd;
            for (let i = clibEnd; i >= clibStart; i--) {
                if (lines[i].trim() !== '' && !/^\s*\\\s*$/.test(lines[i])) {
                    insertIdx = i;
                    break;
                }
            }
            // 在该行末尾加 cjson \\,注意处理已有反斜杠
            let line = lines[insertIdx].replace(/\s*\\\s*$/, '');
            line = line.replace(/\s*$/, '');
            lines[insertIdx] = line + ' cjson \\';
            changed = true;
        }
    }
    // cjson 编译规则
    const cjsonRule = '$(LUA_CLIB_PATH)/cjson.so : 3rd/lua-cjson/lua_cjson.c 3rd/lua-cjson/fpconv.c 3rd/lua-cjson/strbuf.c | $(LUA_CLIB_PATH)';
    const cjsonCmd = '\t$(CC) $(CFLAGS) $(SHARED) -I3rd/lua-cjson $^ -o $@';
    if (!content.includes('$(LUA_CLIB_PATH)/cjson.so')) {
        let cleanIdx = lines.findIndex(line => /^\s*clean\s*:/.test(line));
        if (cleanIdx === -1) {
            lines.push('', cjsonRule, cjsonCmd, '');
        } else {
            lines.splice(cleanIdx, 0, '', cjsonRule, cjsonCmd, '');
        }
        changed = true;
    }
    if (changed) {
        content = lines.join('\n');
        fs.writeFileSync(mkfile, content, 'utf8');
        return true;
    }
    return false;
}

module.exports = {
    patchMakefile
};
