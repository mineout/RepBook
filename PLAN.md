# PLAN

## Vision & Scope
RepBook는 모바일 웹에서 개인 웨이트 기록을 빠르게 남기고 주간 성과를 시각화하는 것을 목표로 한다. V1은 개인 사용자를 대상으로 기록, 검색, PR 추적, 공유 기능을 제공하고, 이후 팀/트레이너 협업 기능으로 확장한다.

## 시스템 개요
- **클라이언트**: Next.js(App Router) 기반 PWA, React + TypeScript + Tailwind. 오프라인 캐시와 빠른 입력을 위한 클라이언트 상태 관리(Zustand 또는 React Server Components + useOptimistic 패턴).
- **백엔드/데이터**: Supabase(PostgreSQL, Auth, Edge Functions). 복잡한 집계는 SQL 뷰/스토어드 프로시저로 수행.
- **호스팅**: Vercel에 프론트, Supabase Cloud에 DB/Auth. 배포 파이프라인은 `main` push 시 Vercel 빌드, Supabase migration은 CLI로 적용.

## 주요 모듈 설계
1. **세션 입력 플로우** (`app/(dashboard)/sessions/new`)
   - 폼 구성: 부위 선택 → 운동 선택 → 세트 리스트(중량×횟수) 입력.
   - Optimistic UI로 즉시 리스트 반영 후 Supabase RPC 호출.
2. **기록 타임라인** (`app/(dashboard)/sessions`)
   - Infinite scroll + 세부 카드(세트, PR표시, 공유 버튼).
   - 필터(부위, 운동)와 기간 범위. 필터 상태는 URL search params.
3. **집계/리포트** (`app/(dashboard)/reports`)
   - SQL 뷰 `v_muscle_volume_by_week` 활용, 그래프 컴포넌트 분리.
4. **공유 링크 생성** (`app/api/share/[id]/route.ts`)
   - Supabase Row Level Security + signed view token, 만료 시간 포함.

## 데이터 모델 초안
- `profiles(id, email, display_name, created_at)`
- `sessions(id, user_id, performed_at, muscle_group, note)`
- `exercises(id, muscle_group, name)`
- `sets(id, session_id, exercise_id, weight, reps, is_pr)`
- `share_tokens(id, session_id, token, expires_at)`
각 테이블은 Supabase RLS로 `user_id = auth.uid()` 조건을 기본으로 한다.

## 기술 고려사항
- 입출력 성능: 모바일 키패드 최적화, 세트 복사 기능.
- 동기화: 오프라인 시 IndexedDB/Service Worker 큐에 저장 후 온라인 시 flush.
- 접근성: 버튼 크기 ≥44px, 색 대비 준수.
- 보안: 공유 링크 만료, PR 데이터 익명화 옵션.

## 로드맵
1. **M1**: 인증 + 세션 CRUD + 기본 타임라인.
2. **M2**: 필터링/검색, PR 추적, 공유 링크.
3. **M3**: 리포트 차트, 오프라인 모드, 다국어(ko/en).
4. **M4**: 팀/트레이너 역할, 공동 플랜 빌더.
