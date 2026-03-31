/**
 * Gmail IMAP 파서: 충전 영수증 이메일에서 거래 정보 추출
 *
 * 필요한 환경 변수:
 *   EV_EMAIL_HOST  - IMAP 서버 주소 (기본: imap.gmail.com)
 *   EV_EMAIL_USER  - 이메일 주소
 *   EV_EMAIL_PASS  - 앱 비밀번호 (Gmail: 구글 계정 > 앱 비밀번호)
 *
 * 검색 조건: 충전 관련 발신자/제목 키워드로 필터링
 */

import Imap from 'imap'
import { simpleParser, ParsedMail } from 'mailparser'
import type { CardType, Provider } from './cardRules'

export interface ParsedTransaction {
  rawId: string      // Message-ID (중복 방지)
  date: Date
  provider: Provider
  cardType: CardType
  amount: number
  source: 'Email'
}

// 발신자/제목 → 충전사업자 매핑
const PROVIDER_PATTERNS: Array<{
  pattern: RegExp
  provider: Provider
}> = [
  { pattern: /환경부|me\.go\.kr|환경공단|KECO/i, provider: '환경부' },
  { pattern: /투루차저|turu|turucharger/i, provider: '투루차저' },
  { pattern: /차지비|charzin|chazip/i, provider: '차지비' },
]

// 이메일 본문에서 결제 금액 추출 (원, 한국 숫자 형식)
const AMOUNT_PATTERNS = [
  /결제\s*금액[:\s]*([0-9,]+)\s*원/,
  /충전\s*금액[:\s]*([0-9,]+)\s*원/,
  /이용\s*금액[:\s]*([0-9,]+)\s*원/,
  /청구\s*금액[:\s]*([0-9,]+)\s*원/,
  /([0-9,]+)\s*원\s*결제/,
  /KRW\s*([0-9,]+)/i,
]

// 카드사 → 카드 타입 매핑
const CARD_PATTERNS: Array<{ pattern: RegExp; cardType: CardType }> = [
  { pattern: /신한.*EV|EV.*신한|shinhan.*ev/i, cardType: 'Shinhan_EV' },
  { pattern: /BC.*그린|그린.*BC|BC.*green|green.*V3|어디로든/i, cardType: 'BC_Green_V3' },
]

function detectProvider(mail: ParsedMail): Provider | null {
  const fromAddress = typeof mail.from?.text === 'string' ? mail.from.text : ''
  const subject = mail.subject ?? ''
  const text = `${fromAddress} ${subject}`

  for (const { pattern, provider } of PROVIDER_PATTERNS) {
    if (pattern.test(text)) return provider
  }
  return null
}

function detectCardType(mail: ParsedMail): CardType | null {
  const body = (mail.text ?? '') + (mail.html ?? '')
  for (const { pattern, cardType } of CARD_PATTERNS) {
    if (pattern.test(body)) return cardType
  }
  return null
}

function extractAmount(mail: ParsedMail): number | null {
  const body = (mail.text ?? '') + (mail.html ?? '')
  for (const pattern of AMOUNT_PATTERNS) {
    const match = pattern.exec(body)
    if (match) {
      const cleaned = match[1].replace(/,/g, '')
      const amount = parseInt(cleaned, 10)
      if (!isNaN(amount) && amount > 0) return amount
    }
  }
  return null
}

function buildImapClient(): Imap {
  return new Imap({
    user: process.env.EV_EMAIL_USER ?? '',
    password: process.env.EV_EMAIL_PASS ?? '',
    host: process.env.EV_EMAIL_HOST ?? 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    authTimeout: 10_000,
  })
}

async function fetchRecentMails(since: Date): Promise<ParsedMail[]> {
  return new Promise((resolve, reject) => {
    const imap = buildImapClient()
    const mails: ParsedMail[] = []

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) { imap.end(); return reject(err) }

        imap.search(
          [
            ['SINCE', since],
            ['OR',
              ['FROM', '환경부'],
              ['OR', ['FROM', 'turu'], ['FROM', 'charzin']],
            ],
          ],
          (searchErr, uids) => {
            if (searchErr || !uids?.length) {
              imap.end()
              return searchErr ? reject(searchErr) : resolve([])
            }

            const f = imap.fetch(uids, { bodies: '' })
            f.on('message', (msg) => {
              let rawBuffer = Buffer.alloc(0)
              msg.on('body', (stream) => {
                stream.on('data', (chunk: Buffer) => {
                  rawBuffer = Buffer.concat([rawBuffer, chunk])
                })
                stream.once('end', () => {
                  simpleParser(rawBuffer)
                    .then((parsed) => mails.push(parsed))
                    .catch(() => {/* skip unparseable */})
                })
              })
            })
            f.once('error', (fetchErr) => { imap.end(); reject(fetchErr) })
            f.once('end', () => imap.end())
          },
        )
      })
    })

    imap.once('error', reject)
    imap.once('end', () => resolve(mails))
    imap.connect()
  })
}

/** 최근 N일 이내의 충전 이메일 파싱 */
export async function parseChargingEmails(daysBefore = 31): Promise<ParsedTransaction[]> {
  if (!process.env.EV_EMAIL_USER || !process.env.EV_EMAIL_PASS) {
    console.warn('[EV EmailParser] EV_EMAIL_USER or EV_EMAIL_PASS not set, skipping')
    return []
  }

  const since = new Date(Date.now() - daysBefore * 24 * 60 * 60 * 1000)
  const mails = await fetchRecentMails(since)

  const results: ParsedTransaction[] = []
  for (const mail of mails) {
    const provider = detectProvider(mail)
    const cardType = detectCardType(mail)
    const amount = extractAmount(mail)
    const rawId = mail.messageId ?? `${mail.date?.getTime()}-${mail.subject}`

    if (!provider || !cardType || !amount || !mail.date) continue

    results.push({
      rawId,
      date: mail.date,
      provider,
      cardType,
      amount,
      source: 'Email',
    })
  }

  return results
}
