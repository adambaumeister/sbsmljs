const RE_PROCESS_NODE = /---\s+(.*)\s+---/
const RE_TITLE_NODE = /^-\s+(.*)\s+-$/
const RE_STEP_NODE = /(?<index>\d+)(?<subindex>\S+)?\.\s*(?<nodename>.*)\s*/
const RE_SUBSTEP_NODE = /\d+\S+\./
const RE_NEXT_NODE = /then:\s*(?<nextNodeName>.*)\s*/
const RE_CONDITIONAL_NODE = /IF:\s*(?<condition>.*)\s*THEN:\s*(?<nextProcessName>.*)/
const RE_EMPTY_LINE = /^$/
const SPLIT_CHAR_INPUT = ">"
const SPLIT_CHAR_OUTPUT = ">>"
const SPLIT_CHAR = ","
const SPLIT_KWARG_CHAR = ":"
const { ParserError } = require("./errors")

class Input {
    constructor(text, name) {
        this.text = text;
        this.name = name;
    }

    jsonify() {
        return {
            "name": this.name,
            "text": this.text
        }
    }
}

class Output {
    constructor(text, name) {
        this.text = text;
        this.name = name;
    }

    jsonify() {
        return {
            "name": this.name,
            "text": this.text
        }
    }
}
class Node {
    constructor() {
        this.nextNode = null;
        this.nextConditional = null;
        this.previousNode = null;
        this.inputs = [];
        this.outputs = [];
        this.line = null;
    }
    setNextNode(node) {
        this.nextNode = node;
    }
    setPreviousNode(node) {
        this.previousNode = node;
    }
    setNextConditional(conditional) {
        this.nextConditional = conditional;
    }
    addInput(inputNode) {
        this.inputs.push(inputNode);
    }
    setInputs(inputs) {
        this.inputs = inputs;
    }
    setOutputs(outputs) {
        this.outputs = outputs;
    }
    setLineNumber(lineNumber) {
        this.line = lineNumber;
    }
}

class TitleNode extends Node {
    constructor(text) {
        super();
        this.text = text;
    }
}

class ProcessNode extends Node {
    constructor(nodeName) {
        super();
        this.nodeName = nodeName;
        this.stepNodes = [];
        this.nextProcessNodes = [];
    }

    addStepNode(stepNode) {
        this.stepNodes.push(stepNode);
    }
    addNextProcessNode(thenNode) {
        this.nextProcessNodes.push(thenNode);
    }

    jsonify() {
        let stepNodes = [];
        this.stepNodes.forEach(stepNode => {
            stepNodes.push(stepNode.jsonify());
        })
        return {
            "name": this.nodeName,
            "stepnodes": stepNodes
        }
    }
}

class SubStepNode extends Node {
    constructor(nodeName) {
        super();
    }
}

class StepNode extends Node {
    constructor(nodeName) {
        super();
        this.nodeName = nodeName;
        this.subSteps = [];
        this.descriptionNode == null;
    }

    addSubStep(stepNode) {
        this.subSteps.push(stepNode);
    }
    updateNodeName(name) {
        this.nodeName = name;
    }
    setDescriptionNode(descriptionNode) {
        this.descriptionNode = descriptionNode;
    }

    jsonify() {
        let substepNames = [];
        this.subSteps.forEach(element => {
            substepNames.push(element.nodeName);
        })
        let inputs = [];
        this.inputs.forEach(input => {
            inputs.push(input.jsonify());
        })
        let outputs = [];
        this.outputs.forEach(output => {
            outputs.push(output.jsonify());
        })
        let descriptionText = null;
        if (this.descriptionNode !== undefined) {
            descriptionText = this.descriptionNode.text;
        }
        return {
            "name": this.nodeName,
            "substeps": substepNames,
            "description": descriptionText,
            "inputs": inputs,
            "outputs": outputs
        };
    }
}

class DescriptionNode extends Node {
    constructor() {
        super();
        this.text = null;
    }
    addText(text) {
        if (this.text === null) {
            this.text = text;
        } else {
            this.text = this.text + text;
        }
    }
}

class ThenNode extends Node {
    constructor(nextNodeName) {
        super();
        this.nextNodeName = nextNodeName;
        this.nextNode = null;
    }
}

class Conditional {
    constructor() {
        this.conditions = {};
        this.nextNode = null;
    }
    addCondition(conditionNode) {
        this.conditions[conditionNode.condition] = conditionNode;
    }
    newConditionNode(condition, nextProcessString) {
        let conditionNode = new ConditionNode(condition, nextProcessString);
        this.addCondition(conditionNode);
        return conditionNode;
    }
    getNextNode(conditions) {
        conditions.forEach(condition => {
            if (condition in this.conditions) {
                return this.conditions[condition].nextNode;
            }
        })
        // If no conditions match
        return this.nextNode;
    }
}

class ConditionNode extends Node {
    constructor(condition, nextProcessString) {
        super();
        this.condition = condition;
        this.nextProcessString = nextProcessString;
        this.nextProcessNode = null;
    }
}

