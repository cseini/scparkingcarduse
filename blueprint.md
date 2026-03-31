
# 주차 관리 앱 설계도

## 1. 개요

SC 제일은행 본점 주차장에서 4개의 신한 플래티넘 카드를 사용하여 월별 무료 주차(총 12회)를 효율적으로 관리하기 위한 웹 애플리케이션입니다. 사용자는 이 앱을 통해 각 카드별 남은 무료 주차 횟수를 쉽게 확인하고, 사용 내역을 기록하며, 월초에 모든 횟수를 초기화할 수 있습니다. **Supabase 데이터베이스를 연동하여 모든 사용 이력을 영구적으로 저장하고 여러 기기에서 동기화합니다.**

## 2. 프로젝트 상세

### 기능
- **프로필 기반 독립 관리:** '나', '와이프' 등 여러 프로필을 생성할 수 있으며, 각 프로필은 자신만의 카드 목록과 주차 이력을 독립적으로 관리합니다.
- **프로필별 카드 표시:** 선택된 프로필에 등록된 카드만 홈 화면에 표시됩니다.
- **프로필별 이력 필터링:** 캘린더에는 현재 선택된 프로필의 카드 사용 내역만 표시됩니다.
- **보안 (PIN 코드):** 각 프로필은 4자리 PIN 코드로 보호되어, 다른 사용자의 이력을 실수로 수정하는 것을 방지합니다.
- **남은 횟수 실시간 표시:** 각 카드별로 이번 달에 남은 무료 주차 횟수를 Supabase DB에서 실시간으로 가져와 보여줍니다.
- **주차 사용 기록:** '사용' 버튼을 클릭하면 Supabase DB에 사용 내역이 기록되고, 해당 카드의 남은 횟수가 1 차감됩니다.
- **프로필별 월초 초기화:** '월간 초기화' 버튼은 현재 선택된 프로필의 카드들만 3회로 즉시 리셋합니다. 다른 프로필의 카드에는 영향을 주지 않습니다.
- **사용 이력 추적:** 각 카드의 사용 날짜와 시간을 기록하여 월별 사용 내역을 캘린더에서 볼 수 있습니다.

- **일일 사용 제한:** 하루에 한 개의 카드만 사용할 수 있도록 제한하여 중복 사용을 방지합니다. 이미 사용한 날에 다른 카드를 사용하려고 하면 경고 메시지가 표시됩니다.
- **캘린더 UI 강화:** 사용된 카드가 캘린더 칸 중앙에 해당 카드의 고유 색상과 함께 큼직하게 표시되어 가독성을 높였습니다.
- **자동 월간 초기화:** 사용자가 별도로 초기화 버튼을 누를 필요 없이, 새로운 달(대한민국 표준시 기준)이 시작되면 시스템이 자동으로 각 카드의 남은 횟수를 3회로 리셋합니다.
- **대한민국 표준시(KST) 기준:** 모든 시간 계산 및 캘린더 표시는 `Asia/Seoul` 타임존을 기준으로 처리됩니다.
- **색상 중복 방지 팝업:** 카드 색상 선택 시 팝업 창을 통해 선택할 수 있으며, 현재 프로필에서 이미 사용 중인 색상은 선택할 수 없도록 비활성화됩니다.
- **버그 리포트 및 기능 제안:** 사용자가 앱 사용 중 겪는 불편함이나 개선 아이디어를 제출할 수 있는 전용 게시판 기능을 제공합니다.

### 데이터베이스 (Supabase)
- **테이블:** `profiles`
    - `id`: (PK, number)
    - `name`: (text) 프로필 이름
    - `pin_code`: (text) 4자리 핀코드
    - `last_reset_month`: (text) 마지막으로 자동 초기화가 수행된 월 (예: '2024-03')
- **테이블:** `parking_app_feedback`
    - `id`: (PK, number)
    - `profile_id`: (FK, profiles.id) 작성자 프로필 ID
    - `type`: (text) 'bug' 또는 'feature'
    - `content`: (text) 제보 내용
    - `created_at`: (timestamp) 작성 일시
- **테이블:** `parking_cards`
    - `id`: (PK, number) 고유 ID
    - `profile_id`: (FK, profiles.id) 소유 프로필 ID
    - `user_name`: (text) 카드 별칭 (예: '신한 플래티넘')
    - `remaining_uses`: (number) 남은 무료 주차 횟수
    - `last_used_at`: (timestamp) 마지막 사용 일시
    - `color`: (text) 카드 표시 색상
- **테이블:** `parking_usage_history`
    - `id`: (PK, number)
    - `card_id`: (FK, parking_cards.id) 사용된 카드 ID
    - `user_name`: (text) 당시 카드 이름 (스냅샷)
    - `used_at`: (timestamp) 사용 일시

## 3. 현재 진행 계획

