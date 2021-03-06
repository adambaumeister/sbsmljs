const {SubStepNode, SBSMLParser, ProcessNode, StepNode, DescriptionNode, Input, Output} = require('../lib/parser');
const assert = require('assert/strict');
const {Playbook} = require('../lib/playbook')

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

function testParseInput() {
    let testLineWithInput = "input1";
    let p = new SBSMLParser(testLineWithInput);
    let inputNode = p.parseArgumentText(testLineWithInput, Input);
    assert.equal(inputNode.text, "input1");

    let testLineWithInputName = "input1:value1";
    inputNode = p.parseArgumentText(testLineWithInputName, Output);
    assert.equal(inputNode.text, "value1");
    assert.equal(inputNode.name, "input1");
}

function testPlaybook() {
    let testString = `--- Test Process ---
    1. Test step
    IF: something THEN: something else
    then: default process
    
    --- default process ---
    1. default step
    
    --- something else ---
    1. some step
    `
    let parser = SBSMLParser.parse(testString);
    let playbook = Playbook.render(parser);
    assert.equal(playbook.r["tasks"]["2"]["task"]["name"], "Test step" );
    assert.equal(playbook.r["tasks"]["4"]["task"]["name"], "something else" );
    console.log(playbook.toYaml())
}

function testConditional() {
    let testString = `--- Test Process ---
    1. Test step
    IF: something THEN: something else
    then: default process
    
    --- something else ---
    1. Some other step
    
    --- default process ---
    1. Default step
    `
    let parser = SBSMLParser.parse(testString);
    let list = parser.getProcessTree("Test Process")
}
testConditional();
testParseLine();
testParseInput();
testPlaybook();
