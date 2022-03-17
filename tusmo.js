const TYPE_SPEED = 50;
let realDico = [];
let dico = [];
let lastIndex = -1;
let lastWord = null;
let isTyping = false;
let blackListedWords = [];

chrome.storage.sync.get(["blackListedWords"], function (result) {
    console.log(result);
    console.log("Value currently is " + result.blacklistedWords);
    blackListedWords = result.blacklistedWords
        ? JSON.parse(result.blacklistedWords)
        : [];

    blackListedWords.forEach(removeFromDicos);
});

const STATE = {
    GUESSING: "bg-sky-600",
    INCORRECT: "y",
    FOUND: "r",
    IMPOSSIBLE: "-",
};

const WEIGHT = {
    a: 5,
    b: 3,
    c: 3,
    d: 3,
    e: 5,
    f: 3,
    g: 3,
    h: 3,
    i: 5,
    j: 2,
    k: 2,
    l: 3,
    m: 3,
    n: 3,
    o: 5,
    p: 2,
    q: 2,
    r: 3,
    s: 3,
    t: 3,
    u: 5,
    v: 2,
    w: 1,
    x: 1,
    y: 4,
    z: 1,
};

fetch(chrome.runtime.getURL("dico.txt")).then(async (res) => {
    realDico = (await res.text()).split(" ");
});

function removeFromDicos(word) {
    const i = realDico.indexOf(word);
    const j = dico.indexOf(word);
    if (~i) {
        realDico.splice(i, 1);
    }
    if (~j) {
        dico.splice(j, 1);
    }
}

function getNumTimesLetterInWord(word, letter) {
    return (word.match(new RegExp(letter, "g")) || []).length;
}

function getWordWeight(word) {
    return Array.from(word).reduce((r, c, i) => {
        const nbTimesUsed = getNumTimesLetterInWord(word.substr(0, i + 1), c);
        return r + WEIGHT[c] / Math.pow(2, nbTimesUsed);
    }, 0);
}

function getBestWordFirstLetter() {
    const best = dico.reduce(
        (res, current) => {
            const score = getWordWeight(current);
            if (res.score < score) {
                res.score = score;
                res.word = current;
            }
            return res;
        },
        {
            word: "",
            score: 0,
        }
    );
    console.log(`best word: '${best.word}' with score ${best.score}`);
    return best.word;
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
    isTyping = true;
    Array.from(word.toUpperCase()).forEach((c) => {
        const keyCode = c.charCodeAt(0);
        setTimeout(() => pressKey(keyCode), (timeout += TYPE_SPEED));
    });
    setTimeout(() => {
        pressKey(13);
        isTyping = false;
    }, (timeout += TYPE_SPEED));
}

function run() {
    const gameColumn = document.getElementsByClassName("game-column")[0];
    if (!gameColumn) {
        return console.warn("game is not running");
    }
    const cells = [...gameColumn.getElementsByClassName("cell-content")];
    if (!cells.length) {
        return console.warn("game is not running");
    }
    const wordLen = cells.length / 6;
    const currentLineStartIndex = cells.findIndex((c) =>
        c.classList.contains(STATE.GUESSING)
    );
    if (lastIndex === currentLineStartIndex) {
        if (lastWord && !isTyping) {
            blackListWord(lastWord);
        } else {
            return console.debug("waiting for new state");
        }
    }
    lastIndex = currentLineStartIndex;
    lastWord = null;
    if (currentLineStartIndex < 0) {
        return console.warn("game finished or not running");
    }
    console.debug({
        currentLineStartIndex,
        verif: currentLineStartIndex === 0,
    });
    if (currentLineStartIndex === 0) {
        dico = [];
        console.debug("New game");
    }
    const firstTry = currentLineStartIndex === 0;
    const currentGuessCells = cells.slice(
        currentLineStartIndex,
        currentLineStartIndex + wordLen
    );

    const currentWord = currentGuessCells.map(getCellLetter).join("");

    let word = "";
    console.debug({ len: dico.length, verif: dico.length === 0 });
    if (dico.length === 0) {
        dico = realDico.filter(
            (word) => word.length === wordLen && word[0] === currentWord[0]
        );
    }
    if (firstTry) {
        word = getBestWordFirstLetter();
    } else {
        const badLetters = cells
            .filter((c) => c.classList.contains(STATE.IMPOSSIBLE))
            .map(getCellLetter)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join("");
        const history = getHistory(cells, wordLen);
        const reg = getReg(history, wordLen, badLetters);
        const regEx = new RegExp(reg.regexp);
        let possibleWords = dico
            .filter((word) => !!word.match(regEx))
            .filter((word) => checkIfLetterIsPresent(word, reg.incorrectWords));
        console.log(possibleWords);
        word = possibleWords[0];
    }

    lastWord = word;
    guessWord(word);
}

console.log(setInterval(run, 1000));
