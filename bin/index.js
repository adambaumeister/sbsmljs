const { SBSMLParser } = require('../lib/parser');
const fs = require('fs');
const TEST_DOC_PATH = "./test.sbs"


function main() {
    fs.readFile(TEST_DOC_PATH, "utf-8", (err, data) => {
        if (err) {
            console.error(err);
            return;
        } else {
            parser = SBSMLParser.parse(data);
            //parser.asJSON();
            nodeList = parser.getProcessTree("Bake a cake");
            console.log(nodeList);
        }
    })
}

main();
