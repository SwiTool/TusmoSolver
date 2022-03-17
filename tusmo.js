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

// function getNumTimesLetterInWord(word, letter) {
//     return (word.match(new RegExp(letter, "g")) || []).length;
// }

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

function getReg(history, wordLen, badLetters) {
    const myRegx = [];
    let defaultOption = "[abcdefghijklnmopqrstuvwxyz]";
    defaultOption = defaultOption.replace(
        new RegExp(Array.from(badLetters).join("|"), "g"),
        ""
    );
    for (let i = 0; i < wordLen; ++i) {
        myRegx.push(defaultOption);
    }
    let presentletters = {};

    for (let y = 0; y < history.length; ++y) {
        const isPoint = history[y].filter((word) => word.letter === ".");
        if (isPoint.length > 0) {
            break;
        }
        const currentPresentLetters = {};
        for (let x = 0; x < wordLen; ++x) {
            if (history[y][x].placement === "FOUND") {
                myRegx[x] = history[y][x].letter;
                if (!currentPresentLetters[history[y][x].letter]) {
                    currentPresentLetters[history[y][x].letter] = 1;
                } else {
                    ++currentPresentLetters[history[y][x].letter];
                }
            }
            if (history[y][x].placement === "INCORRECT") {
                if (badLetters.includes(history[y][x].letter)) {
                    badLetters = badLetters.replace(history[y][x].letter, "");
                    return getReg(history, wordLen, badLetters);
                }
                myRegx[x] = myRegx[x].replace(history[y][x].letter, "");
                if (!currentPresentLetters[history[y][x].letter]) {
                    currentPresentLetters[history[y][x].letter] = 1;
                } else {
                    ++currentPresentLetters[history[y][x].letter];
                }
            }
        }
        presentletters = currentPresentLetters;
    }
    let finalPresentLetters = "";
    for (const key of Object.keys(presentletters)) {
        finalPresentLetters += key.repeat(presentletters[key]);
    }
    return { regexp: myRegx.join(""), incorrectWords: finalPresentLetters };
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
    const badLetters = cells
        .filter((c) => c.classList.contains(STATE.IMPOSSIBLE))
        .map(getCellLetter)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join("");
    const history = getHistory(cells, wordLen);
    const reg = getReg(history, wordLen, badLetters);
    const regEx = new RegExp(reg.regexp);
    let possibleWords = dico
        .filter((w) => !!w.word.match(regEx))
        .filter((w) => checkIfLetterIsPresent(w.word, reg.incorrectWords));

    console.debug(possibleWords.map((w) => w.word));
    const best = getBestWord(possibleWords);
    word = best.word;
    console.log(`best word: '${best.word}' with score ${best.score}`);

    lastWord = word;
    guessWord(word);
}

console.log(setInterval(run, 2000));
