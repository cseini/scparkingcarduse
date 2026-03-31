/**
 * Playwright 기반 웹 스크래퍼
 *
 * 지원 대상:
 *  1. 신한카드 EV - 전월실적, 당월 한도 소진 현황
 *  2. BC 어디로든 그린카드 V3 - 전월실적, 당월 에코머니 적립 현황
 *  3. 환경부 충전서비스 마이페이지 - 충전 이용내역
 *  4. 투루차저 마이페이지 - 충전 이용내역
 *  5. 차지비(Charzin) 마이페이지 - 충전 이용내역
 *
 * 필요한 환경 변수:
 *   SHINHAN_USER_ID / SHINHAN_PASSWORD
 *   BC_USER_ID / BC_PASSWORD
 *   ENV_CHARGE_USER_ID / ENV_CHARGE_PASSWORD  (환경부 충전서비스)
 *   TURU_USER_ID / TURU_PASSWORD
 *   CHARZIN_USER_ID / CHARZIN_PASSWORD
 *
 * ⚠️  주의사항:
 *   - 카드사/충전사 웹사이트 구조 변경 시 셀렉터 업데이트 필요
 *   - 2FA/캡차 대응이 필요할 수 있음
 *   - playwright 패키지 및 브라우저 바이너리가 설치되어 있어야 함
 *     (`npx playwright install chromium`)
 */

import type { CardType, Provider } from './cardRules'

export interface ScrapedTransaction {
  rawId: string
  date: Date
  provider: Provider
  cardType: CardType
  amount: number
  source: 'Scraper'
}

export interface ScrapedCardStatus {
  cardType: CardType
  lastPerformance: number
  currentSpend: number
  remainingLimit: number
}

type BrowserType = any
type PageType = any

async function launchBrowser(): Promise<{ browser: BrowserType; page: PageType }> {
  let chromium: any
  try {
    // playwright is an optional peer dependency; import at runtime to avoid hard failure when not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ chromium } = require('playwright'))
  } catch {
    throw new Error('playwright is not installed. Run: npx playwright install chromium')
  }
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' })
  return { browser, page }
}

