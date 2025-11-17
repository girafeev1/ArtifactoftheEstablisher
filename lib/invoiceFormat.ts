export function amountHK(n?: number | null): string {
  if (typeof n !== 'number') return '-'
  const f = new Intl.NumberFormat('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `HK$ ${f.format(n)}`
}

export function num2eng(number: number): string {
  if (number == null || isNaN(number) || Number(number) === 0) return ''
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion']
  const numParts = number.toFixed(2).split('.')
  const wholePart = parseInt(numParts[0], 10)
  const decimalPart = parseInt(numParts[1], 10)
  let dollarWords: string[] = []
  let lastIntegerIndexInDollars = -1
  function convertChunk(num: number) {
    const chunkWords: string[] = []
    let lastIntegerIndex = -1
    if (num >= 100) { chunkWords.push(ones[Math.floor(num / 100)]); chunkWords.push('Hundred'); num = num % 100 }
    if (num > 0) {
      lastIntegerIndex = chunkWords.length
      if (num < 20) chunkWords.push(ones[num])
      else { chunkWords.push(tens[Math.floor(num / 10)]); if (num % 10 > 0) chunkWords.push(ones[num % 10]) }
    }
    return { words: chunkWords, lastIntegerIndex }
  }
  if (wholePart > 0) {
    let numString = wholePart.toString()
    const chunks: string[] = []
    while (numString.length > 0) { const end = numString.length; const start = Math.max(0, end - 3); chunks.unshift(numString.substring(start, end)); numString = numString.substring(0, start) }
    const dollarWordArray: { words: string[]; lastIntegerIndex: number }[] = []
    for (let i = 0; i < chunks.length; i++) {
      const chunkNum = parseInt(chunks[i], 10)
      if (chunkNum > 0) { const chunkObj = convertChunk(chunkNum); const chunkWords = chunkObj.words; const scale = scales[chunks.length - i - 1]; if (scale) chunkWords.push(scale); dollarWordArray.push({ words: chunkWords, lastIntegerIndex: chunkObj.lastIntegerIndex }) }
    }
    for (let i = 0; i < dollarWordArray.length; i++) { const chunk = dollarWordArray[i]; dollarWords = dollarWords.concat(chunk.words) }
    const lastChunk = dollarWordArray[dollarWordArray.length - 1]
    if (lastChunk.lastIntegerIndex > -1) lastIntegerIndexInDollars = dollarWords.length - lastChunk.words.length + lastChunk.lastIntegerIndex
    else lastIntegerIndexInDollars = dollarWords.length - lastChunk.words.length
  }
  const words: string[] = []
  if (wholePart > 0) { words.push(...dollarWords, 'Dollars') }
  if (decimalPart > 0) { const centsChunk = convertChunk(decimalPart).words; words.push('And', ...centsChunk, 'Cents') }
  else { if (lastIntegerIndexInDollars > 0) words.splice(lastIntegerIndexInDollars, 0, 'And'); words.push('Only') }
  return words.join(' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function num2chi(n: number): string {
  if (n === undefined || n === null) return ''
  const s = String(n.toFixed(2))
  const digit = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
  const unit = ['', '拾', '佰', '仟']
  const sectionUnit = ['', '萬', '億', '兆']
  const decimalUnit = ['毫', '仙']
  const parts = s.split('.')
  let integerPart = parseInt(parts[0], 10)
  const decimalPart = parts.length > 1 ? parts[1].substr(0, 2) : ''
  function sectionToFinancialChinese(section: number) {
    let str = ''
    let unitPos = 0
    let zero = true
    while (section > 0) { const v = section % 10; if (v === 0) { if (!zero) { zero = true; str = digit[0] + str } } else { zero = false; str = digit[v] + unit[unitPos] + str } unitPos++; section = Math.floor(section / 10) }
    return str
  }
  function integerToChequeChinese(val: number) {
    if (val === 0) return digit[0]
    let str = ''
    let sectionPos = 0
    let needZero = false
    while (val > 0) { const section = val % 10000; const sectionStr = sectionToFinancialChinese(section); if (needZero && sectionStr !== '') str = digit[0] + str; if (sectionStr !== '') str = sectionStr + sectionUnit[sectionPos] + str; else if (str !== '') str = sectionUnit[sectionPos] + str; needZero = section < 1000 && section > 0; val = Math.floor(val / 10000); sectionPos++ }
    return str
  }
  const integerStr = integerToChequeChinese(integerPart)
  let decimalStr = ''
  if (decimalPart && parseInt(decimalPart, 10) !== 0) {
    for (let i = 0; i < decimalPart.length && i < 2; i++) { const num = parseInt(decimalPart.charAt(i), 10); if (num !== 0) decimalStr += digit[num] + decimalUnit[i]; else if (i < decimalPart.length - 1 && parseInt(decimalPart.charAt(i + 1), 10) !== 0) decimalStr += digit[0] }
  } else { decimalStr = '正' }
  return integerStr + '元' + decimalStr
}

