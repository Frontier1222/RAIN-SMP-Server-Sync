const romanNumerals = {
    1: 'I',
    4: 'IV',
    5: 'V',
    9: 'IX',
    10: 'X',
    40: 'XL',
    50: 'L',
    90: 'XC',
    100: 'C',
    400: 'CD',
    500: 'D',
    900: 'CM',
    1000: 'M'
};
/**
 * Converts a number to a roman numeral
 *
 * @param num The number to convert to a roman numeral
 */
function numberToRomanNumaral(num) {
    let result = '';
    // Loop through each numeral, from largest to smallest
    const values = Object.keys(romanNumerals).map(Number).sort((a, b) => b - a);
    for (let value of values) {
        while (num >= value) {
            result += romanNumerals[value];
            num -= value;
        }
    }
    return result;
}

export { numberToRomanNumaral };