1.  **`blueprint.md` 업데이트:** Supabase 연동 계획 반영 완료.
2.  **Supabase 패키지 설치:** `npm install @supabase/supabase-js` 명령어를 실행하여 Supabase 클라이언트 라이브러리를 설치합니다.
3.  **환경 변수 설정:** Supabase 프로젝트 URL과 `anon` 키를 안전하게 관리하기 위해 `.env.local` 파일을 생성하고 키를 추가합니다.
4.  **Supabase 클라이언트 설정:** Supabase와 통신할 수 있는 클라이언트 모듈(`lib/supabaseClient.ts`)을 생성합니다.
5.  **프로젝트 구조 변경:** 기존 `pages` 디렉토리 관련 파일을 삭제하고, App 라우터 방식인 `app/layout.tsx`와 `app/page.tsx`를 생성합니다.
6.  **UI 및 로직 구현:** `app/page.tsx`에 Supabase DB와 연동하여 데이터를 읽고 쓰는 로직과 핵심 UI를 구현합니다. (Server-Side Rendering 활용)
7.  **스타일링:** `globals.css`와 `styles/Home.module.css`를 수정하여 디자인을 적용합니다.

## 4. EV 충전 대시보드

### 개요
신한카드 EV, BC 어디로든 그린카드 V3 충전 내역 및 혜택 현황을 자동으로 수집하여 시각화하는 대시보드입니다. `/ev` 경로로 접근합니다.

### 카드별 혜택 정책
- **신한카드 EV:** 전월실적 30만원 이상~60만원 미만 → 30% 청구할인 (월 한도 20,000원), 60만원 이상 → 50% 청구할인 (월 한도 20,000원)
- **BC 어디로든 그린카드 V3:** 전월실적 30만원 이상~60만원 미만 → 20% 에코머니 포인트 (월 한도 20,000P), 60만원 이상 → 40% 에코머니 포인트 (월 한도 20,000P)

### 데이터 수집 방법
- **이메일 파서 (IMAP):** Gmail IMAP에서 환경부/투루차저/차지비 영수증 이메일 자동 파싱
  - 환경 변수: `EV_EMAIL_HOST`, `EV_EMAIL_USER`, `EV_EMAIL_PASS`
- **웹 스크래퍼 (Playwright):** 카드사/충전사 마이페이지에서 전월실적·한도·이용내역 스크래핑
  - 환경 변수: `SHINHAN_USER_ID`, `SHINHAN_PASSWORD`, `BC_USER_ID`, `BC_PASSWORD`
  - 충전사: `ENV_CHARGE_USER_ID/PASSWORD`, `TURU_USER_ID/PASSWORD`, `CHARZIN_USER_ID/PASSWORD`
- **수동 동기화:** 대시보드 "지금 동기화" 버튼 → `POST /api/ev/sync`

### 데이터베이스 (Supabase)
- **테이블:** `ev_transactions`
  - `id`: TEXT PK (UUID)
  - `date`: TIMESTAMPTZ
  - `provider`: TEXT (환경부|투루차저|차지비)
  - `card_type`: TEXT (Shinhan_EV|BC_Green_V3)
  - `amount`: INT (결제금액, 원)
  - `is_discounted`: BOOLEAN
  - `source`: TEXT (Email|Scraper|Manual)
  - `raw_id`: TEXT UNIQUE (중복 방지용)
- **테이블:** `ev_card_status`
  - `card_type`: TEXT PK
  - `last_performance`: INT (전월 실적, 원)
  - `current_spend`: INT (당월 충전 합계)
  - `remaining_limit`: INT (당월 잔여 할인/적립 한도)
  - `updated_at`: TIMESTAMPTZ

### 파일 구조
- `lib/ev/cardRules.ts` — 카드별 혜택 정책 상수 및 티어 계산
- `lib/ev/calculator.ts` — 할인/적립 예상액 계산 엔진
- `lib/ev/emailParser.ts` — IMAP 이메일 파서
- `lib/ev/scraper.ts` — Playwright 웹 스크래퍼
- `app/ev/page.tsx` — 대시보드 서버 컴포넌트
- `app/ev/EVDashboard.tsx` — 대시보드 클라이언트 컴포넌트 (차트, 테이블)
- `app/ev/actions.ts` — 서버 액션 (Supabase 데이터 조회)
- `app/api/ev/sync/route.ts` — 동기화 API 엔드포인트
- `supabase/migrations/20260401000000_add_ev_tables.sql` — DB 마이그레이션

### 대시보드 화면 구성
1. **상단 헤더:** 마지막 동기화 시각, "지금 동기화" 버튼
2. **카드별 현황 (요약 카드 2개):**
   - 전월 실적 구간 및 할인율
   - 당월 충전 합계
   - 남은 혜택 한도 (진행 바)
3. **월별 충전 차트:** 최근 6개월 업체별 막대 차트 (CSS 기반)
4. **이용내역 테이블:** 카드/업체 필터, 날짜·업체·카드·금액·수집방법 컬럼
