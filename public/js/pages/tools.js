import { endpoints } from '../core/api.js'
import { fmt } from '../core/utils.js'
import { Toast, Loading } from '../core/notifications.js'

export async function render(el) {
  el.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:var(--space-5) var(--space-6);max-width:720px;margin:0 auto;width:100%">

      <!-- Importar OFX -->
      <section style="margin-bottom:32px">
        <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Importar OFX</h2>
        <div class="card">
          <div class="card-body" style="padding:var(--space-4)">
            <p style="font-size:var(--text-sm);color:var(--color-text-soft);margin-bottom:16px">Importe extratos bancários no formato OFX (Open Financial Exchange). Compatível com a maioria dos bancos brasileiros.</p>
            <div id="ofxDropzone" style="border:2px dashed var(--color-border);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:border-color 0.2s">
              <div style="font-size:32px;margin-bottom:8px">📂</div>
              <div style="font-size:var(--text-sm);font-weight:600">Arraste o arquivo OFX aqui</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-top:4px">ou clique para selecionar</div>
              <input id="ofxFile" type="file" accept=".ofx,.OFX" style="display:none">
            </div>
            <div id="ofxPreview" style="display:none;margin-top:16px"></div>
          </div>
        </div>
      </section>

      <!-- Importar CSV -->
      <section style="margin-bottom:32px">
        <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Importar CSV</h2>
        <div class="card">
          <div class="card-body" style="padding:var(--space-4)">
            <p style="font-size:var(--text-sm);color:var(--color-text-soft);margin-bottom:12px">Importe lançamentos de uma planilha CSV. As colunas devem seguir o formato abaixo.</p>
            <div style="background:var(--color-card-hover);border-radius:8px;padding:12px;margin-bottom:16px;font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-text-soft)">
              data,descricao,valor,tipo,categoria<br>
              2025-01-15,Supermercado,-150.00,expense,Alimentação<br>
              2025-01-15,Salário,5000.00,income,Renda
            </div>
            <div id="csvDropzone" style="border:2px dashed var(--color-border);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:border-color 0.2s">
              <div style="font-size:32px;margin-bottom:8px">📊</div>
              <div style="font-size:var(--text-sm);font-weight:600">Arraste o arquivo CSV aqui</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-top:4px">ou clique para selecionar</div>
              <input id="csvFile" type="file" accept=".csv,.CSV" style="display:none">
            </div>
            <div id="csvPreview" style="display:none;margin-top:16px"></div>
          </div>
        </div>
      </section>

      <!-- Importar SMS / Notificação bancária -->
      <section style="margin-bottom:32px">
        <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Importar SMS / Notificação bancária</h2>
        <div class="card">
          <div class="card-body" style="padding:var(--space-4)">
            <p style="font-size:var(--text-sm);color:var(--color-text-soft);margin-bottom:12px">
              Cole o texto da notificação push ou SMS do seu banco. O app extrai o valor, estabelecimento e data automaticamente.
            </p>

            <!-- Exemplos por banco -->
            <div style="margin-bottom:12px">
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Exemplos — clique para testar</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px" id="smsExamples">
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="nubank">🟣 Nubank</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="itau">🟠 Itaú</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="bradesco">🔴 Bradesco</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="inter">🟠 Inter</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="caixa">🔵 Caixa</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="santander">🔴 Santander</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="bb">🟡 Banco do Brasil</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="pix-recebido">💚 PIX Recebido</button>
                <button class="btn btn-secondary" style="font-size:10px;padding:4px 8px" data-example="pix-enviado">💸 PIX Enviado</button>
              </div>
            </div>

            <textarea id="smsInput" class="form-control" style="min-height:90px;font-family:var(--font-mono);font-size:var(--text-xs);resize:vertical" placeholder="Cole aqui o SMS ou notificação do banco..."></textarea>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn-primary btn-sm" id="smsParseBtn">🔍 Extrair dados</button>
              <button class="btn btn-secondary btn-sm" id="smsClearBtn">Limpar</button>
            </div>
            <div id="smsResult" style="display:none;margin-top:16px"></div>
          </div>
        </div>
      </section>

      <!-- Importação Inteligente (PDF/Imagem) -->
      <section style="margin-bottom:32px">
        <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Importação Inteligente</h2>
        <div class="card">
          <div class="card-body" style="padding:var(--space-4)">
            <p style="font-size:var(--text-sm);color:var(--color-text-soft);margin-bottom:16px">Importe faturas de cartão ou comprovantes em PDF/imagem. O AI extrai os dados automaticamente.</p>

            <div class="form-group">
              <label class="form-label" style="font-weight:600">💳 Fatura do cartão (PDF)</label>
              <div id="invoiceDropzone" style="border:2px dashed var(--color-border);border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:border-color 0.2s">
                <div style="font-size:28px;margin-bottom:8px">📄</div>
                <div style="font-size:var(--text-sm);font-weight:600">Arraste a fatura PDF aqui</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-top:4px">ou clique para selecionar</div>
                <input id="invoiceFile" type="file" accept=".pdf" style="display:none">
              </div>
              <div id="invoicePreview" style="display:none;margin-top:12px"></div>
            </div>

            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" style="font-weight:600">🧾 Comprovante / Nota fiscal</label>
              <div id="receiptDropzone" style="border:2px dashed var(--color-border);border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:border-color 0.2s">
                <div style="font-size:28px;margin-bottom:8px">🧾</div>
                <div style="font-size:var(--text-sm);font-weight:600">Arraste o PDF ou imagem</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-top:4px">PDF, JPG, PNG, WEBP aceitos</div>
                <input id="receiptFile" type="file" accept=".pdf,image/jpeg,image/png,image/webp,image/gif" style="display:none">
              </div>
              <div id="receiptPreview" style="display:none;margin-top:12px"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Calculadora de Investimentos -->
      <section style="margin-bottom:32px">
        <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Calculadora de Investimentos</h2>
        <div class="card">
          <div class="card-body" style="padding:var(--space-4)">
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label class="form-label">Capital inicial (R$)</label>
                <input id="calcPrincipal" class="form-control" type="number" min="0" step="100" value="1000" placeholder="0,00">
              </div>
              <div class="form-group">
                <label class="form-label">Aporte mensal (R$)</label>
                <input id="calcMonthly" class="form-control" type="number" min="0" step="100" value="500" placeholder="0,00">
              </div>
              <div class="form-group">
                <label class="form-label">Taxa de juros (% a.a.)</label>
                <input id="calcRate" class="form-control" type="number" min="0" step="0.1" value="12" placeholder="0,00">
              </div>
              <div class="form-group">
                <label class="form-label">Período (anos)</label>
                <input id="calcYears" class="form-control" type="number" min="1" max="50" step="1" value="10" placeholder="1">
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;margin-bottom:16px">
              <label style="font-size:var(--text-xs);color:var(--color-text-soft);display:flex;align-items:center;gap:4px">
                <input type="checkbox" id="calcIRPF" checked style="accent-color:var(--color-green)"> Descontar IR (15%)
              </label>
            </div>
            <button class="btn btn-primary btn-sm" id="calcBtn">📈 Calcular</button>
            <div id="calcResult" style="display:none;margin-top:16px"></div>
          </div>
        </div>
      </section>

      <!-- Histórico de exclusões -->
      <section style="margin-bottom:32px">
        <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Histórico de exclusões</h2>
        <p style="font-size:var(--text-sm);color:var(--color-text-soft);margin-bottom:12px">Lançamentos excluídos recentemente. Você pode restaurá-los.</p>
        <div id="auditLogBody">
          <div class="skeleton" style="height:56px;border-radius:12px;margin-bottom:8px"></div>
          <div class="skeleton" style="height:56px;border-radius:12px;margin-bottom:8px"></div>
        </div>
      </section>

      <!-- Histórico do Coach -->
      <section style="margin-bottom:32px">
        <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Histórico do Coach IA</h2>
        <div id="coachHistoryBody">
          <div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:8px"></div>
          <div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:8px"></div>
        </div>
      </section>

    </div>
  `

  attachOFXEvents(el)
  attachCSVEvents(el)
  attachSMSEvents(el)
  attachPDFEvents(el)
  attachCalcEvents(el)
  loadAuditLog()
  loadCoachHistory()
}

// ---------- OFX ----------
function attachOFXEvents(el) {
  const dropzone = el.querySelector('#ofxDropzone')
  const fileInput = el.querySelector('#ofxFile')

  dropzone?.addEventListener('click', () => fileInput?.click())
  dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--color-green)' })
  dropzone?.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--color-border)' })
  dropzone?.addEventListener('drop', e => {
    e.preventDefault()
    dropzone.style.borderColor = 'var(--color-border)'
    const file = e.dataTransfer?.files[0]
    if (file) processOFX(file)
  })
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) processOFX(fileInput.files[0])
  })
}

function processOFX(file) {
  const reader = new FileReader()
  reader.onload = e => {
    const text = e.target.result
    // Detecta mojibake de UTF-8 mal interpretado como latin1 (ex: Ã§ Ã£ Ã©)
    if (/Ã[§£©ª«¬­®¯°¡¢£¤¥¦§¨©ª«]/.test(text) || /Ã\s/.test(text)) {
      const reader2 = new FileReader()
      reader2.onload = e2 => {
        try {
          const txs = parseOFX(e2.target.result)
          showOFXPreview(txs)
        } catch {
          Toast.error('Arquivo OFX inválido ou não suportado')
        }
      }
      reader2.readAsText(file, 'ISO-8859-1')
      return
    }
    try {
      const txs = parseOFX(text)
      showOFXPreview(txs)
    } catch {
      Toast.error('Arquivo OFX inválido ou não suportado')
    }
  }
  reader.readAsText(file, 'UTF-8')
}

function parseOFX(text) {
  const txs = []
  const stmtTrnRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match
  while ((match = stmtTrnRe.exec(text)) !== null) {
    const block = match[1]
    const get = tag => {
      const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const trnType = get('TRNTYPE')
    const dtPosted = get('DTPOSTED')
    const amtRaw = parseFloat(get('TRNAMT').replace(',', '.'))
    const memo = get('MEMO') || get('NAME') || 'Sem descrição'
    const fitid = get('FITID') || null

    if (!dtPosted || isNaN(amtRaw)) continue

    const year = dtPosted.slice(0, 4)
    const month = dtPosted.slice(4, 6)
    const day = dtPosted.slice(6, 8)
    const date = `${year}-${month}-${day}`

    const type = amtRaw >= 0 ? 'income' : 'expense'
    txs.push({ date, description: memo, amount: Math.abs(amtRaw), type, trnType, fitid })
  }
  return txs
}

function showOFXPreview(txs) {
  const preview = document.getElementById('ofxPreview')
  if (!preview) return
  if (!txs.length) {
    preview.style.display = 'block'
    preview.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="font-size:24px">📭</div><p>Nenhuma transação encontrada no arquivo</p></div>`
    return
  }

  preview.style.display = 'block'
  preview.innerHTML = `
    <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:8px">${txs.length} transações encontradas</div>
    <div style="max-height:240px;overflow-y:auto;border:1px solid var(--color-border);border-radius:8px">
      ${txs.slice(0, 20).map(t => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--color-border);font-size:var(--text-xs)">
          <div>
            <div style="font-weight:500">${escHtml(t.description.slice(0, 40))}</div>
            <div style="color:var(--color-text-soft)">${t.date}</div>
          </div>
          <div class="${t.type === 'income' ? 'value-positive' : 'value-negative'}" style="font-family:var(--font-mono);font-weight:600">
            ${t.type === 'income' ? '+' : '-'}${fmt.currency(t.amount)}
          </div>
        </div>
      `).join('')}
      ${txs.length > 20 ? `<div style="padding:8px 12px;font-size:var(--text-xs);color:var(--color-text-soft);text-align:center">...e mais ${txs.length - 20} transações</div>` : ''}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" id="ofxImportBtn">✅ Importar ${txs.length} lançamentos</button>
      <button class="btn btn-secondary btn-sm" id="ofxCancelBtn">Cancelar</button>
    </div>
  `

  preview.querySelector('#ofxCancelBtn')?.addEventListener('click', () => { preview.style.display = 'none' })
  preview.querySelector('#ofxImportBtn')?.addEventListener('click', async (e) => {
    Loading.btn(e.target, true)
    let imported = 0, skipped = 0, errors = 0
    for (const t of txs) {
      try {
        await endpoints.createTx({
          description: t.description, amount: t.amount, type: t.type,
          due_date: t.date, status: 'confirmed',
          ...(t.fitid ? { ofx_fitid: t.fitid } : {}),
        })
        imported++
      } catch (err) {
        if (err?.status === 409 || err?.message?.includes('já importada')) skipped++
        else errors++
      }
    }
    const msg = skipped > 0
      ? `${imported} importados · ${skipped} já existiam`
      : `${imported} lançamentos importados`
    if (errors > 0) Toast.error(`${msg} · ${errors} com erro`)
    else Toast.success(msg)
    preview.style.display = 'none'
  })
}

// ---------- CSV ----------
function attachCSVEvents(el) {
  const dropzone = el.querySelector('#csvDropzone')
  const fileInput = el.querySelector('#csvFile')

  dropzone?.addEventListener('click', () => fileInput?.click())
  dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--color-green)' })
  dropzone?.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--color-border)' })
  dropzone?.addEventListener('drop', e => {
    e.preventDefault()
    dropzone.style.borderColor = 'var(--color-border)'
    const file = e.dataTransfer?.files[0]
    if (file) processCSV(file)
  })
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) processCSV(fileInput.files[0])
  })
}

function processCSV(file) {
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const rows = parseCSV(e.target.result)
      showCSVPreview(rows)
    } catch {
      Toast.error('Arquivo CSV inválido')
    }
  }
  reader.readAsText(file, 'utf-8')
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('Arquivo vazio')

  const header = lines[0].toLowerCase().split(/[;,]/).map(h => h.trim().replace(/"/g, ''))
  const dateIdx = header.findIndex(h => h.includes('data') || h === 'date')
  const descIdx = header.findIndex(h => h.includes('desc') || h === 'memo' || h === 'historico')
  const amtIdx  = header.findIndex(h => h.includes('valor') || h === 'amount' || h === 'value')
  const typeIdx = header.findIndex(h => h === 'tipo' || h === 'type')

  if (dateIdx < 0 || descIdx < 0 || amtIdx < 0) throw new Error('Colunas obrigatórias não encontradas')

  return lines.slice(1).map(line => {
    const cols = line.split(/[;,]/).map(c => c.trim().replace(/"/g, ''))
    const rawAmt = parseFloat(cols[amtIdx]?.replace(',', '.') || '0')
    const type = typeIdx >= 0 ? (cols[typeIdx] || '') : (rawAmt >= 0 ? 'income' : 'expense')
    return {
      date: cols[dateIdx] || '',
      description: cols[descIdx] || 'Importado',
      amount: Math.abs(rawAmt),
      type: type.includes('income') || type.includes('receita') || type.includes('credito') ? 'income' : 'expense',
    }
  }).filter(r => r.date && r.amount > 0)
}

function showCSVPreview(rows) {
  const preview = document.getElementById('csvPreview')
  if (!preview) return
  if (!rows.length) {
    preview.style.display = 'block'
    preview.innerHTML = `<div class="empty-state" style="padding:20px"><p>Nenhuma linha válida encontrada</p></div>`
    return
  }

  preview.style.display = 'block'
  preview.innerHTML = `
    <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:8px">${rows.length} linhas encontradas</div>
    <div style="max-height:240px;overflow-y:auto;border:1px solid var(--color-border);border-radius:8px">
      ${rows.slice(0, 20).map(r => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--color-border);font-size:var(--text-xs)">
          <div>
            <div style="font-weight:500">${escHtml(r.description.slice(0, 40))}</div>
            <div style="color:var(--color-text-soft)">${r.date}</div>
          </div>
          <div class="${r.type === 'income' ? 'value-positive' : 'value-negative'}" style="font-family:var(--font-mono);font-weight:600">
            ${r.type === 'income' ? '+' : '-'}${fmt.currency(r.amount)}
          </div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" id="csvImportBtn">✅ Importar ${rows.length} lançamentos</button>
      <button class="btn btn-secondary btn-sm" id="csvCancelBtn">Cancelar</button>
    </div>
  `

  preview.querySelector('#csvCancelBtn')?.addEventListener('click', () => { preview.style.display = 'none' })
  preview.querySelector('#csvImportBtn')?.addEventListener('click', async (e) => {
    Loading.btn(e.target, true)
    let imported = 0
    for (const r of rows) {
      try {
        await endpoints.createTx({ description: r.description, amount: r.amount, type: r.type, due_date: r.date, status: 'confirmed' })
        imported++
      } catch {}
    }
    Toast.success(`${imported} lançamentos importados`)
    preview.style.display = 'none'
  })
}

// ---------- SMS ----------
const SMS_EXAMPLES = {
  nubank:       'Nubank: Compra aprovada de R$89,90 em IFOOD*PEDIDO em 23/05/2026.',
  itau:         'Itaú: Compra de R$ 245,00 aprovada no cartão 1234 em POSTO IPIRANGA em 23/05.',
  bradesco:     'Bradesco: Compra de R$67,50 no cartão final 5678 em FARMACIA PACHECO.',
  inter:        'Inter: Compra aprovada! R$ 150,00 em MERCADO LIVRE*SELLER 23/05/2026.',
  caixa:        'CAIXA: Compra de R$1.290,00 aprovada em MAGAZINE LUIZA em 23/05/2026 ás 14h32.',
  santander:    'Santander: Compra de R$ 32,00 no cartão final 9012 em RAPPI RESTAURANTES.',
  bb:           'BB: Compra R$58,90 cartão 3456 SUPERMERCADO EXTRA 23/05/2026 14:31h aprovada.',
  'pix-recebido': 'Nubank: PIX recebido de João Silva R$ 200,00 em 23/05/2026.',
  'pix-enviado':  'Nubank: PIX de R$ 150,00 enviado para Maria Souza em 23/05/2026.',
}

function parseSMSText(text) {
  const result = { amount: null, date: null, description: null, type: 'expense', bank: null }

  // Detectar banco
  const bankMap = [
    [/nubank/i, 'Nubank'], [/itaú|itau/i, 'Itaú'], [/bradesco/i, 'Bradesco'],
    [/inter\b/i, 'Inter'], [/caixa/i, 'Caixa'], [/santander/i, 'Santander'],
    [/banco do brasil|bb\b/i, 'Banco do Brasil'], [/c6 bank/i, 'C6 Bank'],
    [/neon/i, 'Neon'], [/mercado pago/i, 'Mercado Pago'], [/picpay/i, 'PicPay'],
  ]
  for (const [re, name] of bankMap) {
    if (re.test(text)) { result.bank = name; break }
  }

  // Valor: R$ 1.234,56 ou R$1234,56 ou R$ 1.234.56
  const amtMatch = text.match(/R\$\s*([\d]{1,3}(?:[.\s]?\d{3})*(?:[,\.]\d{2}))/i)
  if (amtMatch) {
    const raw = amtMatch[1].replace(/\./g, '').replace(',', '.')
    result.amount = parseFloat(raw)
  }

  // Data: dd/mm/yyyy ou dd/mm/yy ou dd/mm
  const dateMatch = text.match(/(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/)
  if (dateMatch) {
    const d = dateMatch[1], m = dateMatch[2]
    let y = dateMatch[3]
    if (!y) y = new Date().getFullYear().toString()
    else if (y.length === 2) y = '20' + y
    result.date = `${y}-${m}-${d}`
  }

  // Tipo — PIX recebido, crédito, pagamento recebido
  const incomeRe = /pix recebido|pix creditado|crédito em conta|pagamento recebido|depósito|salário/i
  const expenseRe = /compra|débito|pix enviado|transferência enviada|pagamento efetuado|saque/i
  if (incomeRe.test(text)) result.type = 'income'
  else if (expenseRe.test(text)) result.type = 'expense'

  // Descrição — estabelecimento / destinatário
  const patterns = [
    // PIX — "de João Silva" / "para Maria Souza"
    /pix (?:recebido )?de ([A-ZÀ-Ú][a-zà-ú]+(?: [A-ZÀ-Ú][a-zà-ú]+)+)/i,
    /pix de [R$\d,.]+ (?:enviado )?para ([A-ZÀ-Ú][a-zà-ú]+(?: [A-ZÀ-Ú][a-zà-ú]+)+)/i,
    // "em ESTABELECIMENTO" / "no ESTABELECIMENTO" / "na ESTABELECIMENTO"
    /(?:em|no|na)\s+([A-ZÀÁÉÍÓÚ*][A-ZÀ-Ú0-9\s*\-\.]{2,40}?)(?:\s+\d{2}\/|\s*[.,!]|$)/,
    // Itaú e similares: "em NOME em dd/mm"
    /aprovad[ao]\s+(?:no\s+cartão\s+\d+\s+)?em\s+([A-Z][A-ZÁÉÍÓÚ\s*\.]{3,40}?)(?:\s+em\s+\d|\s*\.|$)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      result.description = m[1].trim().replace(/\s+/g, ' ')
      break
    }
  }

  // Fallback: usar nome do banco como prefixo
  if (!result.description) {
    result.description = result.bank
      ? `${result.type === 'income' ? 'Receita' : 'Compra'} ${result.bank}`
      : (result.type === 'income' ? 'Receita importada' : 'Compra importada')
  }

  return result
}

function attachSMSEvents(el) {
  el.querySelector('#smsParseBtn')?.addEventListener('click', () => parseSMS())
  el.querySelector('#smsClearBtn')?.addEventListener('click', () => {
    const inp = document.getElementById('smsInput')
    const res = document.getElementById('smsResult')
    if (inp) inp.value = ''
    if (res) res.style.display = 'none'
  })

  // Exemplos por banco
  el.querySelectorAll('[data-example]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById('smsInput')
      if (inp) {
        inp.value = SMS_EXAMPLES[btn.dataset.example] || ''
        inp.focus()
      }
    })
  })
}

function parseSMS() {
  const text = document.getElementById('smsInput')?.value?.trim()
  if (!text) { Toast.error('Cole um SMS para processar'); return }

  const result = parseSMSText(text)
  const resEl = document.getElementById('smsResult')
  if (!resEl) return
  resEl.style.display = 'block'

  if (!result.amount) {
    resEl.innerHTML = `
      <div style="padding:12px;background:var(--color-red-dim);border-radius:8px;font-size:var(--text-sm)">
        ⚠️ Não foi possível extrair o valor. Verifique se o SMS contém um valor no formato R$XX,XX.
      </div>`
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  resEl.innerHTML = `
    <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-4)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:var(--text-sm);font-weight:600">Dados extraídos</span>
        ${result.bank ? `<span class="badge badge-gray">${result.bank}</span>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <input id="smsDesc" class="form-control" value="${escHtml(result.description)}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Valor</label>
          <div style="display:flex;align-items:center;gap:4px">
            <span style="color:var(--color-text-soft);font-size:var(--text-sm)">R$</span>
            <input id="smsAmount" class="form-control" type="number" step="0.01" value="${result.amount}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input id="smsDate" class="form-control" type="date" value="${result.date || today}">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Tipo</label>
        <select id="smsType" class="form-control">
          <option value="expense" ${result.type === 'expense' ? 'selected' : ''}>Despesa</option>
          <option value="income"  ${result.type === 'income'  ? 'selected' : ''}>Receita</option>
        </select>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="smsSaveBtn">💾 Criar lançamento</button>
        <button class="btn btn-secondary btn-sm" id="smsCancelBtn">Cancelar</button>
      </div>
    </div>
  `

  resEl.querySelector('#smsCancelBtn')?.addEventListener('click', () => {
    resEl.style.display = 'none'
    document.getElementById('smsInput').value = ''
  })

  resEl.querySelector('#smsSaveBtn')?.addEventListener('click', async (e) => {
    const desc   = document.getElementById('smsDesc')?.value?.trim()
    const amount = Number(document.getElementById('smsAmount')?.value)
    const txDate = document.getElementById('smsDate')?.value
    const type   = document.getElementById('smsType')?.value
    if (!amount || amount <= 0) { Toast.error('Valor inválido'); return }
    Loading.btn(e.target, true)
    try {
      await endpoints.createTx({ description: desc || 'SMS importado', amount, type, due_date: txDate, status: 'confirmed' })
      Toast.success('Lançamento criado')
      resEl.style.display = 'none'
      document.getElementById('smsInput').value = ''
    } catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}

// ---------- Calculadora ----------
function attachCalcEvents(el) {
  el.querySelector('#calcBtn')?.addEventListener('click', runCalc)
  el.querySelectorAll('#calcPrincipal,#calcMonthly,#calcRate,#calcYears').forEach(inp => {
    inp.addEventListener('input', () => {
      const res = document.getElementById('calcResult')
      if (res?.style.display === 'block') runCalc()
    })
  })
}

function runCalc() {
  const principal = parseFloat(document.getElementById('calcPrincipal')?.value) || 0
  const monthly   = parseFloat(document.getElementById('calcMonthly')?.value) || 0
  const rateAA    = parseFloat(document.getElementById('calcRate')?.value) || 0
  const years     = parseInt(document.getElementById('calcYears')?.value) || 1
  const applyIR   = document.getElementById('calcIRPF')?.checked

  const months    = years * 12
  const rateMM    = Math.pow(1 + rateAA / 100, 1 / 12) - 1

  let total = principal
  for (let i = 0; i < months; i++) {
    total = total * (1 + rateMM) + monthly
  }

  const invested = principal + monthly * months
  const gross    = total
  const gain     = gross - invested
  const ir       = applyIR ? gain * 0.15 : 0
  const net      = gross - ir

  const resEl = document.getElementById('calcResult')
  if (!resEl) return
  resEl.style.display = 'block'
  resEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="padding:12px;background:var(--color-card-hover);border-radius:8px">
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:4px">Total investido</div>
        <div style="font-family:var(--font-mono);font-size:var(--text-lg);font-weight:700">${fmt.currency(invested)}</div>
      </div>
      <div style="padding:12px;background:var(--color-green-dim);border-radius:8px">
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:4px">Valor final ${applyIR ? '(líquido IR)' : ''}</div>
        <div style="font-family:var(--font-mono);font-size:var(--text-lg);font-weight:700;color:var(--color-green)">${fmt.currency(net)}</div>
      </div>
      <div style="padding:12px;background:var(--color-card-hover);border-radius:8px">
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:4px">Rendimento bruto</div>
        <div style="font-family:var(--font-mono);font-size:var(--text-md);font-weight:600;color:var(--color-green)">+${fmt.currency(gain)}</div>
      </div>
      <div style="padding:12px;background:var(--color-card-hover);border-radius:8px">
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:4px">Rentabilidade total</div>
        <div style="font-family:var(--font-mono);font-size:var(--text-md);font-weight:600;color:var(--color-green)">+${invested > 0 ? fmt.percent(((net - invested) / invested) * 100) : '0%'}</div>
      </div>
    </div>
    ${applyIR ? `<div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-top:8px">IR retido: ${fmt.currency(ir)} (15% sobre ganhos)</div>` : ''}
  `
}

// ---------- Histórico de exclusões ----------
async function loadAuditLog() {
  const el = document.getElementById('auditLogBody')
  if (!el) return
  try {
    const logs = await endpoints.auditLog()
    if (!logs.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗑️</div><p class="empty-state-msg">Nenhuma exclusão registrada</p></div>`
      return
    }
    el.innerHTML = logs.map(log => {
      const snap = log.transaction_data || {}
      const deletedAt = new Date(log.performed_at).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--text-sm);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(snap.description || 'Sem descrição')}</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Excluído em ${deletedAt} · ${snap.due_date || ''}</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--color-red);flex-shrink:0">
            -${fmt.currency(snap.amount || 0)}
          </div>
          <button class="btn btn-secondary btn-sm" data-restore-id="${log.id}" style="flex-shrink:0">↩ Restaurar</button>
        </div>
      `
    }).join('')

    el.querySelectorAll('[data-restore-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        Loading.btn(e.target, true)
        try {
          await endpoints.restoreTx({ audit_id: btn.dataset.restoreId })
          Toast.success('Lançamento restaurado')
          loadAuditLog()
        } catch (err) {
          Toast.error(err.message)
          Loading.btn(e.target, false)
        }
      })
    })
  } catch {
    el.innerHTML = `<div class="empty-state"><p class="empty-state-msg">Erro ao carregar histórico</p></div>`
  }
}

// ---------- Histórico Coach ----------
async function loadCoachHistory() {
  const el = document.getElementById('coachHistoryBody')
  if (!el) return
  try {
    const msgs = await endpoints.coachHistory()
    if (!msgs.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-title">Sem histórico</div><p class="empty-state-msg">Suas conversas com o Coach Finn aparecerão aqui</p></div>`
      return
    }
    const grouped = []
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'user') grouped.push({ user: msgs[i].content, assistant: msgs[i + 1]?.content || '' })
    }
    el.innerHTML = grouped.slice(-10).reverse().map(g => `
      <div class="card" style="margin-bottom:8px;padding:12px">
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:4px">Você perguntou:</div>
        <div style="font-size:var(--text-sm);font-weight:500;margin-bottom:8px">${escHtml(g.user)}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:4px">Coach Finn respondeu:</div>
        <div style="font-size:var(--text-sm);color:var(--color-text-soft)">${escHtml(g.assistant.slice(0, 200))}${g.assistant.length > 200 ? '…' : ''}</div>
      </div>
    `).join('')
  } catch {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><p class="empty-state-msg">Sem histórico disponível</p></div>`
  }
}

// ---------- PDF Import ----------
function attachPDFEvents(el) {
  const setupDropzone = (dropzoneId, fileInputId, handler) => {
    const dropzone = el.querySelector(`#${dropzoneId}`)
    const fileInput = el.querySelector(`#${fileInputId}`)
    dropzone?.addEventListener('click', () => fileInput?.click())
    dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--color-green)' })
    dropzone?.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--color-border)' })
    dropzone?.addEventListener('drop', e => {
      e.preventDefault()
      dropzone.style.borderColor = 'var(--color-border)'
      const file = e.dataTransfer?.files[0]
      if (file) handler(file)
    })
    fileInput?.addEventListener('change', () => { if (fileInput.files[0]) handler(fileInput.files[0]) })
  }

  setupDropzone('invoiceDropzone', 'invoiceFile', importInvoicePDF)
  setupDropzone('receiptDropzone', 'receiptFile', importReceiptFile)
}

