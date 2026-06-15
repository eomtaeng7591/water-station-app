# Purefect Water Station Management App

필리핀 워터샵(Water Refilling Station) 싱글 어드민 통합 관리 앱

**플랫폼**: iOS / Android (React Native + Expo)  
**백엔드**: Supabase (PostgreSQL)  
**버전**: v1.0.0 MVP

---

## 빠른 시작 (Quick Start)

### 1. 의존성 설치
```bash
cd water-station-app
npm install
```

### 2. Supabase 설정
1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성
2. SQL Editor → `supabase/migrations/001_initial_schema.sql` 전체 복사 후 실행
3. Settings → API → `URL`과 `anon key` 복사
4. `src/services/supabase.ts` 열어서 두 값 교체

```ts
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

5. Authentication → Email 로그인 활성화 → 관리자 계정 직접 생성 (Invite user)

### 3. 앱 실행
```bash
# 개발 서버 시작
npx expo start

# iOS 시뮬레이터
npx expo start --ios

# Android 에뮬레이터
npx expo start --android
```

---

## 프로젝트 구조

```
water-station-app/
├── App.tsx                          # 앱 진입점
├── src/
│   ├── constants/index.ts           # 색상, 상수 정의
│   ├── types/index.ts               # TypeScript 타입 정의
│   ├── navigation/AppNavigator.tsx  # 탭 네비게이션 구조
│   ├── services/
│   │   ├── supabase.ts              # Supabase 클라이언트 ⚠️ 키 설정 필요
│   │   ├── orderService.ts          # 주문 CRUD + 외상 자동 생성
│   │   ├── customerService.ts       # 고객 등록/검색/조회
│   │   ├── creditService.ts         # 외상 조회/수금 처리
│   │   ├── reportService.ts         # 일/주/월/연 통계 집계
│   │   └── settingsService.ts       # 단가 조회/수정
│   └── screens/
│       ├── Dashboard/               # 매출 통계 대시보드
│       │   ├── DashboardScreen.tsx  # 메인 + 탭 전환
│       │   ├── WeeklyChart.tsx      # 주간 바 차트
│       │   ├── MonthlyTable.tsx     # 월간 그리드 테이블
│       │   └── YearlyChart.tsx      # 연간 막대 그래프
│       ├── Orders/
│       │   └── OrderScreen.tsx      # Walk-in / Delivery 주문 입력
│       ├── Customers/
│       │   ├── CustomersScreen.tsx  # 고객 목록 + 검색
│       │   ├── AddCustomerScreen.tsx # 신규 고객 등록
│       │   └── CustomerDetailScreen.tsx # 고객 상세 + 외상 이력
│       ├── Credits/
│       │   ├── CreditsScreen.tsx    # 미납 외상 목록
│       │   └── CollectPaymentScreen.tsx # 수금 처리
│       └── Settings/
│           └── SettingsScreen.tsx   # 단가 설정 + 앱 정보
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql   # DB 스키마 전체
```

---

## 주요 기능

| 기능 | 우선순위 | 설명 |
|------|---------|------|
| Walk-in 주문 | P1 | 워크인 단가 자동 적용, 수량 입력, CASH/E-WALLET 결제 |
| Delivery 주문 | P1 | 고객 검색 연동, 배달 상태 선택, CREDIT 조건부 활성화 |
| 통계 대시보드 | P1 | 일간/주간/월간/연간, Walk-in + Delivery = Grand Total |
| 고객 관리 | P2 | 등록(10초), 연락처 중복 체크, 외상 이력 조회 |
| 외상(Utang) 관리 | P2 | 미수금 순 정렬, 부분/전액 수금, 자동 상태 전환 |
| 단가 설정 | P3 | 배달/워크인 단가 수정 → 기존 주문 금액 불변 |

---

## 배포 방법 (APK 직접 설치)

```bash
# EAS Build 설치
npm install -g eas-cli

# 로그인
eas login

# Android APK 빌드 (내부 배포용)
eas build --platform android --profile preview

# iOS IPA 빌드 (TestFlight 내부 트랙)
eas build --platform ios --profile preview
```

---

## 확장 예약 컬럼 (추후 활성화)

DB에 이미 예약된 컬럼들 (현재 NULL 허용):
- `orders.rider_id` → 라이더 배정 기능
- `orders.receipt_no` → 영수증 프린터 연동
- `credits.due_date` → 외상 만기일 알림
- `system_settings` → `shop_id` FK 추가 시 멀티 매장 전환