/* ─────────────────────────────────────────────
   신한카드 EV – 전월 실적 & 당월 한도 현황
───────────────────────────────────────────── */
async function scrapeShinhanCardStatus(): Promise<ScrapedCardStatus | null> {
  if (!process.env.SHINHAN_USER_ID || !process.env.SHINHAN_PASSWORD) {
    console.warn('[EV Scraper] SHINHAN credentials not set, skipping')
    return null
  }

  const { browser, page } = await launchBrowser()
  try {
    // 1. 로그인
    await page.goto('https://www.shinhancard.com/pconts/html/common/contents/SHCS_CMCT_0001.html', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.fill('#loginId', process.env.SHINHAN_USER_ID)
    await page.fill('#loginPwd', process.env.SHINHAN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ timeout: 15_000 })

    // 2. EV 카드 혜택 현황 페이지 이동 (URL은 실제 구조에 따라 조정 필요)
    await page.goto('https://www.shinhancard.com/pconts/html/benefit/usage/SHCS_BFUS_0001.html', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // 3. 전월실적 파싱 (실제 셀렉터로 교체 필요)
    const lastPerfText = await page.$eval('.last-performance-amount', (el: Element) => el.textContent ?? '0').catch(() => '0')
    const lastPerformance = parseInt(lastPerfText.replace(/[^0-9]/g, ''), 10) || 0

    // 4. 당월 할인 한도 파싱
    const remainingText = await page.$eval('.remaining-discount-amount', (el: Element) => el.textContent ?? '20000').catch(() => '20000')
    const remainingLimit = parseInt(remainingText.replace(/[^0-9]/g, ''), 10) || 20_000

    const currentSpendText = await page.$eval('.current-spend-amount', (el: Element) => el.textContent ?? '0').catch(() => '0')
    const currentSpend = parseInt(currentSpendText.replace(/[^0-9]/g, ''), 10) || 0

    return { cardType: 'Shinhan_EV', lastPerformance, currentSpend, remainingLimit }
  } catch (err) {
    console.error('[EV Scraper] Shinhan scrape failed:', err)
    return null
  } finally {
    await browser.close()
  }
}

/* ─────────────────────────────────────────────
   BC 어디로든 그린카드 V3 – 전월 실적 & 에코머니 현황
───────────────────────────────────────────── */
async function scrapeBCCardStatus(): Promise<ScrapedCardStatus | null> {
  if (!process.env.BC_USER_ID || !process.env.BC_PASSWORD) {
    console.warn('[EV Scraper] BC credentials not set, skipping')
    return null
  }

  const { browser, page } = await launchBrowser()
  try {
    // 1. 페이북(BC 마이페이지) 로그인
    await page.goto('https://www.paybooc.co.kr/app/account/Login.do', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.fill('#userId', process.env.BC_USER_ID)
    await page.fill('#userPwd', process.env.BC_PASSWORD)
    await page.click('#btnLogin')
    await page.waitForNavigation({ timeout: 15_000 })

    // 2. 에코머니 현황 페이지 (실제 URL로 조정 필요)
    await page.goto('https://www.paybooc.co.kr/app/ecomoney/EcomoneySummary.do', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // 3. 전월실적 파싱
    const lastPerfText = await page.$eval('.prev-month-performance', (el: Element) => el.textContent ?? '0').catch(() => '0')
    const lastPerformance = parseInt(lastPerfText.replace(/[^0-9]/g, ''), 10) || 0

    // 4. 당월 에코머니 적립 한도 잔액
    const remainingText = await page.$eval('.remaining-ecomoney', (el: Element) => el.textContent ?? '20000').catch(() => '20000')
    const remainingLimit = parseInt(remainingText.replace(/[^0-9]/g, ''), 10) || 20_000

    const currentSpendText = await page.$eval('.current-charge-spend', (el: Element) => el.textContent ?? '0').catch(() => '0')
    const currentSpend = parseInt(currentSpendText.replace(/[^0-9]/g, ''), 10) || 0

    return { cardType: 'BC_Green_V3', lastPerformance, currentSpend, remainingLimit }
  } catch (err) {
    console.error('[EV Scraper] BC scrape failed:', err)
    return null
  } finally {
    await browser.close()
  }
}

/* ─────────────────────────────────────────────
   충전사 이용내역 스크래핑 (공통 헬퍼)
───────────────────────────────────────────── */
interface ChargeRecord {
  date: Date
  amount: number
  rawId: string
}

async function scrapeProviderHistory(
  loginUrl: string,
  historyUrl: string,
  userId: string,
  password: string,
  userIdSelector: string,
  passwordSelector: string,
  submitSelector: string,
  rowSelector: string,
  parseRow: (row: any) => Promise<ChargeRecord | null>,
): Promise<ChargeRecord[]> {
  const { browser, page } = await launchBrowser()
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.fill(userIdSelector, userId)
    await page.fill(passwordSelector, password)
    await page.click(submitSelector)
    await page.waitForNavigation({ timeout: 15_000 })

    await page.goto(historyUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const rows = await page.$$(rowSelector)
    const results: ChargeRecord[] = []
    for (const row of rows) {
      const record = await parseRow(row)
      if (record) results.push(record)
    }
    return results
  } catch (err) {
    console.error('[EV Scraper] Provider scrape failed:', err)
    return []
  } finally {
    await browser.close()
  }
}

/* ─────────────────────────────────────────────
   환경부 충전 서비스 이용내역
───────────────────────────────────────────── */
async function scrapeEnvMinistryHistory(cardType: CardType): Promise<ScrapedTransaction[]> {
  if (!process.env.ENV_CHARGE_USER_ID || !process.env.ENV_CHARGE_PASSWORD) {
    console.warn('[EV Scraper] ENV_CHARGE credentials not set, skipping')
    return []
  }

  const records = await scrapeProviderHistory(
    'https://ev.or.kr/evWeb/login.do',
    'https://ev.or.kr/evWeb/mypage/myChargeHistory.do',
    process.env.ENV_CHARGE_USER_ID,
    process.env.ENV_CHARGE_PASSWORD,
    '#userId',
    '#userPwd',
    '#btnLogin',
    'table.charge-history tbody tr',
    async (row: any) => {
      try {
        const cells = await row.$$('td')
        if (cells.length < 4) return null
        const dateText = await cells[0].textContent()
        const amountText = await cells[3].textContent()
        const date = new Date(dateText?.trim() ?? '')
        const amount = parseInt((amountText ?? '').replace(/[^0-9]/g, ''), 10)
        if (isNaN(date.getTime()) || !amount) return null
        return { date, amount, rawId: `env-${date.getTime()}-${amount}` }
      } catch {
        return null
      }
    },
  )

  return records.map((r) => ({ ...r, provider: '환경부' as Provider, cardType, source: 'Scraper' as const }))
}

/* ─────────────────────────────────────────────
   투루차저 이용내역
───────────────────────────────────────────── */
async function scrapeTuruHistory(cardType: CardType): Promise<ScrapedTransaction[]> {
  if (!process.env.TURU_USER_ID || !process.env.TURU_PASSWORD) {
    console.warn('[EV Scraper] TURU credentials not set, skipping')
    return []
  }

  const records = await scrapeProviderHistory(
    'https://www.turucharger.com/login',
    'https://www.turucharger.com/mypage/chargeHistory',
    process.env.TURU_USER_ID,
    process.env.TURU_PASSWORD,
    '#username',
    '#password',
    'button[type="submit"]',
    '.charge-history-item',
    async (row: any) => {
      try {
        const dateEl = await row.$('.charge-date')
        const amountEl = await row.$('.charge-amount')
        const dateText = await dateEl?.textContent()
        const amountText = await amountEl?.textContent()
        const date = new Date(dateText?.trim() ?? '')
        const amount = parseInt((amountText ?? '').replace(/[^0-9]/g, ''), 10)
        if (isNaN(date.getTime()) || !amount) return null
        return { date, amount, rawId: `turu-${date.getTime()}-${amount}` }
      } catch {
        return null
      }
    },
  )

  return records.map((r) => ({ ...r, provider: '투루차저' as Provider, cardType, source: 'Scraper' as const }))
}

/* ─────────────────────────────────────────────
   차지비 이용내역
───────────────────────────────────────────── */
async function scrapeCharzinHistory(cardType: CardType): Promise<ScrapedTransaction[]> {
  if (!process.env.CHARZIN_USER_ID || !process.env.CHARZIN_PASSWORD) {
    console.warn('[EV Scraper] CHARZIN credentials not set, skipping')
    return []
  }

  const records = await scrapeProviderHistory(
    'https://charzin.or.kr/user/login',
    'https://charzin.or.kr/user/mypage/useHistory',
    process.env.CHARZIN_USER_ID,
    process.env.CHARZIN_PASSWORD,
    '#id',
    '#pwd',
    '.login-btn',
    '.history-row',
    async (row: any) => {
      try {
        const dateEl = await row.$('.use-date')
        const amountEl = await row.$('.use-amount')
        const dateText = await dateEl?.textContent()
        const amountText = await amountEl?.textContent()
        const date = new Date(dateText?.trim() ?? '')
        const amount = parseInt((amountText ?? '').replace(/[^0-9]/g, ''), 10)
        if (isNaN(date.getTime()) || !amount) return null
        return { date, amount, rawId: `charzin-${date.getTime()}-${amount}` }
      } catch {
        return null
      }
    },
  )

  return records.map((r) => ({ ...r, provider: '차지비' as Provider, cardType, source: 'Scraper' as const }))
}

/* ─────────────────────────────────────────────
   공개 API
───────────────────────────────────────────── */

export async function scrapeAllCardStatuses(): Promise<ScrapedCardStatus[]> {
  const [shinhan, bc] = await Promise.allSettled([
    scrapeShinhanCardStatus(),
    scrapeBCCardStatus(),
  ])

  const results: ScrapedCardStatus[] = []
  if (shinhan.status === 'fulfilled' && shinhan.value) results.push(shinhan.value)
  if (bc.status === 'fulfilled' && bc.value) results.push(bc.value)
  return results
}

export async function scrapeAllProviderHistory(cardType: CardType): Promise<ScrapedTransaction[]> {
  const [env, turu, charzin] = await Promise.allSettled([
    scrapeEnvMinistryHistory(cardType),
    scrapeTuruHistory(cardType),
    scrapeCharzinHistory(cardType),
  ])

  return [
    ...(env.status === 'fulfilled' ? env.value : []),
    ...(turu.status === 'fulfilled' ? turu.value : []),
    ...(charzin.status === 'fulfilled' ? charzin.value : []),
  ]
}
