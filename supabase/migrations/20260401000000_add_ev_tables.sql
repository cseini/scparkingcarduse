-- EV 충전 트랜잭션 테이블
CREATE TABLE IF NOT EXISTS ev_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL,       -- 환경부 | 투루차저 | 차지비
  card_type TEXT NOT NULL,      -- Shinhan_EV | BC_Green_V3
  amount INT NOT NULL,          -- 결제금액 (원)
  is_discounted BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL,         -- Email | Scraper | Manual
  raw_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ev_transactions_raw_id_unique UNIQUE (raw_id)
);

CREATE INDEX IF NOT EXISTS idx_ev_transactions_date ON ev_transactions(date);
CREATE INDEX IF NOT EXISTS idx_ev_transactions_card_type ON ev_transactions(card_type);
CREATE INDEX IF NOT EXISTS idx_ev_transactions_provider ON ev_transactions(provider);

-- EV 카드 상태 테이블 (당월 실적/잔여 한도)
CREATE TABLE IF NOT EXISTS ev_card_status (
  card_type TEXT PRIMARY KEY,   -- Shinhan_EV | BC_Green_V3
  last_performance INT NOT NULL DEFAULT 0,   -- 전월 실적 기반
  current_spend INT NOT NULL DEFAULT 0,      -- 당월 누적 충전금액
  remaining_limit INT NOT NULL DEFAULT 20000, -- 당월 잔여 할인/적립 한도
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 카드 상태 초기화
INSERT INTO ev_card_status (card_type, last_performance, current_spend, remaining_limit)
VALUES
  ('Shinhan_EV', 0, 0, 20000),
  ('BC_Green_V3', 0, 0, 20000)
ON CONFLICT (card_type) DO NOTHING;
