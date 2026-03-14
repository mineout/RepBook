# RepBook
RepBook은 모바일 웹 기반 웨이트 운동 기록 및 관리 시스템입니다.
개인 사용을 기본으로 하며, 원하는 범위의 운동 데이터 및 리포트를 간편하게 공유할 수 있습니다.

## Project Goal
- 모바일 웹에서 빠르게 기록 가능
- 운동 기록, 세트, 중량, 반복수 관리
- 운동별/기간별 검색 및 집계
- PR(개인 기록) 추적
- 운동 내용 타인 공유 기능 (메일 혹은 메신저를 통해)
- PWA 지원 (앱처럼 사용 가능)

## Tech Stack
### Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- PWA

### Backend / Database
- Supabase
    - PostgreSQL
	- Authentication
- SQL 기반 집계 및 검색

### Hosting
- Vercel (Next.js 배포)
- Supabase Cloud (DB + Auth)


## Major Features
- 날짜별 운동 기록 및 관리
    - 부위: 가슴, 등, 하체, 어깨, 팔, 복부 
    - 운동
    - 세트
        - 중량 * 횟수
    - 최대 중량
    - 1회 세션에서 수행한 세트수
    - example 1
        - 날짜: 2025.3.3
        - 부위: 하체
        - 운동 종류: 하이바 스쿼트
        - 수행(중량*횟수): 30kg*15, 35kg*15, 40kg*10, 40kg*10, 45kg*12
        - 최대 중량: 45kg
        - 수행 세트수: 5
    - example 2
        - 날짜: 2026.3.4
        - 부위: 가슴
        - 운동 종류: 푸쉬업
        - 수행(횟수만)): 19, 13, 15, 12
        - 최대중량: 없음
        - 수행 세트수: 4
- 운동 기록 수정 기능
- 운동 기록 삭제 기능
- 검색 및 집계
    - 부위만 필터해서 최근 수행 내용 확인
    - 부위 + 운동 종류 까지 필터링 해서 최근 수행 내용 확인

## 프로젝트 원칙
- 모바일 UX 최우선
- 단순하고 빠른 기록 (운동중 사용해아하기 때문에 쉽고 실수가 나지 않는 UX/UI)
- SQL 기반의 정확한 집계

## CSV Import Migration
`data/lift-workout-history/workout-history.csv`를 RepBook DB로 이관하는 스크립트입니다.

### 실행 전 준비
- `.env.local`에 아래 값이 있어야 합니다.
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `SUPABASE_DEFAULT_USER_ID` (또는 실행 시 `--user-id`)
- DB에 `sessions.source_import_key` 컬럼이 있어야 하므로 migration을 먼저 적용하세요.
  - `supabase/migrations/20260215093000_add_import_key_to_sessions.sql`

### 커맨드
```bash
pnpm import:workout-history -- --file data/lift-workout-history/workout-history.csv --user-id <uuid>
```

옵션:
- `--dry-run`: DB write 없이 CSV 파싱/검증만 수행
- `--allow-empty-reps`: `30kg` 같은 토큰을 `reps = null`로 허용

예시:
```bash
pnpm import:workout-history -- --dry-run
pnpm import:workout-history -- --allow-empty-reps
```

### 동작 규칙
- `CSV 1행 = sessions 1행`
- 세트 파싱 실패 시 즉시 중단(엄격 모드)
- `source_import_key(sha1)` 기반 upsert로 재실행 시 중복 세션 생성 방지
- upsert된 session은 기존 `sets`를 삭제 후 재삽입

## ChatGPT Mobile Action API (Read-only)
모바일 ChatGPT(Custom GPT Action)에서 RepBook 데이터를 조회하기 위한 읽기 전용 API입니다.

### Endpoints
- `GET /api/action/sessions?token=...&limit=8&offset=0&muscleGroup=...&exerciseName=...`
- `GET /api/action/summary?token=...`
- `GET /api/action/exercises?token=...&q=...`
- `GET /api/action/openapi` (Custom GPT에 연결할 OpenAPI 스키마)

### 인증 방식
- `share_tokens.token`(UUID) 기반 조회 전용 인증을 사용합니다.
- 토큰이 없으면 `400`, 무효하면 `401`, 만료되면 `403`을 반환합니다.

### 토큰 발급 예시 (7일)
```sql
insert into public.share_tokens (session_id, user_id, expires_at)
values ('<existing_session_id>', '<your_user_id>', timezone('utc', now()) + interval '7 days')
returning token, expires_at;
```

반환된 `token` 값을 ChatGPT Action 호출의 `token` 쿼리 파라미터로 사용하세요.

## Internal Admin API (Token Rotation)
토큰 발급/폐기를 자동화하기 위한 내부 관리자 API입니다.

### 환경 변수
- `ADMIN_API_KEY`: 관리자 API 호출 키

### 공통 헤더
```http
X-Admin-Key: <ADMIN_API_KEY>
```

### 엔드포인트
- `GET /api/admin/action-token?userId=<uuid>`
  - 해당 사용자의 활성 토큰 목록 조회
- `POST /api/admin/action-token`
  - 원클릭 회전(활성 토큰 폐기 + 신규 토큰 발급)
  - Body: `{ "userId": "<uuid>", "ttlDays": 7 }`
- `DELETE /api/admin/action-token`
  - 해당 사용자의 활성 토큰 전체 폐기
  - Body: `{ "userId": "<uuid>" }`

### 동작 규칙
- `POST` 회전 시 `sessions` 최신 1건을 찾아 `share_tokens.session_id`로 사용합니다.
- `ttlDays`는 1~30 정수만 허용하며, 기본값은 7일입니다.
- 인증 실패는 `401`, 입력 오류는 `400`, 대상 세션 없음은 `404`를 반환합니다.
