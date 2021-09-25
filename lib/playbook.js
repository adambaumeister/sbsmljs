const DEFAULT_X_POS = 450;
const START_Y_POX = -30;
const {ProcessNode, StepNode} = require('../lib/parser');
const yaml = require('js-yaml');

class Playbook {
    constructor(parser) {
        this.parser = parser;
        let title = "auto_playbook";
        if (this.parser.title !== null) {
            title = this.parser.title.text;
        }
        let view = {
            "linkLabelsPosition": {},
            "paper": {
                "dimensions": {
                    "height": 845,
                    "width": 790,
                    "x": 240,
                    "y": -30
                }
            }
        }
        this.r = {
            "name": title,
            "starttaskid": "0",
            "tasks": {},
            "view": JSON.stringify(view)
        }
    }

    static render(parser) {
        // Convert the parsed SBSML into an XSOAR playbook
        let tasks = {};
        let p = new Playbook(parser)
        let processNode = p.parser.processNodes[0];
        let nodeList = p.parser.getProcessTree(processNode.nodeName);
        // Add the start task
        tasks["0"] = makeTask(0, "", ["1"], START_Y_POX, DEFAULT_X_POS, "start")
        nodeList.forEach(
            (node, index) => {
                let taskIndex = index+1;
                if (node instanceof ProcessNode) {
                    tasks[taskIndex.toString()] = sectionFromProcessNode(node, taskIndex);
                } else if (node instanceof StepNode) {
                    tasks[taskIndex.toString()] = taskFromStepNode(node, taskIndex);
                }
            }
        );
        p.r["tasks"] = tasks;
        return p;
    }

    toYaml() {
        console.log(yaml.dump(this.r));
    }
}

function makeSubTask(name, taskType, id) {
    return {
        "name": name,
        "type": taskType,
        "id": id
    }
}

function makeView(yPos, xPos) {
    return `{"position": {"x": ${xPos}, "y": ${yPos} } }`
}

function makeTask(id, name, nextTasks, yPos, xPos, type) {
    // Create a section header task

    let d =  {
        "id": id.toString(),
        "taskid": id.toString(),
        "type": type,
        "task": makeSubTask(name, type, id.toString()),
        "view": makeView(yPos, xPos)
    };

    if (nextTasks !== null) {
        d["nexttasks"] = {
            "#none#": nextTasks
        }
    }

    return d;
}

function sectionFromProcessNode(processNode, index) {
    let nextTask = index + 1;
    nextTask = nextTask.toString();
    return makeTask(index, processNode.nodeName, [nextTask], (index + 1) * 200, DEFAULT_X_POS, "title");
}

function taskFromStepNode(stepNode, index) {
    let nextTask = index + 1;
    let nextTasks = [nextTask];
    if (stepNode.nextNode === null) {
        nextTasks = null;
    }
    nextTask = nextTask.toString();
    return makeTask(index, stepNode.nodeName, nextTasks, (index + 1) * 200, DEFAULT_X_POS, "regular");
}



exports.Playbook = Playbook;