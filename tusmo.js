const TYPE_SPEED = 100;
let realDico = [];
let dico = [];
let lastIndex = -1;
let lastWord = null;
let blackListedWords = [];
window.solverEnabled = false;

chrome.storage.sync.get(
    ["blackListedWords", "enabled"],
    function ({ blackListedWords, enabled }) {
        solverEnabled = enabled;
        console.debug("Backlisted words", blackListedWords);
        blackListedWords = blackListedWords ? JSON.parse(blackListedWords) : [];
        blackListedWords = [];
        blackListedWords.forEach(removeFromDicos);
    }
);

// Fetch dictionary
fetch(chrome.runtime.getURL("dico.json")).then(async (res) => {
    realDico = JSON.parse(await res.text());
});

// Add custom css
var link = document.createElement("link");
link.href = chrome.runtime.getURL("override.css");
link.type = "text/css";
link.rel = "stylesheet";
document.getElementsByTagName("head")[0].appendChild(link);

const STATE = {
    GUESSING: "bg-sky-600",
    INCORRECT: "y",
    FOUND: "r",
    IMPOSSIBLE: "-",
};

function removeFromDicos(word) {
    realDico = realDico.filter((w) => w.word !== word);
    dico = dico.filter((w) => w.word !== word);
}

function getNumTimesLetterInWord(word, letter) {
    return (word.match(new RegExp(letter, "g")) || []).length;
}

function getBestWord(list) {
    return {
        word: list[0]?.word,
        score: list[0]?.freq,
    };
}

function getCellState(cell) {
    for (let state in STATE) {
        if (cell.classList.contains(STATE[state])) {
            return state;
        }
    }
    // console.log('not found', cell.innerText)
}

function getCellLetter(cell) {
    return cell.innerText.toLowerCase();
}

function getHistory(cells, wordLen) {
    const result = [];
    for (let i = 0; i < cells.length; i += wordLen) {
        const wordCells = cells.slice(i, i + wordLen);
        const word = wordCells.map((c, index) => ({
            position: index,
            letter: getCellLetter(c),
            placement: getCellState(c),
        }));
        word.word = wordCells.map((c) => getCellLetter(c)).join("");
        result.push(word);
    }
    return result;
}

function fillFilter(letterFilter, line, letter, wordLen) {
    const nbPossible = line.filter(
        (cell) => cell.letter === letter && cell.placement !== "IMPOSSIBLE"
    );
    const nbImpossible = line.filter(
        (cell) => cell.letter === letter && cell.placement === "IMPOSSIBLE"
    );
    const min = nbPossible.length;
    const max = nbImpossible.length > 0 ? min : wordLen;
    if (max === 0) {
        return;
    }
    if (!letterFilter[[letter]]) {
        letterFilter[[letter]] = { min: min, max: max };
    } else {
        if (min > letterFilter[[letter]].min) {
            letterFilter[[letter]].min = min;
        }
        if (max < letterFilter[[letter]].max) {
            letterFilter[[letter]].max = max;
        }
    }
}

function getReg(history, wordLen) {
    const myRegx = Array(wordLen).fill("[abcdefghijklnmopqrstuvwxyz]");

    let impossibleLetters = "";
    let letterFilter = {};

    for (let x = 0; x < wordLen; ++x) {
        for (let y = 0; y < history.length; ++y) {
            const state = history[y][x].placement;
            const letter = history[y][x].letter;
            if (state === undefined) {
                continue;
            }
            if (state === "FOUND") {
                myRegx[x] = letter;
            } else if (state === "INCORRECT") {
                myRegx[x] = myRegx[x].replace(letter, "");
            } else if (state === "IMPOSSIBLE") {
                const hasIncorrectLetters =
                    history[y].filter(
                        (cell) =>
                            cell.letter === letter &&
                            cell.placement === "INCORRECT"
                    ).length > 0;
                if (hasIncorrectLetters) {
                    continue;
                }

                if (!impossibleLetters.includes(letter)) {
                    impossibleLetters += letter;
                }
                for (let tmpX = 0; tmpX < wordLen; ++tmpX) {
                    if (myRegx[tmpX].includes("[")) {
                        myRegx[tmpX] = myRegx[tmpX].replace(letter, "");
                    }
                }
            }
            fillFilter(letterFilter, history[y], letter, wordLen);
        }
    }
    // console.debug({ finalRegex, impossibleLetters, letterFilter });
    return { reg: myRegx.join(""), letterFilter };
}

