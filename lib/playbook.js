const DEFAULT_X_POS = 450;
const START_Y_POX = -30;
const {ProcessNode, StepNode, Conditional} = require('../lib/parser');
const yaml = require('js-yaml');

class Playbook {
    constructor(parser) {
        this.parser = parser;
        let title = "auto_playbook";
        if (this.parser.title.text !== null) {
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
        let newTasks = tasksFromNodeList(nodeList, 1, parser)["tasks"];

        //console.log(newTasks);
        tasks = {...tasks, ...newTasks};
        p.r["tasks"] = tasks;
        return p;
    }


    toYaml() {
        return yaml.dump(this.r);
    }
}

function tasksFromNodeList(nodeList, startIndex, parser) {
    // given a list of nodes, convert to a list of tasks
    // Returns
    //      tasks: list[object]
    //      index: Max new index

    let tasks = {};
    let taskIndex = startIndex;

    nodeList.forEach(
        (node) => {
            if (node instanceof ProcessNode) {
                tasks[taskIndex.toString()] = sectionFromProcessNode(node, taskIndex);
                taskIndex = taskIndex+1;

            } else if (node instanceof StepNode) {
                tasks[taskIndex.toString()] = taskFromStepNode(node, taskIndex);
                taskIndex = taskIndex+1;
            } else if (node instanceof Conditional) {
                let result = conditionalFromConditionNode(node, taskIndex, parser);

                taskIndex = result["newIndex"];

                tasks = {...tasks, ...result["tasks"] };

            }
        }
    );



    return {"tasks": tasks, "newIndex": taskIndex};
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
    return makeTask(index, processNode.nodeName, [nextTask], index * 200, DEFAULT_X_POS, "title");
}

function conditionalFromConditionNode(conditionNode, index, parser) {
    let nextTask = index + 1;
    // Create the conditional task first
    let task = makeTask(index, "Condition", null, index * 200, DEFAULT_X_POS,  "conditional")
    task["nexttasks"] = {};

    let tasks = {};
    tasks[index.toString()] = task;
    let newIndex = nextTask;
    // Go through each condition
    Object.keys(conditionNode.conditions).forEach(conditionText => {
        // Add the next task and condition to the task index
        task["nexttasks"][conditionText] = [nextTask.toString()];
        let condition = conditionNode.conditions[conditionText];
        let nodeList = [];

        // Get the process tree based on the conditional process node
        parser.getNextNodeRecursive(condition.nextProcessNode, nodeList)

        let taskResult = tasksFromNodeList(nodeList, nextTask, parser);
        let newTasks = taskResult["tasks"];
        // Merge the additional tasks with the current tasks
        tasks = {...tasks, ...newTasks};
        // The new index is the max index returned from the recursive function
        nextTask = taskResult["newIndex"]+1;
    })

    // Finally, get the "else" case
    /*
    task["nexttasks"]["else"] = nextTask;
    let nextNodeList = [];
    parser.getNextNodeRecursive(conditionNode.nextNode, nextNodeList);
    let taskResult = tasksFromNodeList(nextNodeList, nextTask, parser);
    let newTasks = taskResult["tasks"];
    newIndex = taskResult["newIndex"];
    console.log(`new: ${newIndex}`);
    tasks = {...tasks, ...newTasks};
    */
    task["nexttasks"]["#default#"] = [nextTask.toString()];
    return {"tasks": tasks, "newIndex": nextTask};


}

function taskFromStepNode(stepNode, index) {
    let nextTask = index + 1;
    let nextTasks = [nextTask];
    if (stepNode.nextNode === null) {
        if ( stepNode.nextConditional === null ) {
            nextTasks = null;
        }
    }
    return makeTask(index, stepNode.nodeName, nextTasks, index * 200, DEFAULT_X_POS, "regular");
}



exports.Playbook = Playbook;