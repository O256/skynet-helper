// sprotoFormatter.js
// 而格式化sproto文件

// Sproto AST 结构：
// {
//   types: [ { name, fields: [ { name, id, type, isArray, comment } ], comment } ],
//   protocols: [ { name, id, request, response, comment } ]
// }
function parseSproto(text) {
    const lines = text.split(/\r?\n/);
    const ast = { types: [], protocols: [], headerComments: [] };
    let i = 0;
    let pendingComments = [];
    // 去除 headerComments 相关逻辑
    while (i < lines.length) {
        let rawLine = lines[i];
        let line = rawLine.trim();

        // 悬空注释添加到头部注释
        if (!line) {
            for (const c of pendingComments) {
                ast.headerComments.push(c);
            }
            pendingComments = [];
            i++;
            continue;
        }

        // 收集块前注释
        if (line.startsWith('#')) {
            pendingComments.push(rawLine);
            i++;
            continue;
        }

        // 类型定义
        if (/^\.[\w_]+\s*\{/.test(line)) {
            const typeMatch = line.match(/^\.([\w_]+)\s*\{/);
            const typeName = typeMatch[1];
            let fields = [];
            let comment = '';

            // 将紧挨着的注释归属到类型上
            if (pendingComments.length > 0) {
                let isAdjacent = true;
                for (let k = pendingComments.length - 1; k >= 0; k--) {
                    if (pendingComments[k].trim() !== '' && !pendingComments[k].trim().startsWith('#')) {
                        isAdjacent = false;
                        break;
                    }
                }
                if (isAdjacent) comment = pendingComments.join('\n');
            }
            pendingComments = [];
            i++;
            while (i < lines.length && !lines[i].includes('}')) {
                let fieldLine = lines[i].trim();
                if (!fieldLine) { i++; continue; }
                if (fieldLine.startsWith('#')) { comment += (comment ? '\n' : '') + fieldLine; i++; continue; }
                // 解析字段
                // 支持 *item, *item(item_id), item, item(item_id) 类型，避免 * 和类型名之间有空格
                const fieldMatch = fieldLine.match(/^([\w_]+)\s+(\d+)\s*:\s*(\*?[\w_]+(?:\([^)]*\))?)(.*)$/);
                if (fieldMatch) {
                    let typeStr = fieldMatch[3];
                    let isArray = false;
                    let type = typeStr;
                    if (typeStr.startsWith('*')) {
                        isArray = true;
                        type = typeStr.slice(1);
                    }
                    fields.push({
                        name: fieldMatch[1],
                        id: Number(fieldMatch[2]),
                        isArray,
                        type,
                        comment: fieldMatch[4] ? fieldMatch[4].trim() : ''
                    });
                }
                i++;
            }
            ast.types.push({ name: typeName, fields, comment: comment.trim() });
            i++;
            continue;
        }

        // 协议定义
        if (/^[\w_]+\s+\d+\s*\{/.test(line)) {
            const protoMatch = line.match(/^([\w_]+)\s+(\d+)\s*\{/);
            const protoName = protoMatch[1];
            const protoId = Number(protoMatch[2]);
            let request = null, response = null;
            let comment = '';
            // 将紧挨着的注释归属到类型上
            if (pendingComments.length > 0) {
                let isAdjacent = true;
                for (let k = pendingComments.length - 1; k >= 0; k--) {
                    if (pendingComments[k].trim() !== '' && !pendingComments[k].trim().startsWith('#')) {
                        isAdjacent = false;
                        break;
                    }
                }
                if (isAdjacent) comment = pendingComments.join('\n');
            }
            pendingComments = [];
            i++;
            while (i < lines.length && !lines[i].includes('}')) {
                let subLine = lines[i].trim();
                if (!subLine) { i++; continue; }
                if (subLine.startsWith('#')) { comment += (comment ? '\n' : '') + subLine; i++; continue; }
                // request/response 块
                if (/^(request|response)\s*\{/.test(subLine)) {
                    const blockType = subLine.startsWith('request') ? 'request' : 'response';
                    let blockFields = [];
                    i++;
                    while (i < lines.length && !lines[i].includes('}')) {
                        let fieldLine = lines[i].trim();
                        if (!fieldLine) { i++; continue; }
                        if (fieldLine.startsWith('#')) { i++; continue; }
                        // 支持 *item, *item(item_id), item, item(item_id) 类型，避免 * 和类型名之间有空格
                        const fieldMatch = fieldLine.match(/^([\w_]+)\s+(\d+)\s*:\s*(\*?[\w_]+(?:\([^)]*\))?)(.*)$/);
                        if (fieldMatch) {
                            let typeStr = fieldMatch[3];
                            let isArray = false;
                            let type = typeStr;
                            if (typeStr.startsWith('*')) {
                                isArray = true;
                                type = typeStr.slice(1);
                            }
                            blockFields.push({
                                name: fieldMatch[1],
                                id: Number(fieldMatch[2]),
                                isArray,
                                type,
                                comment: fieldMatch[4] ? fieldMatch[4].trim() : ''
                            });
                        }
                        i++;
                    }
                    if (blockType === 'request') request = blockFields;
                    else response = blockFields;
                }
                i++;
            }
            ast.protocols.push({ name: protoName, id: protoId, request, response, comment: comment.trim() });
            i++;
            continue;
        }
        i++;
    }
    return ast;
}

function formatSprotoAST(ast) {
    const indent = '    ';
    let out = [];
    // 对齐辅助函数
    function formatFields(fields, indentLevel) {
        if (!fields || fields.length === 0) return [];
        let maxName = 0, maxId = 0, maxType = 0;
        fields.forEach(f => {
            if (f.name.length > maxName) maxName = f.name.length;
            if (String(f.id).length > maxId) maxId = String(f.id).length;
            let typeStr = (f.isArray ? '*' : '') + f.type;
            if (typeStr.length > maxType) maxType = typeStr.length;
        });
        let lines = [];
        fields.forEach(f => {
            let namePad = ' '.repeat(maxName - f.name.length);
            let idPad = ' '.repeat(maxId - String(f.id).length);
            let typeStr = (f.isArray ? '*' : '') + f.type;
            let typePad = ' '.repeat(maxType - typeStr.length);
            let line =
                indent.repeat(indentLevel) +
                f.name + namePad + ' ' +
                f.id + idPad + ' : ' +
                typeStr + typePad;
            if (f.comment) {
                line += '  ' + f.comment;
            }
            lines.push(line);
        });
        return lines;
    }

    // 输出HeaderComments
    if (ast.headerComments.length > 0) {
        for (const c of ast.headerComments) {
            out.push(c.trim());
        }
        out.push('');
    }

    // 类型定义
    for (const type of ast.types) {
        if (type.comment) out.push(type.comment.split('\n').map(c => c.trim()).join('\n'));
        out.push(`.${type.name} {`);
        out.push(...formatFields(type.fields, 1));
        out.push('}');
        out.push('');
    }
    // 协议定义
    for (const proto of ast.protocols) {
        // 协议注释紧跟协议定义
        if (proto.comment) {
            out.push(proto.comment.split('\n').map(c => c.trim()).join('\n'));
        }
        out.push(`${proto.name} ${proto.id} {`);
        if (proto.request) {
            out.push(indent + 'request {');
            out.push(...formatFields(proto.request, 2));
            out.push(indent + '}');
        }
        if (proto.response) {
            out.push(indent + 'response {');
            out.push(...formatFields(proto.response, 2));
            out.push(indent + '}');
        }
        out.push('}');
        out.push('');
    }
    return out.join('\n').replace(/\n{2,}/g, '\n\n').trim();
}

// 兼容原有格式化入口
function formatSproto(text) {
    const ast = parseSproto(text);
    return formatSprotoAST(ast);
}

module.exports = { formatSproto, parseSproto, formatSprotoAST };