function checkIfLetterIsPresent(string, substring) {
    var letters = [...string];
    return substring.split("").every((x) => {
        var index = letters.indexOf(x);
        if (~index) {
            letters.splice(index, 1);
            return true;
        }
    });
}

function checkLetterNbPresence(word, letterFilter) {
    for (let letter of Object.keys(letterFilter)) {
        const nbLetterPresence = getNumTimesLetterInWord(word, letter);
        if (
            nbLetterPresence < letterFilter[[letter]].min ||
            nbLetterPresence > letterFilter[[letter]].max
        ) {
            return false;
        }
    }
    return true;
}

function pressKey(keyCode) {
    window.dispatchEvent(new KeyboardEvent("keypress", { keyCode }));
    window.dispatchEvent(new KeyboardEvent("keyup", { keyCode }));
}

function blackListWord(word) {
    if (!blackListedWords.includes(word)) {
        blackListedWords.push(word);
        removeFromDicos(word);
    }
    chrome.storage.sync.set(
        { blackListedWords: JSON.stringify(blackListedWords) },
        function () {
            console.debug(`'${word}' added to blacklist`);
        }
    );
}

function guessWord(word) {
    let timeout = 0;
    if (!word) {
        return console.debug("word empty");
    }
    Array.from(word.toUpperCase()).forEach((c) => {
        const keyCode = c.charCodeAt(0);
        setTimeout(() => pressKey(keyCode), (timeout += TYPE_SPEED));
    });
    setTimeout(() => pressKey(13), (timeout += TYPE_SPEED));
}

function run() {
    if (!solverEnabled) {
        return;
    }
    const gameColumn = document.getElementsByClassName("game-column")[0];
    if (!gameColumn) {
        return;
    }
    const cells = [...gameColumn.getElementsByClassName("cell-content")];
    if (!cells.length) {
        return;
    }
    const wordLen = cells.length / 6;
    const currentLineStartIndex = cells.findIndex((c) =>
        c.classList.contains(STATE.GUESSING)
    );
    if (lastIndex === currentLineStartIndex) {
        if (lastWord && currentLineStartIndex !== -1) {
            blackListWord(lastWord);
        } else {
            return;
        }
    }
    lastIndex = currentLineStartIndex;
    if (currentLineStartIndex === -1) {
        return;
    }
    if (currentLineStartIndex === 0) {
        dico = [];
        console.debug("new round");
    }
    const currentGuessCells = cells.slice(
        currentLineStartIndex,
        currentLineStartIndex + wordLen
    );

    const currentWord = currentGuessCells.map(getCellLetter).join("");

    let word = "";
    if (dico.length === 0) {
        dico = realDico.filter(
            (w) => w.word.length === wordLen && w.word[0] === currentWord[0]
        );
    }

    const history = getHistory(cells, wordLen);
    const { reg, letterFilter } = getReg(history, wordLen);
    console.debug({ reg, letterFilter });
    // const reg = getReg(history, wordLen, impossibleLetters);
    const regEx = new RegExp(reg);
    let possibleWords = dico
        .filter((w) => !!w.word.match(regEx))
        .filter((w) => checkLetterNbPresence(w.word, letterFilter));
    // .filter((w) => checkIfLetterIsPresent(w.word, reg.incorrectWords));

    console.debug(possibleWords.map((w) => w.word));
    const best = getBestWord(possibleWords);
    word = best.word;
    console.log(`best word: '${best.word}' with score ${best.score}`);

    lastWord = word;
    guessWord(word);
}

console.log(setInterval(run, 2000));
