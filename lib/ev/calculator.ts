import { CardType, getActiveTier, CARD_RULES } from './cardRules'

export interface BenefitResult {
  cardType: CardType
  displayName: string
  benefitType: 'discount' | 'ecomoney'
  rate: number             // 적용 비율 (0 = 혜택 없음)
  estimatedBenefit: number // 예상 할인/적립 금액 (원)
  remainingLimit: number   // 이 결제 후 남을 한도
  tierLabel: string        // 예: "30% 할인", "혜택 없음"
}

/**
 * 단일 충전 결제에 대한 카드별 예상 혜택 계산
 * @param cardType 카드 종류
 * @param chargeAmount 충전 결제 금액 (원)
 * @param lastPerformance 전월 실적 (원)
 * @param currentRemainingLimit 당월 잔여 할인/적립 한도 (원)
 */
export function calculateBenefit(
  cardType: CardType,
  chargeAmount: number,
  lastPerformance: number,
  currentRemainingLimit: number,
): BenefitResult {
  const rule = CARD_RULES[cardType]
  const tier = getActiveTier(cardType, lastPerformance)

  if (!tier || currentRemainingLimit <= 0) {
    return {
      cardType,
      displayName: rule.displayName,
      benefitType: rule.benefitType,
      rate: 0,
      estimatedBenefit: 0,
      remainingLimit: currentRemainingLimit,
      tierLabel: tier != null ? '한도 소진' : '혜택 없음 (실적 부족)',
    }
  }

  const rawBenefit = Math.floor(chargeAmount * tier.rate)
  const estimatedBenefit = Math.min(rawBenefit, currentRemainingLimit)
  const remainingLimit = currentRemainingLimit - estimatedBenefit

  return {
    cardType,
    displayName: rule.displayName,
    benefitType: rule.benefitType,
    rate: tier.rate,
    estimatedBenefit,
    remainingLimit,
    tierLabel: `${(tier.rate * 100).toFixed(0)}% ${rule.benefitType === 'discount' ? '청구할인' : '에코머니 적립'}`,
  }
}

/** 월별 총 예상 혜택 집계 */
export function aggregateMonthlyBenefits(
  transactions: Array<{ amount: number; cardType: CardType }>,
  lastPerformance: number,
  cardType: CardType,
) {
  const rule = CARD_RULES[cardType]
  const tier = getActiveTier(cardType, lastPerformance)
  if (!tier) return { totalBenefit: 0, totalSpend: 0, remainingLimit: 0 }

  let usedLimit = 0
  let totalSpend = 0
  for (const tx of transactions) {
    if (tx.cardType !== cardType) continue
    totalSpend += tx.amount
    if (usedLimit < tier.monthlyLimitWon) {
      const rawBenefit = Math.floor(tx.amount * tier.rate)
      const benefit = Math.min(rawBenefit, tier.monthlyLimitWon - usedLimit)
      usedLimit += benefit
    }
  }

  return {
    totalBenefit: usedLimit,
    totalSpend,
    remainingLimit: Math.max(0, tier.monthlyLimitWon - usedLimit),
  }
}

/** 전월 실적 구간 레이블 */
export function getPerformanceTierLabel(cardType: CardType, lastPerformance: number): string {
  const tier = getActiveTier(cardType, lastPerformance)
  if (!tier) return '실적 부족 (30만원 미만)'
  return `${(tier.rate * 100).toFixed(0)}% 구간 (${(tier.minPerformance / 10000).toFixed(0)}만원 이상)`
}
