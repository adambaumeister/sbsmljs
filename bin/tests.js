const { SBSMLParser, ProcessNode, StepNode } = require('../lib/parser');
const assert = require('assert/strict');

function testParseLine() {
    // Test Process Line
    r = SBSMLParser.parseLine("--- Test Process Line ---");
    assert.equal(r, ProcessNode);
}

testParseLine();