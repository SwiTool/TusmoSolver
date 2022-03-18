const fs = require("fs");

const lines = fs.readFileSync("./ods6.txt").toString("utf-8").toLowerCase();

const words = [];

lines.split("\n").forEach((word, index) => {
    if (
        word.length < 4 ||
        word.length > 9 ||
        word.includes("-") ||
        word.includes(" ")
    ) {
        return;
    }
    const withoutAccent = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    words.push(word);
});

fs.writeFileSync("./dico.txt", words.join(" "));
