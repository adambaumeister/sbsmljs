const { SubStepNode, SBSMLParser, ProcessNode, StepNode, DescriptionNode } = require('../lib/parser');
const assert = require('assert/strict');
const {ParserError} = require('../lib/errors')

function testParseLine() {
    // Test Process Line
    var r = SBSMLParser.parseLine("--- Test Process Line ---");
    assert.equal(r, ProcessNode);

    r = SBSMLParser.parseLine("1. Test Step Line");
    assert.equal(r, StepNode);

    r = SBSMLParser.parseLine("1a. Test SubStep Line");
    assert.equal(r, SubStepNode);

    r = SBSMLParser.parseLine("Test description line");
    assert.equal(r, DescriptionNode);

    // Empty line
    r = SBSMLParser.parseLine("");
    assert.equal(r, "");

}

function testErrors() {
    throw new ParserError(`ProcessNode awdwnot found.`);
}

testErrors();
testParseLine();