const fs = require("fs");

const lines = fs.readFileSync("./Lexique383.tsv").toString("utf-8");

const words = [];

lines.split("\n").forEach((line, index) => {
    if (index === 0) {
        // first line is file definition
        return;
    }
    const splitted = line.split("\t");
    const word = splitted[0];
    const freqBook = splitted[9];
    if (
        word.length < 4 ||
        word.length > 9 ||
        word.includes("-") ||
        word.includes(" ")
    ) {
        return;
    }
    const withoutAccent = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    words.push({ word: withoutAccent, freq: freqBook });
});

const sorted = words.sort((w1, w2) => w2.freq - w1.freq);

fs.writeFileSync("./dico.json", JSON.stringify(sorted));