async function loadPDFjs() {
  if (window.pdfjsLib) return window.pdfjsLib
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  return window.pdfjsLib
}

async function extractPDFText(file) {
  const pdfjs = await loadPDFjs()
  const ab = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: ab }).promise
  let text = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(it => it.str).join(' ') + '\n'
  }
  return text
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseInvoiceTextManually(text) {
  const txs = []
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean)
  const amtRe = /R?\$?\s*([\d]{1,3}(?:[.\s]?\d{3})*[,]\d{2})/
  const dateRe = /(\d{2})[\/\-](\d{2})[\/\-]?(\d{2,4})?/
  for (const line of lines) {
    const amtMatch = line.match(amtRe)
    const dateMatch = line.match(dateRe)
    if (!amtMatch || !dateMatch) continue
    const raw = amtMatch[1].replace(/\./g, '').replace(',', '.')
    const amount = parseFloat(raw)
    if (!amount || amount <= 0 || amount > 100000) continue
    const d = dateMatch[1], m = dateMatch[2]
    let y = dateMatch[3] || new Date().getFullYear().toString()
    if (y.length === 2) y = '20' + y
    const date = `${y}-${m}-${d}`
    const desc = line.replace(amtRe, '').replace(dateRe, '').replace(/[R$\s]+/g, ' ').trim().slice(0, 60) || 'Fatura importada'
    txs.push({ date, description: desc, amount, type: 'expense' })
  }
  return txs.slice(0, 100)
}

