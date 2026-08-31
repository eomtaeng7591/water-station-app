# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 프로젝트 기준(Canonical) 선언 — 2026-08-21 (2026-08-18 선언 대체)

**water-station-app은 여러 워터샵이 각자 가입해서 쓰는 멀티테넌트 앱으로 전환 중이며,
백엔드는 aquashop 프로젝트가 소유한 Supabase(PostgreSQL + RLS)를 직접 사용한다.**

같은 컴퓨터에 별도로 존재하는 **"aquashop"** 프로젝트
(`/Users/taehyuneom/Desktop/project/project/aquashop`, Next.js 웹앱)와는 여전히
코드베이스가 분리되어 있고 화면(주문·대시보드·고객 관리)도 이식/동기화하지 않지만,
**DB만은 공유한다** — aquashop의 `supabase/migrations/`가 실제 운영 스키마의 기준이다.
이 프로젝트를 손댈 때 스키마가 궁금하면 이 앱의 `supabase/migrations/`가 아니라
aquashop 쪽 마이그레이션 파일을 확인할 것 (테이블: `stores`, `users`, `customers`,
`orders`, `payments`, `riders`, `system_settings` 등. UUID 기반 PK, `store_id`로
멀티테넌트 스코핑, RLS가 매장 간 데이터 격리를 서버단에서 강제).

**로컬 Express+MySQL(`server/`)은 더 이상 주 백엔드가 아니다.** 아래 "듀얼 백엔드 구조"
표를 참고 — 화면별로 이미 Supabase로 옮겨간 것과 아직 Express에 남아있는 것이 섞여
있는 과도기 상태다. 새 기능을 추가하거나 화면을 고칠 때는 그 화면이 이미 Supabase로
옮겨졌는지 먼저 확인할 것(서비스 파일 상단 `import`에 `supabase`가 있으면 이관 완료,
`apiClient`의 `api`를 쓰면 아직 레거시 Express 경로).

**Credits/외상(AR) 기능은 완전히 제거되었다** (aquashop이 `003_remove_ar_feature.sql`에서
먼저 제거한 것을 따라감). `creditService.ts`, `Credits` 탭/화면 전부 삭제됨 — 되살리지 말 것.

작업 방향이 이 선언과 어긋나 보이면(예: "다시 Express로", "Supabase 쓰지 마" 같은 요청),
바로 진행하지 말고 이 섹션 기준으로 먼저 재확인할 것.

## 작업 방식

- 중간에 확인을 구하지 말고 자율적으로 판단하여 진행할 것
- 파일 수정, 생성, 삭제 시 확인 없이 진행
- 작업 중 오류가 발생하면 스스로 원인을 파악하고 수정하여 계속 진행
- 모든 단계가 완료된 후 최종 결과만 보고할 것

## 코드 스타일

- 기존 코드의 스타일과 컨벤션을 따를 것
- 불필요한 주석은 추가하지 말 것
- 변경 사항은 최소한으로 유지

---

## Commands

```bash
# 개발 서버 시작 (Expo Go / Metro bundler)
npx expo start

# 플랫폼별 시뮬레이터 실행
npx expo start --ios
npx expo start --android

# Express 백엔드 서버 (server/ 디렉터리)
cd server && node index.js

# EAS 빌드 (APK — 가장 빠른 배포)
eas build --platform android --profile preview

# OTA 업데이트 (네이티브 변경 없을 때)
eas update --branch production --message "업데이트 내용"
```

테스트 러너 없음 — 기능 검증은 iOS 시뮬레이터 또는 실기기에서 직접 확인.

---

## Architecture

**Purefect Water Station** — 필리핀 워터 스테이션 매장 단독 관리 앱. Expo SDK 54 / React Native 0.81.5 / React 19 / TypeScript.

### 듀얼 백엔드 구조

| 백엔드 | 기술 | 용도 |
|--------|------|------|
| Supabase | PostgreSQL + RLS (aquashop 프로젝트 소유) | **인증 + 이관된 기능의 주 데이터베이스.** 로그인, Orders, Customers, Settings, Dashboard/Reports, Riders |
| Express server | MariaDB(원격) + JWT | Inventory 화면만 아직 이 경로 (의도적으로 이번 마이그레이션 범위 밖 — 추후 별도 처리 예정). 로그인엔 더 이상 쓰이지 않으므로 다른 화면에서 호출하면 Unauthorized로 실패함 |

- `src/services/supabase.ts` — Supabase 클라이언트 (URL, Anon Key 하드코딩됨, aquashop 프로젝트를 가리킴)
- `src/services/storeContext.ts` — 로그인한 유저의 `store_id`/`user_id`를 `public.users` 테이블에서 조회해 캐싱. 모든 insert가 이 `store_id`로 스코핑됨 (조회는 RLS가 자동 스코핑하므로 별도 필터 불필요)
- `src/services/apiClient.ts` — Express 서버 REST 클라이언트. 이제 Inventory에서만 사용. `API_BASE` IP를 실기기/시뮬레이터 환경에 맞게 변경 필요
- `src/services/authService.ts` — `supabase.auth.signInWithPassword()` 기반 로그인/로그아웃

