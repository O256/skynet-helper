// 解析所有类型定义，返回 { 类型名: 定义位置 }
function parseSprotoTypes(document) {
    const typeRegex = /^#\s*(\S+)\s*\n(\.\w+)\s*\{/gm;
    const types = {};
    const text = document.getText();
    let match;
    while ((match = typeRegex.exec(text)) !== null) {
        const typeName = match[2]; // 如 .passive_data
        const position = document.positionAt(match.index + match[0].indexOf(typeName));
        types[typeName] = position;
    }
    return types;
}

export { parseSprotoTypes };