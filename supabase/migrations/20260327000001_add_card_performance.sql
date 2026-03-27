-- 카드별 월간 실적 관리 테이블
-- 전월 실적이 있어야 당월 무료 주차 혜택 사용 가능
CREATE TABLE IF NOT EXISTS parking_card_performance (
  id BIGSERIAL PRIMARY KEY,
  card_id BIGINT NOT NULL REFERENCES parking_cards(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,       -- 실적 달성 월, 'YYYY-MM' 형식 (예: '2026-03')
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(card_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_parking_card_performance_card_id ON parking_card_performance(card_id);
CREATE INDEX IF NOT EXISTS idx_parking_card_performance_year_month ON parking_card_performance(year_month);