class SBSMLParser {
    constructor(sbsString) {
        this.sbsString = sbsString;

        this.processNodes = [];
        this.currentNode = [];
        this.currentProcessNode = null;
        this.currentDescriptionNode = null;
        this.currentConditional = null;

        this.conditionNodes = [];
        this.title = new TitleNode(null);
    }

    static parse(parseString) {
        // Given a string in SBSML format, parse it into objects
        let p = new SBSMLParser(parseString);
        let lines = p.splitToLines();
        p.parseLines(lines);
        p.linkNextNodes();
        return p;
    }

    getProcessTree(processName) {
        // Get a list of nodes rooted at "processName"
        let processNode = this.getNamedProcess(processName);
        let nodeList = [];
        this.getNextNodeRecursive(processNode, nodeList);
        return nodeList;
    }

    getNextNodeRecursive(node, nodeList) {
        // Get the next node
        nodeList.push(node);
        // If the passed node is a conditional, do a lookup for the next node based on the conditions
        if (node instanceof Conditional) {
            let nextNode = node.getNextNode([])
            if (nextNode === null) {
                throw new ParserError("Could not resolve Conditional node.", null)
            }
            this.getNextNodeRecursive(node.getNextNode([]), nodeList);
            return;
        }
        // If the node has a conditional, use that instead
        if (node.nextConditional !== null) {
            this.getNextNodeRecursive(node.nextConditional, nodeList);
            return;
        }
        // If it's a normal node, just get the next node
        if (node.nextNode !== null) {
            this.getNextNodeRecursive(node.nextNode, nodeList);
        }
    }

    linkNextNodes() {
        // For nodes that reference other nodes by name, build the references
        this.processNodes.forEach( processNode => {
            processNode.nextProcessNodes.forEach( thenNode => {
                if (thenNode.nextNode == null) {
                    try {
                        let nextProcessNode = this.getNamedProcess(thenNode.nextNodeName);
                        thenNode.setNextNode(nextProcessNode);
                    }
                    catch(err) {
                        throw new ParserError(err.message, thenNode.line)
                    }

                }
            })
        })

        this.conditionNodes.forEach( conditionNode => {
            if (conditionNode.nextProcessString !== null) {
                try {
                    conditionNode.nextProcessNode = this.getNamedProcess(conditionNode.nextProcessString);
                }
                catch(err) {
                    throw new ParserError(err.message, conditionNode.line)
                }

            }
        })
    }

    getNamedProcess(processName) {
        let node = null;
        this.processNodes.forEach(processNode => {
            if (processNode.nodeName === processName) {
                node = processNode;
            }
        })
        if (node !== null) {
            return node;
        } else {
            throw new ParserError(`ProcessNode ${processName} not found.`);
        }
    }

    splitToLines() {
        return this.sbsString.split(/\r?\n/);
    }

    static parseLine(line) {
        // Parse a single line and just return the type that results based on the regex logic
        switch(true) {
            case RE_PROCESS_NODE.test(line):
                return ProcessNode;
            case RE_SUBSTEP_NODE.test(line):
                return SubStepNode;
            case RE_STEP_NODE.test(line):
                return StepNode;
            case RE_EMPTY_LINE.test(line):
                return "";
            default:
                return DescriptionNode;
        }
    }

    parseLines(lines) {
        lines.forEach((element, index) => {
            let n;
            switch(true) {
                case RE_PROCESS_NODE.test(element):
                    n = this.parseProcessNodeLine(element);
                    n.setLineNumber(index);
                    break;
                case RE_STEP_NODE.test(element):
                    n = this.parseStepNodeLine(element);
                    n.setLineNumber(index);
                    break;
                case RE_CONDITIONAL_NODE.test(element):
                    n = this.parseConditionalLine(element);
                    n.setLineNumber(index);
                    break;
                case RE_NEXT_NODE.test(element):
                    n = this.parseNextNodeLine(element);
                    n.setLineNumber(index);
                    break;
                case RE_TITLE_NODE.test(element):
                    n = this.parseTitleLine(element);
                    n.setLineNumber(index);
                    break;
                default:
                    this.parseDescriptionLine(element);
                    break;
            }
        });
    }

    parseProcessNodeLine(line) {
        console.log("ProcessingProcessNode " + line);
        let matched = line.match(RE_PROCESS_NODE);
        if (matched.length < 2) {
            throw "Failed to parse ProcessNode";
        }
        let nodeName = matched[1];
        let processNode = new ProcessNode(nodeName);
        this.addProcessNode(processNode);
        this.currentNode = processNode;
        this.currentProcessNode = processNode;

        // Rest any nessecary other objects
        this.currentConditional = null;
        return processNode;
    }

