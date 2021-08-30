const RE_PROCESS_NODE = /---\s+(.*)\s+---/
const RE_STEP_NODE = /(?<index>\d+)(?<subindex>\S+)?\.\s*(?<nodename>.*)\s*/
const RE_NEXT_NODE = /then:\s*(?<nextNodeName>.*)\s*/
const SPLIT_CHAR_INPUT = ">"
const SPLIT_CHAR_OUTPUT = ">>"
const SPLIT_CHAR = "," 

class Input {
    constructor(text) {
        this.text = text;
    }
}

class Output {
    constructor(text) {
        this.text = text;
    }
}

class Node {
    constructor() {
        this.nextNode = null;
        this.previousNode = null;
        this.inputs = [];
        this.outputs = [];
    }
    setNextNode(node) {
        this.nextNode = node;
    }
    setPreviousNode(node) {
        this.previousNode = node;
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
        var substepNames = [];
        this.subSteps.forEach(element => {
            substepNames.push(element.nodeName);
        })
        var descriptionText = null;
        if (this.descriptionNode !== undefined) {
            descriptionText = this.descriptionNode.text;
        }
        return {
            "name": this.nodeName,
            "substeps": substepNames,
            "description": descriptionText
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

class SBSMLParser {
    constructor(sbsString) {
        this.sbsString = sbsString;

        this.processNodes = [];
        this.currentNode = [];
        this.currentProcessNode = null;
        this.currentDescriptionNode = null;
    }

    static parse(parseString) {
        // Given a string in SBSML format, parse it into objects
        var p = new SBSMLParser(parseString);
        var lines = p.splitToLines();
        p.parseLines(lines);
        p.linkNextNodes();
        return p;
    }

    getProcessTree(processName) {
        // Get a list of nodes rooted at "processName"
        var processNode = this.getNamedProcess(processName);
        var nodeList = [];
        this.getNextNodeRecursive(processNode, nodeList);
        return nodeList;
    }

    getNextNodeRecursive(node, nodeList) {
        nodeList.push(node);
        if (node.nextNode !== null) {
            this.getNextNodeRecursive(node.nextNode, nodeList);
        }
    }

    linkNextNodes() {
        // For nodes that reference other nodes by name, build the references
        this.processNodes.forEach( processNode => {
            processNode.nextProcessNodes.forEach( thenNode => {
                if (thenNode.nextNode == null) {
                    var nextProcessNode = this.getNamedProcess(thenNode.nextNodeName);
                    thenNode.setNextNode(nextProcessNode);
                }
            })
        })
    }

    getNamedProcess(processName) {
        var node = null;
        this.processNodes.forEach(processNode => {
            if (processNode.nodeName == processName) {
                node = processNode;
            }
        })
        if (node !== null) {
            return node;
        } else {
            throw `ProcessNode ${processName} not found.`
        }
    }

    splitToLines() {
        var s = this.sbsString.split(/\r?\n/);
        return s;
    }

    static parseLine(line) {
        // Parse a single line and just return the type that results based on the regex logic
        switch(true) {
            case RE_PROCESS_NODE.test(line): 
                return ProcessNode;
            case RE_STEP_NODE.test(line): 
                return StepNode;
            default:
                return DescriptionNode;
        }       
    }

    parseLines(lines) {
        lines.forEach(element => {
            switch(true) {
                case RE_PROCESS_NODE.test(element): 
                    this.parseProcessNodeLine(element);
                    break;
                case RE_STEP_NODE.test(element): 
                    this.parseStepNodeLine(element);
                    break;
                case RE_NEXT_NODE.test(element): 
                    this.parseNextNodeLine(element);
                    break;
                default:
                    this.parseDescriptionLine(element);
                    break;
            }
        });
    }

    parseProcessNodeLine(line) {
        console.log("ProcessingProcessNode " + line);
        var matched = line.match(RE_PROCESS_NODE);
        if (matched.length < 2) {
            throw "Failed to parse ProcessNode";
        }
        var nodeName = matched[1];
        var processNode = new ProcessNode(nodeName);
        this.addProcessNode(processNode);
        this.currentNode = processNode;
        this.currentProcessNode = processNode;
        return processNode;
    }

    parseStepNodeLine(line) {
        console.log(`ProcessingStepNode ${line}`);
        var match = line.match(RE_STEP_NODE);
        var index = match.groups["index"];
        var subindex = match.groups["subindex"];

        if (index === undefined) {
            throw "Invalid StepNode";
        }
        var nodeName = match.groups["nodename"];

        var inputSplitResult = this.parseInputs(nodeName);
        var stepNode = new StepNode(nodeName);

        if (inputSplitResult !== null) { 
            stepNode.setInputs = inputSplitResult["inputs"];
            stepNode.updateNodeName(inputSplitResult["nodeName"]);

        }

        var outputSplitResult = this.parseOutputs(nodeName);
        if (outputSplitResult !== null) { 
            stepNode.setInputs = outputSplitResult["outputs"];
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

        var descriptionNode = new DescriptionNode();
        stepNode.setDescriptionNode(descriptionNode);
        this.currentDescriptionNode = descriptionNode;

        return stepNode;
    }

    parseInputs(line) {
        var inputSplit = line.split(SPLIT_CHAR_INPUT);
        var inputs = [];
        if (inputSplit.length > 1) {
            console.log(`ProcessingStepInput ${inputSplit[0]}`)
            var inputNames = inputSplit[0];
            inputNames.split(SPLIT_CHAR).forEach(element => {
                var input = new Input(element);
                inputs.push(input);
            })
            return {"inputs": inputs, nodeName: inputSplit[1]};
        }
        return null;
    }

    parseOutputs(line) {
        var outputSplit = line.split(SPLIT_CHAR_OUTPUT);
        var outputs = [];
        if (outputSplit.length > 1) {
            console.log(`ProcessingStepOutputs ${outputSplit[1]}`)
            var inputNames = outputSplit[0];
            inputNames.split(SPLIT_CHAR).forEach(element => {
                var input = new Output(element);
                outputs.push(input);
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
        var match = line.match(RE_NEXT_NODE);
        var nextNodeName = match.groups["nextNodeName"];
        var thenNode = new ThenNode(nextNodeName);
        this.currentNode.setNextNode(thenNode);
        this.currentNode = thenNode;
        this.currentProcessNode.addNextProcessNode(thenNode);
    }

    addProcessNode(processNode) {
        this.processNodes.push(processNode);
    }

    asJSON() {
        this.processNodes.forEach(processNode => {
            processNode.stepNodes.forEach(stepNode => {
                console.log(stepNode.jsonify());
            })
        })
    }
}

exports.SBSMLParser = SBSMLParser;
exports.ProcessNode = ProcessNode;
exports.StepNode = StepNode;
exports.DescriptionNode = DescriptionNode;
