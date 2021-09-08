
function ParserError(message, lineNumber) {
    this.message = message;
    this.line = lineNumber;
}

module.exports.ParserError = ParserError;