    parseStepNodeLine(line) {
        console.log(`ProcessingStepNode ${line}`);
        let match = line.match(RE_STEP_NODE);
        let index = match.groups["index"];
        let subindex = match.groups["subindex"];

        if (index === undefined) {
            throw "Invalid StepNode";
        }
        let nodeName = match.groups["nodename"];

        let inputSplitResult = this.parseInputs(nodeName);
        let stepNode = new StepNode(nodeName);

        if (inputSplitResult !== null) {
            stepNode.setInputs(inputSplitResult["inputs"]);
            stepNode.updateNodeName(inputSplitResult["nodeName"]);

        }

        let outputSplitResult = this.parseOutputs(nodeName);
        if (outputSplitResult !== null) {
            stepNode.setOutputs(outputSplitResult["outputs"]);
            nodeName = outputSplitResult["nodeName"];
        }

        stepNode.setPreviousNode(this.currentNode);
        if (subindex !== undefined ) {
            console.log(`ProcessingStepNodeSubIndex ${subindex}` )
            this.currentNode.addSubStep(stepNode);
        }

        this.currentNode.setNextNode(stepNode);
        this.currentNode = stepNode;
        this.currentProcessNode.addStepNode(stepNode);

        let descriptionNode = new DescriptionNode();
        stepNode.setDescriptionNode(descriptionNode);
        this.currentDescriptionNode = descriptionNode;

        return stepNode;
    }

    parseInputs(line) {
        let inputSplit = line.split(SPLIT_CHAR_INPUT);
        let inputs = [];
        if (inputSplit.length > 1) {
            console.log(`ProcessingStepInput ${inputSplit[0]}`)
            let inputNames = inputSplit[0];
            inputNames.split(SPLIT_CHAR).forEach(element => {
                let input = this.parseArgumentText(element, Input);
                inputs.push(input);
            })
            return {"inputs": inputs, nodeName: inputSplit[1]};
        }
        return null;
    }

    parseArgumentText(text, objectClass) {
        // parse a single input into an Input object
        let split = text.split(SPLIT_KWARG_CHAR);
        var name, value;
        if (split.length > 1) {
            name = split[0];
            value = split[1];
            return new objectClass(value, name);
        }
        value = split[0];

        return new objectClass(value, null);
    }

    parseOutputs(line) {
        let outputSplit = line.split(SPLIT_CHAR_OUTPUT);
        let outputs = [];
        if (outputSplit.length > 1) {
            console.log(`ProcessingStepOutputs ${outputSplit[1]}`)
            let outputNames = outputSplit[1];
            outputNames.split(SPLIT_CHAR).forEach(element => {
                let output = this.parseArgumentText(element, Output);
                outputs.push(output);
            })
            return {"outputs": outputs, nodeName: outputSplit[1]};
        }
        return null;
    }

    parseDescriptionLine(line) {
        /*
        Parse description lines; 
        1. this is the step line
        everything below it is the description!
        */
        console.log(`ProcessingDescriptionLine ${line}`);
        // Ignore the case where text is seen prior to any node
        if(this.currentDescriptionNode === null || this.currentDescriptionNode === undefined ) {
            return;
        }
        // Ignore nodes that can't accept a description
        if(this.currentNode.descriptionNode === undefined) {
            return;
        }
        this.currentNode.descriptionNode.addText(line);
    }

    parseNextNodeLine(line) {
        // Parse the "then:" statements, but don't create links here
        console.log(`ProcessingNextNodeLine ${line}`);
        let match = line.match(RE_NEXT_NODE);
        let nextNodeName = match.groups["nextNodeName"];
        let thenNode = new ThenNode(nextNodeName);
        if (this.currentConditional !== null) {
            // If there's a conditional, use this as the default case
            this.currentConditional.nextNode = thenNode;
        }
        this.currentNode.setNextNode(thenNode);
        this.currentNode = thenNode;
        this.currentProcessNode.addNextProcessNode(thenNode);
        return thenNode;
    }

    parseConditionalLine(line) {
        //parse IF: blah THEN: whatever statements - don't yet create links
        console.log(`ProcessingConditionalNodeLine ${line}`);
        let match = line.match(RE_CONDITIONAL_NODE);
        let condition = match.groups["condition"];
        let nextProcessName = match.groups["nextProcessName"];
        let c = new Conditional();
        if (this.currentConditional !== null) {
            c = this.currentConditional;
        }
        let conditionNode = c.newConditionNode(condition, nextProcessName);
        this.currentConditional = c;
        this.currentNode.setNextConditional(c);
        this.conditionNodes.push(conditionNode);
        return conditionNode;
    }

    parseTitleLine(line) {
        console.log(`Processing Title Line $${line}`);
        let matched = line.match(RE_TITLE_NODE);
        if (matched.length < 2) {
            throw "Failed to parse TitleNode";
        }
        this.title = new TitleNode(matched[1]);
        return this.title;
    }

    addProcessNode(processNode) {
        this.processNodes.push(processNode);
    }

    asJSON() {
        let processNodes = [];
        this.processNodes.forEach(processNode => {
            processNodes.push(processNode.jsonify());
        })
        return JSON.stringify({
            "title": this.title.text,
            "processNodes": processNodes
        }, null, 4);
    }
}

exports.SBSMLParser = SBSMLParser;
exports.ProcessNode = ProcessNode;
exports.StepNode = StepNode;
exports.SubStepNode = SubStepNode;
exports.DescriptionNode = DescriptionNode;
exports.Input = Input;
exports.Output = Output;
