const DEFAULT_X_POS = 450;
const {ProcessNode, StepNode} = require('../lib/parser');

class Playbook {
    constructor(parser) {
        this.parser = parser;
        let title = "auto_playbook";
        if (this.parser.title !== null) {
            title = this.parser.title.text;
        }
        this.r = {
            "name": title,
            "starttaskid": "0",
            "tasks": []
        };
    }

    render() {
        // Convert the parsed SBSML into an XSOAR playbook
        let tasks = [];
        let processNode = this.parser.processNodes[0];
        let nodeList = this.parser.getProcessTree(processNode.nodeName);
        nodeList.forEach(
            (node, index) => {
                if (node instanceof ProcessNode) {
                    tasks.push(sectionFromProcessNode(node, index));
                } else if (node instanceof StepNode) {
                    tasks.push(taskFromStepNode(node, index));
                }
            }
        );
        return tasks;
    }
}

function makeSubTask(name, taskType) {
    return {
        "name": name,
        "type": taskType
    }
}

function makeView(yPos, xPos) {
    return `{"position": {"x": ${xPos},"y": ${yPos} }`
}

function makeTask(id, name, nextTasks, yPos, xPos, type) {
    // Create a section header task
    return {
        "id": id,
        "type": type,
        "task": makeSubTask(name, "title"),
        "nexttasks": {
            "#none#": nextTasks
        },
        "view": makeView(yPos, xPos)
    };
}

function sectionFromProcessNode(processNode, index) {
    return makeTask(index.toString(), processNode.nodeName, [index + 1], (index + 1) * 200, DEFAULT_X_POS, "title");
}

function taskFromStepNode(stepNode, index) {
    return makeTask(index.toString(), stepNode.nodeName, [index + 1], (index + 1) * 200, DEFAULT_X_POS, "regular");
}



exports.Playbook = Playbook;