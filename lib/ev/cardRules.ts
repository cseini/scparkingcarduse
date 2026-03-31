export type CardType = 'Shinhan_EV' | 'BC_Green_V3'
export type Provider = '환경부' | '투루차저' | '차지비'

export interface TierRule {
  minPerformance: number   // 전월실적 최소 금액 (원)
  maxPerformance: number   // 전월실적 최대 금액 (원, Infinity = 무제한)
  rate: number             // 할인/적립 비율 (0.0 ~ 1.0)
  monthlyLimitWon: number  // 월 할인/적립 한도 (원)
}

export interface CardRule {
  cardType: CardType
  displayName: string
  benefitType: 'discount' | 'ecomoney'  // 청구할인 or 에코머니 포인트
  tiers: TierRule[]
  providers: Provider[]                 // 혜택 적용 가맹점
  pointValue: number                    // 포인트 1P 원화 가치 (할인형은 1.0)
}

export const CARD_RULES: Record<CardType, CardRule> = {
  Shinhan_EV: {
    cardType: 'Shinhan_EV',
    displayName: '신한카드 EV',
    benefitType: 'discount',
    pointValue: 1.0,
    providers: ['환경부', '투루차저', '차지비'],
    tiers: [
      {
        minPerformance: 300_000,
        maxPerformance: 599_999,
        rate: 0.30,
        monthlyLimitWon: 20_000,
      },
      {
        minPerformance: 600_000,
        maxPerformance: Infinity,
        rate: 0.50,
        monthlyLimitWon: 20_000,
      },
    ],
  },

  BC_Green_V3: {
    cardType: 'BC_Green_V3',
    displayName: 'BC 어디로든 그린카드 V3',
    benefitType: 'ecomoney',
    pointValue: 1.0,  // 1 에코머니 포인트 = 1원으로 취급
    providers: ['환경부', '투루차저', '차지비'],
    tiers: [
      {
        minPerformance: 300_000,
        maxPerformance: 599_999,
        rate: 0.20,
        monthlyLimitWon: 20_000,
      },
      {
        minPerformance: 600_000,
        maxPerformance: Infinity,
        rate: 0.40,
        monthlyLimitWon: 20_000,
      },
    ],
  },
}

export const PROVIDERS: Provider[] = ['환경부', '투루차저', '차지비']
export const CARD_TYPES: CardType[] = ['Shinhan_EV', 'BC_Green_V3']

/** 전월실적 기준 적용 티어 반환 (없으면 null = 혜택 없음) */
export function getActiveTier(cardType: CardType, lastPerformance: number): TierRule | null {
  const rule = CARD_RULES[cardType]
  for (const tier of [...rule.tiers].reverse()) {
    if (lastPerformance >= tier.minPerformance) return tier
  }
  return null
}
