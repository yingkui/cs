// @flow
/**
 * The Lexer class handles tokenizing the input in various ways. Since our
 * parser expects us to be able to backtrack, the lexer allows lexing from any
 * given starting point.
 *
 * Its main exposed function is the `lex` function, which takes a position to
 * lex from and a type of token to lex. It defers to the appropriate `_innerLex`
 * function.
 *
 * The various `_innerLex` functions perform the actual lexing of different
 * kinds.
 */

const SourceLocation = require("./SourceLocation");
const Token = require("./Token");

/* The following tokenRegex
 * - matches typical whitespace (but not NBSP etc.) using its first group
 * - does not match any control character \x00-\x1f except whitespace
 * - does not match a bare backslash
 * - matches any ASCII character except those just mentioned
 * - does not match the BMP private use area \uE000-\uF8FF
 * - does not match bare surrogate code units
 * - matches any BMP character except for those just described
 * - matches any valid Unicode surrogate pair
 * - matches a backslash followed by one or more letters
 * - matches a backslash followed by any BMP character, including newline
 * Just because the Lexer matches something doesn't mean it's valid input:
 * If there is no matching function or symbol definition, the Parser will
 * still reject the input.
 */
const spaceRegexString = "[ \r\n\t]";
const controlWordRegexString = "\\\\[a-zA-Z@]+";
const controlSymbolRegexString = "\\\\[^\uD800-\uDFFF]";
const controlWordWhitespaceRegexString =
    `${controlWordRegexString}${spaceRegexString}*`;
const controlWordWhitespaceRegex = new RegExp(
    `^(${controlWordRegexString})${spaceRegexString}*$`);
const combiningDiacriticalMarkString = "[\u0300-\u036f]";
const combiningDiacriticalMarksEndRegex =
    new RegExp(`${combiningDiacriticalMarkString}+$`);
const tokenRegexString = `(${spaceRegexString}+)|` +  // whitespace
    "([!-\\[\\]-\u2027\u202A-\uD7FF\uF900-\uFFFF]" +  // single codepoint
    `${combiningDiacriticalMarkString}*` +            // ...plus accents
    "|[\uD800-\uDBFF][\uDC00-\uDFFF]" +               // surrogate pair
    `${combiningDiacriticalMarkString}*` +            // ...plus accents
    "|\\\\verb\\*([^]).*?\\3" +                       // \verb*
    "|\\\\verb([^*a-zA-Z]).*?\\4" +                   // \verb unstarred
    `|${controlWordWhitespaceRegexString}` +          // \macroName + spaces
    `|${controlSymbolRegexString})`;                  // \\, \', etc.

/** Main Lexer class */
class Lexer {

    constructor(input, settings) {
        // Separate accents from characters
        this.input = input;
        this.settings = settings;
        this.tokenRegex = new RegExp(tokenRegexString, 'g');
        this.catcodes = {
            "%": 14, // comment character
        };
    }

    // ad hoc solution for category code
    setCatcode(char, code) {
        this.catcodes[char] = code;
    }

    lex() {
        const input = this.input;
        const pos = this.tokenRegex.lastIndex;
        if (pos === input.length) {
            return new Token("EOF", new SourceLocation(this, pos, pos));
        }
        const match = this.tokenRegex.exec(input);
        let text = match[2] || " ";

        if (this.catcodes[text] === 14) { // comment character
            const nlIndex = input.indexOf('\n', this.tokenRegex.lastIndex);
            if (nlIndex === -1) {
                this.tokenRegex.lastIndex = input.length; // EOF
            } else {
                this.tokenRegex.lastIndex = nlIndex + 1;
            }
            return this.lex();
        }

        // Trim any trailing whitespace from control word match
        const controlMatch = text.match(controlWordWhitespaceRegex);
        if (controlMatch) {
            text = controlMatch[1];
        }

        return new Token(text, new SourceLocation(this, pos,
            this.tokenRegex.lastIndex));
    }
}

module.exports = {Lexer, combiningDiacriticalMarksEndRegex}
