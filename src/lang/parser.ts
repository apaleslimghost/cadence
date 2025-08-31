// from https://github.com/fwg/s-expression/blob/master/index.js

export type Atom = string | String | SExpr
export type SExpr = Atom[]

class ParseError extends Error {
    constructor(message: string, public line: number, public col: number) {
        super(message)
    }
}

class Parser {
    static not_whitespace_or_end = /^(\S|$)/;
    static space_quote_paren_escaped_or_end = /^(\s|\\|"|'|`|,|\(|\)|$)/;
    static string_or_escaped_or_end = /^(\\|"|$)/;
    static string_delimiters = /["]/;
    static quotes = /['`,]/;
    static quotes_map: Record<string, string> = {
        '\'': 'quote',
        '`':  'quasiquote',
        ',':  'unquote'
    };

    private _line: number;
    private _col: number;
    private _pos: number;

    constructor(private _stream: string) {
        this._line = this._col = this._pos = 0;
    }

    error(msg: string) {
        return new ParseError('Syntax error: ' + msg, this._line + 1, this._col + 1);
    }

    peek() {
        if (this._stream.length == this._pos) return '';
        return this._stream[this._pos];
    }

    consume() {
        if (this._stream.length == this._pos) return '';

        let c = this._stream[this._pos];
        this._pos += 1;

        if (c == '\r') {
            if (this.peek() == '\n') {
                this._pos += 1;
                c += '\n';
            }
            this._line++;
            this._col = 0;
        } else if (c == '\n') {
            this._line++;
            this._col = 0;
        } else {
            this._col++;
        }

        return c;
    }

    until(regex: RegExp) {
        let s = '';

        while (!regex.test(this.peek())) {
            s += this.consume();
        }

        return s;
    }

    string() {
        // consume "
        let delimiter = this.consume();

        let str = '';

        while (true) {
            str += this.until(Parser.string_or_escaped_or_end);
            let next = this.peek();

            if (next == '') {
                return this.error('Unterminated string literal');
            }

            if (next == delimiter) {
                this.consume();
                break;
            }

            if (next == '\\') {
                this.consume();
                next = this.peek();

                if (next == 'r') {
                    this.consume();
                    str += '\r';
                } else if (next == 't') {
                    this.consume();
                    str += '\t';
                } else if (next == 'n') {
                    this.consume();
                    str += '\n';
                } else if (next == 'f') {
                    this.consume();
                    str += '\f';
                } else if (next == 'b') {
                    this.consume();
                    str += '\b';
                } else {
                    str += this.consume();
                }

                continue;
            }

            str += this.consume();
        }

        // wrap in object to make strings distinct from symbols
        return new String(str);
    }

    atom() {
        if (Parser.string_delimiters.test(this.peek())) {
            return this.string();
        }

        let atom = '';

        while (true) {
            atom += this.until(Parser.space_quote_paren_escaped_or_end);
            let next = this.peek();

            if (next == '\\') {
                this.consume();
                atom += this.consume();
                continue;
            }

            break;
        }

        return atom;
    }

    quoted(): Atom | ParseError {
        let q = this.consume();
        let quote = Parser.quotes_map[q];

        if (quote == "unquote" && this.peek() == "@") {
            this.consume();
            quote = "unquote-splicing";
            q = ',@';
        }

        // ignore whitespace
        this.until(Parser.not_whitespace_or_end);
        let quotedExpr = this.expr();

        if (quotedExpr instanceof ParseError) {
            return quotedExpr;
        }

        // nothing came after '
        if (quotedExpr === '') {
            return this.error('Unexpected `' + this.peek() + '` after `' + q + '`');
        }

        return [quote, quotedExpr];
    }

    expr(): Atom | ParseError {
        // ignore whitespace
        this.until(Parser.not_whitespace_or_end);

        if (Parser.quotes.test(this.peek())) {
            return this.quoted();
        }

        let expr = this.peek() == '(' ? this.list() : this.atom();

        // ignore whitespace
        this.until(Parser.not_whitespace_or_end);

        return expr;
    }

    list() {
        if (this.peek() != '(') {
            return this.error('Expected `(` - saw `' + this.peek() + '` instead.');
        }

        this.consume();

        let ls = [];
        let v = this.expr();

        if (v instanceof Error) {
            return v;
        }

        if (v !== '') {
            ls.push(v);

            while ((v = this.expr()) !== '') {
                if (v instanceof Error) return v;
                ls.push(v);
            }
        }

        if (this.peek() != ')') {
            return this.error('Expected `)` - saw: `' + this.peek() + '`');
        }

        // consume that closing paren
        this.consume();

        return ls;
    }
}


export default function SParse(stream: string) {
    let parser = new Parser(stream);
    let expression = parser.expr();

    if (expression instanceof Error) {
        return expression;
    }

    // if anything is left to parse, it's a syntax error
    if (parser.peek() != '') {
        return parser.error('Superfluous characters after expression: `' + parser.peek() + '`');
    }

    return expression;
};
