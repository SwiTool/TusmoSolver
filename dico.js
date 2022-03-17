const fs = require('fs')

const lines = fs.readFileSync('./Lexique383.tsv').toString('utf-8')

const words = []

lines.split('\n').forEach(line => {
  const word = line.split('\t')[0]
  if (word.length < 4 || word.length > 9 || word.includes('-') || word.includes(' ')) {
    return
  }
  const withoutAccent = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  words.push(withoutAccent)
})

fs.writeFileSync('./dico.txt', words.join(' '))
