-- 리포트 댓글 테이블
CREATE TABLE IF NOT EXISTS parking_report_comments (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES parking_app_feedback(id) ON DELETE CASCADE,
  profile_id BIGINT REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스: report_id 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_parking_report_comments_report_id ON parking_report_comments(report_id);