async function importInvoicePDF(file) {
  const previewEl = document.getElementById('invoicePreview')
  if (!previewEl) return
  previewEl.style.display = 'block'
  previewEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--color-card-hover);border-radius:8px;font-size:var(--text-sm)"><span style="animation:spin 1s linear infinite;display:inline-block">⏳</span> Analisando fatura...</div>`

  try {
    const text = await extractPDFText(file)
    let txs = []
    try {
      const resp = await endpoints.coachParseInvoice(text)
      if (!resp.mock) txs = resp.transactions || []
    } catch {}
    if (!txs.length) txs = parseInvoiceTextManually(text)

    if (!txs.length) {
      previewEl.innerHTML = `<div style="padding:12px;background:var(--color-red-dim);border-radius:8px;font-size:var(--text-sm)">⚠️ Nenhuma transação encontrada na fatura. Verifique se o PDF é legível.</div>`
      return
    }
    showPDFImportPreview(txs, 'invoicePreview')
  } catch (e) {
    previewEl.innerHTML = `<div style="padding:12px;background:var(--color-red-dim);border-radius:8px;font-size:var(--text-sm)">⚠️ Erro ao processar: ${escHtml(e.message)}</div>`
  }
}

async function importReceiptFile(file) {
  const previewEl = document.getElementById('receiptPreview')
  if (!previewEl) return
  previewEl.style.display = 'block'
  previewEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--color-card-hover);border-radius:8px;font-size:var(--text-sm)"><span style="animation:spin 1s linear infinite;display:inline-block">⏳</span> Analisando comprovante...</div>`

  try {
    let tx = null
    if (file.type === 'application/pdf') {
      const text = await extractPDFText(file)
      try {
        const resp = await endpoints.coachParseReceipt(text)
        if (!resp.mock) tx = resp.transaction
      } catch {}
    } else if (file.type.startsWith('image/')) {
      try {
        const base64 = await fileToBase64(file)
        const resp = await endpoints.coachParseReceiptImage(base64, file.type)
        if (!resp.mock) tx = resp.transaction
      } catch {}
    }

    if (!tx) {
      previewEl.innerHTML = `<div style="padding:12px;background:var(--color-red-dim);border-radius:8px;font-size:var(--text-sm)">⚠️ Não foi possível extrair os dados. Verifique se o arquivo é legível e se o Coach IA está configurado.</div>`
      return
    }
    showPDFImportPreview([tx], 'receiptPreview')
  } catch (e) {
    previewEl.innerHTML = `<div style="padding:12px;background:var(--color-red-dim);border-radius:8px;font-size:var(--text-sm)">⚠️ Erro ao processar: ${escHtml(e.message)}</div>`
  }
}

