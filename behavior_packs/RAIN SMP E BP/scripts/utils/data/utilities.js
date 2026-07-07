function getEnchantName(id) {
    return id
        .replace(/.*(?<=:)/, '')
        .replace(/_/g, ' ')
        .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
}
function isRawMessage(obj) {
    return obj != null && Array.isArray(obj.rawtext);
}
function toRoman(level) {
    if (level <= 0)
        return '';
    const map = [
        [10, 'X'],
        [9, 'IX'],
        [5, 'V'],
        [4, 'IV'],
        [1, 'I'],
    ];
    let result = '';
    for (const [value, symbol] of map) {
        while (level >= value) {
            result += symbol;
            level -= value;
        }
    }
    return result;
}
export { getEnchantName, isRawMessage, toRoman };