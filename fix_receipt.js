const fs = require(''fs'')
const src = fs.readFileSync(''src/utils/textReceipt.js'', ''utf8'')

// Find the last ls.push(line... which is the footer separator before return
const thanksIdx = src.indexOf(''Thank you for choosing Us!'')
const cutIdx = src.lastIndexOf(''ls.push(line(''-'')'', thanksIdx)

if (cutIdx === -1) {
  console.error(''Cut marker not found'')
  process.exit(1)
}

const head = src.slice(0, cutIdx)

const newTail = [
  ''ls.push(line(''-''))'',
  ''ls.push(center(''''Thank you for choosing Us!''''))'',
  ''ls.push(center(''''Please present receipt on return.''''))'',
  ''ls.push(center(''''Software: Inivac | 0742266018''''))'',
  ''ls.push(line(''''=''''))'',
  '''',
  ''  // Orientation fix: on this Xprinter first bytes = BOTTOM, last bytes = TOP of receipt.'',
  ''  // Reversing all lines so header prints last and appears at the top.'',
  ''  const allLines = ls.join(''''\\n'''').split(''''\\n'''')'',
  ''  allLines.reverse()'',
  ''  allLines.push('''''''', '''''''', '''''''', '''''''')'',
  '''',
  ''  return allLines.join(''''\\n'''')'',
  ''}'',
  ''''
].join(''\\n'')

const newSrc = head + newTail
fs.writeFileSync(''src/utils/textReceipt.js'', newSrc, ''utf8'')
console.log(''Done, lines: '' + newSrc.split(''\\n'').length)