function showPDFImportPreview(txs, previewId) {
  const previewEl = document.getElementById(previewId)
  if (!previewEl) return

  previewEl.style.display = 'block'
  previewEl.innerHTML = `
    <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:8px">${txs.length} transação${txs.length !== 1 ? 'ões' : ''} encontrada${txs.length !== 1 ? 's' : ''}</div>
    <div style="max-height:240px;overflow-y:auto;border:1px solid var(--color-border);border-radius:8px">
      ${txs.slice(0, 30).map((t, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--color-border);font-size:var(--text-xs)">
          <div style="flex:1;min-width:0;margin-right:8px">
            <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml((t.description || '').slice(0, 50))}</div>
            <div style="color:var(--color-text-soft)">${t.date || ''}${t.category_hint ? ` · ${escHtml(t.category_hint)}` : ''}</div>
          </div>
          <div class="${(t.type || 'expense') === 'income' ? 'value-positive' : 'value-negative'}" style="font-family:var(--font-mono);font-weight:600;flex-shrink:0">
            ${(t.type || 'expense') === 'income' ? '+' : '-'}${fmt.currency(t.amount)}
          </div>
        </div>
      `).join('')}
      ${txs.length > 30 ? `<div style="padding:8px 12px;font-size:var(--text-xs);color:var(--color-text-soft);text-align:center">...e mais ${txs.length - 30} transações</div>` : ''}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" id="${previewId}ImportBtn">✅ Importar ${txs.length} lançamento${txs.length !== 1 ? 's' : ''}</button>
      <button class="btn btn-secondary btn-sm" id="${previewId}CancelBtn">Cancelar</button>
    </div>
  `

  previewEl.querySelector(`#${previewId}CancelBtn`)?.addEventListener('click', () => { previewEl.style.display = 'none' })
  previewEl.querySelector(`#${previewId}ImportBtn`)?.addEventListener('click', async (e) => {
    Loading.btn(e.target, true)
    let imported = 0, errors = 0
    for (const t of txs) {
      try {
        await endpoints.createTx({
          description: t.description || 'Importado', amount: t.amount,
          type: t.type || 'expense', due_date: t.date, status: 'pending',
        })
        imported++
      } catch { errors++ }
    }
    if (errors > 0) Toast.error(`${imported} importados · ${errors} com erro`)
    else Toast.success(`${imported} lançamento${imported !== 1 ? 's' : ''} importado${imported !== 1 ? 's' : ''}`)
    previewEl.style.display = 'none'
  })
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
