# 배포 가이드 — Purefect Water Station App

## 사전 준비

```bash
# EAS CLI 설치
npm install -g eas-cli

# Expo 계정 로그인 (없으면 expo.dev 에서 무료 가입)
eas login

# EAS 프로젝트 초기화
eas init
```

---

## 방법 1: APK 직접 설치 (추천 — 가장 빠름)

Android 기기에 직접 설치하는 방법입니다. 구글 플레이스토어 심사가 없어 당일 배포 가능합니다.

### 빌드
```bash
eas build --platform android --profile preview
```

빌드 완료 후 EAS 대시보드에서 APK 다운로드 링크가 생성됩니다.

### 기기에 설치
1. 기기 설정 → 보안 → "알 수 없는 앱 설치" 허용
2. 다운로드된 APK 파일 기기로 전송 (USB / 카카오톡 / 구글 드라이브)
3. 파일 탭하여 설치

---

## 방법 2: iOS TestFlight 내부 트랙 (iPhone/iPad)

Apple Developer 계정($99/년)이 필요합니다.

```bash
# iOS 빌드
eas build --platform ios --profile preview

# TestFlight 업로드
eas submit --platform ios --profile production
```

1. App Store Connect → TestFlight → 내부 테스터에 기기 등록
2. 기기에서 TestFlight 앱 설치 후 앱 다운로드

---

## 방법 3: OTA (Over-The-Air) 업데이트

코드 변경사항을 앱스토어 심사 없이 즉시 반영합니다.  
단, 네이티브 코드(권한, 새 패키지 추가) 변경 시에는 재빌드가 필요합니다.

```bash
# app.json에 업데이트 채널 설정 확인 후
eas update --branch production --message "버그 수정: 외상 잔액 계산"
```

---

## 배포 전 체크리스트

### Supabase 설정
- [ ] `src/services/supabase.ts` URL / Anon Key 입력
- [ ] SQL 스키마 실행 (`001_initial_schema.sql`)
- [ ] Authentication → Email 로그인 활성화
- [ ] 관리자 계정 생성 (Invite user)
- [ ] RLS 정책 확인 (authenticated role만 접근 허용)

### 앱 설정
- [ ] `app.json` → `bundleIdentifier` / `package` 변경
- [ ] 앱 아이콘 교체 (`assets/icon.png` — 1024×1024px)
- [ ] 스플래시 스크린 교체 (`assets/splash.png`)
- [ ] `eas.json` → `appleId`, `ascAppId`, `appleTeamId` 입력

### 기능 검증
- [ ] Walk-in 주문 → CASH 결제 → 대시보드 반영 확인
- [ ] Delivery 주문 → CREDIT 결제 → 외상 목록 반영 확인
- [ ] 비행기 모드에서 주문 입력 → 와이파이 재연결 후 자동 동기화 확인
- [ ] 단가 변경 후 기존 주문 금액 불변 확인
- [ ] 월간 통계 수치 정합성 검증 (수기 장부와 대조)
- [ ] 알림 권한 허용 → 테스트 알림 수신 확인

### 운영 안정성
- [ ] Supabase 자동 백업 활성화 (Settings → Database → Backups)
- [ ] 주간 수동 백업: Supabase Table Editor → CSV 내보내기
- [ ] 앱 버전 관리: `app.json` → `version` 업데이트 시 재빌드

---

## 자주 쓰는 명령어

```bash
# 개발 서버 (QR코드 → Expo Go 앱으로 빠른 테스트)
npx expo start

# Android 에뮬레이터
npx expo start --android

# iOS 시뮬레이터 (Mac 전용)
npx expo start --ios

# 프로덕션 APK 빌드
eas build --platform android --profile production

# 현재 빌드 상태 확인
eas build:list

# OTA 업데이트
eas update --branch production --message "업데이트 내용"
```

---

## 권장 운영 루틴

| 주기 | 작업 |
|------|------|
| 매일 | 앱 실행 → 당일 매출 확인 (오후 9시 알림으로 리마인드) |
| 매주 | 외상 목록 확인 → 미납 고객 수금 |
| 매월 | 월간 통계 스크린샷 저장 또는 CSV 백업 |
| 분기 | Supabase 백업 파일 다운로드 → 로컬 저장 |
