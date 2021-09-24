
class Playbook {
    constructor(parser) {
        this.parser = parser;
        this.r = {

        };
    }

    render() {
        this.parser.processNodes.forEach(processNode => sectionFromProcessNode(processNode));
    }
}

function sectionFromProcessNode(processNode) {
    console.log(processNode.nodeName);
}

exports.Playbook = Playbook;