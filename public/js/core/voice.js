export const VoiceInput = {
  recognition: null,
  supported: false,

  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return false
    this.recognition = new SR()
    this.recognition.lang = 'pt-BR'
    this.recognition.continuous = false
    this.recognition.interimResults = true
    this.supported = true
    return true
  },

  start() {
    if (!this.recognition) return Promise.reject(new Error('Voz não suportada'))
    return new Promise((resolve, reject) => {
      let finalText = ''
      let resolved = false

      const done = (text, err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        if (text) resolve(text)
        else reject(err || new Error('Nenhum áudio detectado'))
      }

      const timer = setTimeout(() => {
        this.recognition.stop()
        done(finalText, new Error('Tempo esgotado — tente novamente'))
      }, 10000)

      this.recognition.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript
        }
      }
      this.recognition.onerror = (e) => done(null, new Error(e.error))
      this.recognition.onend = () => done(finalText, new Error('Nenhum áudio detectado'))
      this.recognition.start()
    })
  },

  stop() {
    this.recognition?.stop()
  }
}

// Parser local de texto em português para lançamento financeiro
export function parseVoiceText(text) {
  const t = text.toLowerCase()
  const result = { type: 'expense', amount: null, description: null, category_hint: null }

  // Tipo
  if (/recebi|salário|pagamento recebido|entrou|renda|receita/i.test(t)) result.type = 'income'
  else if (/paguei|gastei|comprei|compra|despesa|débito/i.test(t)) result.type = 'expense'

  // Valor — "oitenta e nove reais e noventa centavos", "cem reais", "1500 reais", "R$ 45,90"
  const numWords = {
    'zero':0,'um':1,'uma':1,'dois':2,'duas':2,'três':3,'quatro':4,'cinco':5,
    'seis':6,'sete':7,'oito':8,'nove':9,'dez':10,'onze':11,'doze':12,
    'treze':13,'quatorze':14,'quinze':15,'dezesseis':16,'dezessete':17,
    'dezoito':18,'dezenove':19,'vinte':20,'trinta':30,'quarenta':40,
    'cinquenta':50,'sessenta':60,'setenta':70,'oitenta':80,'noventa':90,
    'cem':100,'cento':100,'duzentos':200,'duzentas':200,'trezentos':300,'trezentas':300,
    'quatrocentos':400,'quatrocentas':400,'quinhentos':500,'quinhentas':500,
    'seiscentos':600,'seicentas':600,'setecentos':700,'setecentas':700,
    'oitocentos':800,'oitocentas':800,'novecentos':900,'novecentas':900,
    'mil':1000
  }

  // Tenta número digital primeiro: "89,90" "89.90" "1.500,00" "R$ 45"
  const digitMatch = t.match(/r\$?\s*([\d]{1,3}(?:[.,]?\d{3})*(?:[.,]\d{2})?)/i)
    || t.match(/([\d]{1,4}(?:[.,]\d{2})?)\s*reais/i)
  if (digitMatch) {
    const raw = digitMatch[1].replace(/\./g,'').replace(',','.')
    result.amount = parseFloat(raw)
  }

  // Fallback: extenso
  if (!result.amount) {
    let reaisTokens = [], centavosTokens = []
    const parts = t.split(/\s+e\s+centavos|\s+centavos|\s+e\s+/)
    const reaisStr = parts[0]
    const centStr  = parts[1] || ''

    let n = 0, total = 0
    for (const w of reaisStr.split(/\s+/)) {
      if (numWords[w] !== undefined) {
        const v = numWords[w]
        if (v === 1000) { total = (total + (n || 1)) * 1000; n = 0 }
        else if (v >= 100) { n += v; total += n; n = 0 }
        else n += v
      }
    }
    let reais = total + n

    let cents = 0, cn = 0, ctotal = 0
    for (const w of centStr.split(/\s+/)) {
      if (numWords[w] !== undefined) {
        const v = numWords[w]
        if (v >= 100) { cn += v; ctotal += cn; cn = 0 }
        else cn += v
      }
    }
    cents = ctotal + cn

    if (reais > 0 || cents > 0) result.amount = reais + cents / 100
  }

  // Descrição — remove palavras de valor e conectivos, mantém o estabelecimento
  let desc = text
    .replace(/gastei|paguei|comprei|recebi|no|na|em|do|da|de|pelo|pela|com/gi, '')
    .replace(/r\$[\d.,]+/gi, '')
    .replace(/[\d]+[.,]?[\d]*\s*reais[\s\w]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (desc.length > 3) result.description = desc.replace(/^\w/, c => c.toUpperCase())

  // Hint de categoria
  const catHints = [
    [/mercado|supermercado|feira|hortifrúti/i,           'Alimentação'],
    [/ifood|delivery|restaurante|lanche|pizza|açaí/i,    'Alimentação'],
    [/uber|99|taxi|posto|combustível|gasolina/i,         'Transporte'],
    [/farmácia|remédio|médico|consulta|plano de saúde/i, 'Saúde'],
    [/escola|faculdade|curso|livro/i,                    'Educação'],
    [/netflix|spotify|streaming|assinatura/i,            'Lazer'],
    [/aluguel|condomínio|iptu|água|luz|energia|internet/i,'Moradia'],
    [/salário|renda|freela|trabalho/i,                   'Renda'],
  ]
  for (const [re, cat] of catHints) {
    if (re.test(t)) { result.category_hint = cat; break }
  }

  return result
}
