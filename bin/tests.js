const { SBSMLParser, ProcessNode, StepNode } = require('../lib/parser');
const assert = require('assert/strict');

function testParseLine() {
    // Test Process Line
    r = SBSMLParser.parseLine("--- Test Process Line ---");
    assert.equal(r, ProcessNode);

    r = SBSMLParser.parseLine("1. Test Step Line");
    assert.equal(r, StepNode);
}

testParseLine();