### 인증 & PIN 흐름

`AppNavigator.tsx` 가 앱 상태 머신 역할: `loading → login → pin → main`

- PIN은 AsyncStorage에 평문 저장 (`pinService.ts`). 5회 실패 시 로그인으로 강제 이동.
- `authService.isLoggedIn()`(Supabase 세션 확인) → `pinService.isEnabled()` 순서로 상태 결정
- 로그인 계정은 aquashop 쪽 Supabase Auth에 존재해야 하고, `public.users.store_id`가 매장에 연결되어 있어야 함 (`grant_admin.sql` 또는 셀프서비스 가입 RPC로 연결)

### 오프라인 지원

`src/services/offlineDB.ts` (expo-sqlite) + `src/hooks/useOfflineSync.ts`

- SQLite 테이블: `pending_orders`, `settings_cache`, `customers_cache`
- 네트워크 복구 감지 시 자동 동기화 (`syncPendingOrders`). 재시도 3회 초과 항목은 실패 처리.
- `useOfflineSync` 훅이 `OfflineBanner` 컴포넌트에 상태 공급

### 네비게이션 구조

바텀탭 5개 + 중첩 스택:

```
MainTabs
├── Dashboard
├── Orders (단일 화면)
├── Customers (Stack: CustomersList → CustomerDetail → AddCustomer)
└── Settings  (Stack: SettingsMain → Inventory → Riders)
```

Settings 탭에 재고 부족 건수를 badge로 표시 (30초마다 폴링, Inventory가 아직 Express 경로라 실패할 수 있음).
Credits 탭은 제거됨 (아래 서비스 레이어 참고).

### 서비스 레이어 (`src/services/`)

각 도메인별 단일 서비스 파일:

| 파일 | 역할 |
|------|------|
| `orderService.ts` | 주문 CRUD (Supabase `orders`+`payments` 두 테이블에 나눠 저장), receipt_no는 order UUID에서 파생 |
| `customerService.ts` | 고객 조회/등록/수정 (Supabase `customers`) |
| `storeContext.ts` | 로그인 유저의 `store_id`/`user_id` 조회·캐싱 |
| `inventoryService.ts` | 재고 항목 관리 (Express 경로 — 미이관) |
| `riderService.ts` | 라이더 관리 및 실적 |
| `reportService.ts` | 일간/주간/월간/연간 통계 |
| `receiptService.ts` | PDF 영수증 생성 (expo-print + expo-sharing) |
| `exportService.ts` | CSV 내보내기 |
| `notificationService.ts` | 로컬 알림 (매일 오후 9시 일간 리포트) |
| `settingsService.ts` | 단가 및 목표 설정 |

### 공유 타입 & 상수

- `src/types/index.ts` — 모든 TypeScript 인터페이스 및 유니온 타입 (`Order`, `Customer`, `Credit`, `Rider` 등)
- `src/constants/index.ts` — `COLORS`, `ORDER_TYPES`, `PAYMENT_TYPES`, `DELIVERY_STATUS`
- 결제 타입: `CASH | GCASH | MAYA` (CREDIT은 제거됨)

### DB 스키마 (실제 사용: aquashop 소유 Supabase)

**이 앱의 `supabase/migrations/001_initial_schema.sql`은 레거시/참고용이며 실제 스키마가
아니다.** 진짜 운영 스키마는 aquashop 프로젝트의
`/Users/taehyuneom/Desktop/project/project/aquashop/supabase/migrations/`에 있고,
이 앱은 거기 정의된 테이블을 `supabase-js` 클라이언트로 직접 읽고 쓴다:
- `stores` — 가맹점 (UUID PK, `status`: pending/active/inactive)
- `users` — 로그인 계정 (`id`가 `auth.users.id`와 동일). `store_id`로 매장 연결, `role`
- `customers` — 고객 (`store_id` 스코핑, tags/is_verified 컬럼 없음 → 앱에서도 제거됨)
- `orders` — 주문 (`store_id`, `customer_id` nullable, `order_type`: walk_in/delivery,
  `status`: pending/delivering/completed/cancelled, `gallon_qty`, `total_amount`, `rider_id`).
  `unit_price`/`receipt_no` 컬럼이 없어 앱에서 파생값으로 계산함 (`orderService.ts` 참고)
- `payments` — 결제 (주문 1건당 1행으로 사용 중. `method`: cash/gcash/maya)
- `riders` — 배달 라이더 (`store_id` 스코핑)
- `system_settings` — 매장별 단가/목표 (`store_id`가 PK, 매장마다 한 행)
- RLS로 매장 간 데이터 격리 — `auth_user_store_id()` 헬퍼 함수 기반. 조회는 RLS가
  자동으로 스코핑하지만, INSERT는 클라이언트가 `store_id`를 직접 채워야 `WITH CHECK`를
  통과함 (`storeContext.ts`의 `getCurrentStoreId()` 사용)
- `credits`/외상 관련 테이블 없음 — 완전히 제거된 기능
