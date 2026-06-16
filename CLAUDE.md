# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| Supabase | PostgreSQL + RLS | 클라우드 주 데이터베이스 (인증 포함) |
| Express server | MariaDB + JWT | `server/` 디렉터리의 로컬 서버 (레거시 / 오프라인 폴백) |

- `src/services/supabase.ts` — Supabase 클라이언트 (URL, Anon Key 하드코딩됨)
- `src/services/apiClient.ts` — Express 서버 REST 클라이언트. `API_BASE` IP를 실기기/시뮬레이터 환경에 맞게 변경 필요
- `src/services/authService.ts` — Express JWT 기반 로그인/로그아웃 (`auth_token` → AsyncStorage)

### 인증 & PIN 흐름

`AppNavigator.tsx` 가 앱 상태 머신 역할: `loading → login → pin → main`

- PIN은 AsyncStorage에 평문 저장 (`pinService.ts`). 5회 실패 시 로그인으로 강제 이동.
- `authService.isLoggedIn()` → `pinService.isEnabled()` 순서로 상태 결정

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
├── Credits   (Stack: CreditsList → CollectPayment)
└── Settings  (Stack: SettingsMain → Inventory → Riders)
```

Credits 탭에 연체 건수, Settings 탭에 재고 부족 건수를 badge로 표시 (30초마다 폴링).

### 서비스 레이어 (`src/services/`)

각 도메인별 단일 서비스 파일:

| 파일 | 역할 |
|------|------|
| `orderService.ts` | 주문 CRUD, receipt_no 생성 |
| `customerService.ts` | 고객 조회/등록/수정 |
| `creditService.ts` | 외상(Utang) 관리, 연체 건수 |
| `inventoryService.ts` | 재고 항목 관리 |
| `riderService.ts` | 라이더 관리 및 실적 |
| `reportService.ts` | 일간/주간/월간/연간 통계 |
| `receiptService.ts` | PDF 영수증 생성 (expo-print + expo-sharing) |
| `exportService.ts` | CSV 내보내기 |
| `notificationService.ts` | 로컬 알림 (매일 오후 9시 일간 리포트) |
| `settingsService.ts` | 단가 및 목표 설정 |

### 공유 타입 & 상수

- `src/types/index.ts` — 모든 TypeScript 인터페이스 및 유니온 타입 (`Order`, `Customer`, `Credit`, `Rider` 등)
- `src/constants/index.ts` — `COLORS`, `ORDER_TYPES`, `PAYMENT_TYPES`, `DELIVERY_STATUS`, `CREDIT_STATUS`
- 결제 타입: `CASH | GCASH | MAYA | CREDIT` (타입 파일 기준; 상수 파일의 `EWALLET` 키는 레거시)

### DB 스키마 (Supabase PostgreSQL)

`supabase/migrations/001_initial_schema.sql` 참조:
- `system_settings` — 단가 정책 (단일 행)
- `customers` — 고객 (phone_number UNIQUE)
- `orders` — 주문 (order_type, payment_type, delivery_status enum check)
- `credits` — 외상; `remaining_balance` 변경 시 트리거로 status 자동 전환
- `riders` — 배달 라이더 (migration `002_riders.sql`)
- 모든 테이블 RLS 활성화 — `authenticated` role만 접근 가능
