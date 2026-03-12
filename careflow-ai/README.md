# CareFlow AI — 치과/병원용 운영 보조 CRM

> ⚕️ **본 시스템은 병원 운영 보조 및 리콜 추천 도구이며, 의료적 판단을 대신하지 않습니다.**

환자 재내원 관리, 치료 중단 탐지, 리콜 자동화, AI 개인화 메시지 생성, **CTA 광고 유입 추적 및 정산 관리**,
**자유입력 방문경로 대량 처리/CSV Import/검토 큐/정규화 이력 추적**을 통해
병원의 매출과 환자 관리 품질을 높이는 운영 보조 웹앱입니다.

### 주요 사용자
- **데스크** — 환자 연락/검토/발송 실행
- **상담실장** — 리콜 우선순위/CTA 정산 검토/보고

### 핵심 가치
1. 어떤 환자에게 지금 연락해야 하는지 **한눈에** 보여줌
2. CTA 광고로 유입된 환자가 **실제 진료까지 했는지** 추적하여 정산 근거 관리
3. 모든 추천에 **왜 이 환자가 여기 뜨는지** 근거를 표시

---

## 빠른 시작

```bash
cp .env.example .env
npm install
npm run setup     # Prisma generate + DB push + seed (87명 mock 환자)
npm run dev       # http://localhost:3000
```

> LLM 키 없이도 모든 기능이 정상 작동합니다 (템플릿 기반 fallback).

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS 4 + shadcn/ui |
| ORM/DB | Prisma 5 + SQLite |
| AI | Vertex AI (Gemini) — 선택적 |
| 아이콘 | Lucide React |
| 테스트 | Vitest |

---

## 주요 기능

### 1. 대시보드
- KPI 카드 (오늘 확인 환자, 치료 중단, 리콜 예정, 문자 추천) + 전주 대비 변화
- **"오늘 바로 연락 권장"** 긴급 환자 섹션
- **Explainable 우선순위 점수**: 각 환자별 점수 산정 근거 (심각도/미방문 기간/VIP 등) 표시

### 2. 환자 관리
- 세그먼트 필터 (치료중단 / 스케일링 / 임플란트 / 잠재수요 / VIP / 액션없음)
- 검색 + 정렬 (우선순위/이름/최근방문)
- **환자 타임라인 UI**: 방문 이력을 시간순으로 시각화
- **상태 변경**: 연락 완료 / 연락 보류 / 추후 재확인 (DB 저장)

### 3. 규칙 기반 탐지 엔진 (Explainable)

| 규칙 | 조건 | 설명 |
|------|------|------|
| 신경치료 중단 | 발수 후 14일+ 근관충전 없음 | 치아별 검사 |
| 보철 중단 | 인상/prep 후 21일+ 세팅 없음 | 치아별 검사 |
| 보험 스케일링 | 작년 스케일링 후 올해 미수진 | 연도 기준 |
| 치주 리콜 | 치주치료 이력 + 3~4개월 주기 | 최근 방문 기준 |
| 임플란트 점검 | 보철 완료 후 1/3/6/12개월 | 점검 누락 감지 |
| 사랑니 잠재수요 | 매복지치 진단, 발치 없음 | 잠재 수요 |
| 교정 잠재수요 | 교정 상담, 시작 없음 | 잠재 수요 |

모든 추천에 **"왜 이 환자가 탐지되었는지" 근거와 날짜**를 표시합니다.

### 4. AI 문자 초안 생성
- **3가지 버전** 동시 생성: 짧은(SMS) / 기본 / 따뜻한 버전
- 톤 선택: 정중함 / 친근함 / 원장 직접 톤
- 생성 방식 표시: `Vertex AI 생성` / `템플릿 생성` / `기본 메시지 생성(fallback)`
- Vertex AI 실패 시 → 템플릿 자동 fallback (앱 중단 없음)

### 5. 관리자 설정
- 규칙별 활성/비활성, 파라미터 조정 (판정 일수, 리콜 주기 등)
- 기본 문자 톤 설정
- Vertex AI 설정 안내 (환경변수 기반)

---

### 6. CTA 광고 귀속 관리 (NEW)
- **유입 환자 목록**: CTA 광고로 유입된 환자 리스트 + 자동 분류 근거/신뢰도
- **검토/확정/제외**: 반자동 워크플로우 — 규칙 기반 자동 분류 → 운영자 확인
- **캠페인별 집계**: 플랫폼/캠페인별 유입 수, 확정 수, 검토 대기 현황
- **정산 요약**: 확정 환자 × CPC 단가 기반 정산 가능 금액 계산
- **대시보드 연동**: 메인 대시보드에 CTA 요약 카드 표시

### 7. 방문경로 대량 처리 및 검토 큐 (NEW)
- **CSV Import**: 자유입력 방문경로 CSV 업로드 → 자동 파싱/검증/정규화 → 결과 요약
  - 지원 컬럼: `sourceRaw`(방문경로), `chartNumber`(차트번호), `visitDate`(방문일), `memo`(비고)
  - 최대 5,000행 / 5MB, 한글 별칭 지원 (유입경로, 차트번호 등)
- **검토 큐**: 3가지 뷰 모드
  - **Queue 뷰**: 개별 방문 건별 검토 (검색, 필터: 미검토/미분류/저신뢰/CTA후보)
  - **원문 묶음 뷰**: 동일 sourceRaw 텍스트 묶어서 한 번에 확정/반려/수정
  - **추천값별 뷰**: 같은 정규화 결과별 그룹핑 → 일괄 확인
- **CSV Export**: 검토 결과 Excel 호환 UTF-8 CSV 다운로드
- **정규화 이력 추적**: 모든 변경(개별/일괄/CSV import/자동)을 `SourceNormalizationHistory`에 기록
- **대시보드 위젯**: 검토 필요/미분류/저신뢰 건수 + 최근 Import 현황

### 8. 동기화 관리 및 EMR 연동 준비 (NEW)
- **SyncJob 모델**: 모든 데이터 유입(CSV Import, EMR Pull, Seed, 수동 재처리)을 추적
  - 상태: PENDING → RUNNING → SUCCESS / PARTIAL_SUCCESS / FAILED
  - 성공/실패/중복/미분류 건수, 에러 요약, 실행자 기록
  - ImportBatch와 연결 (`importBatchId`) — CSV Import 시 상위 추적 개념
- **동기화 관리 화면** (`/sync`): 운영 신뢰도 화면
  - 마지막 동기화 시각 + 최근 이력 목록
  - 상태별 요약 (성공/부분성공/실패/실행중)
  - 작업별 상세 보기 (에러, 건수, 비고)
  - 검토 큐/Import 이력 바로가기
  - 미분류/실패 건 재처리 버튼 (ADMIN 전용)
- **EMR 파이프라인 구조** (`lib/sync/pipeline.ts`): EMR 원본 → 정제/정규화 → 운영 DB
  - 향후 EMR API 직접 연동 시 동일 SyncJob 파이프라인 사용
- **대시보드 위젯**: 마지막 동기화 시각, 상태, 실패 건수 표시

### 9. 기본 인증 및 역할 기반 권한 (NEW)
- **Cookie 기반 세션**: HMAC-SHA256 서명 토큰, httpOnly 쿠키 (7일 유효)
- **로그인/로그아웃**: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- **역할(Role)**: ADMIN, DESK, COUNSELOR, VIEWER, MARKETING
  - ADMIN: 전체 기능 (설정, 분류 사전, Export, Sync 관리, 재처리)
  - DESK: 환자 처리, 검토 큐, CSV Import, 메시지 검토, 동기화 조회
  - COUNSELOR: 환자 관리, CTA 검토, 워크플로우
  - VIEWER: 조회 전용 (대시보드, 환자 목록)
  - MARKETING: CTA/정산 관련 조회, 검토 큐
- **역할별 메뉴 제한**: 사이드바에 권한별로 접근 가능한 메뉴만 표시
- **사용자 추적**: `changedBy`, `reviewedBy`, `triggeredBy` 등에 실제 로그인 사용자 이름 반영
- **데모 계정**: admin/admin123, desk01/desk123, counsel01/counsel123, viewer01/view123, mkt01/mkt123
- **헤더 표시**: 현재 사용자명 + 역할 배지 + 로그아웃 버튼

### 10. 카카오톡 발송 운영 흐름 (NEW)
- **OutboundMessage 모델**: 메시지 전체 라이프사이클 관리
  - 상태 흐름: DRAFT → REVIEW_NEEDED → APPROVED → PENDING/SCHEDULED → SENDING → SENT/FAILED/RETRY_NEEDED
  - 승인 워크플로우: `approvalStatus` (DRAFT/REVIEW_NEEDED/APPROVED/REJECTED)
  - 발송 추적: `sendStatus` (PENDING/SCHEDULED/SENDING/SENT/FAILED/RETRY_NEEDED/CANCELLED/BLOCKED)
- **4단계 발송 안전 체크** (`lib/messaging/send.ts`):
  1. 승인 상태 확인 (APPROVED만 발송)
  2. 수신 거부(doNotContact) 차단
  3. 전화번호 유효성 검증
  4. 7일 이내 동일 환자·유형 중복 차단
- **메시지 운영 화면** (`/messages`): 필터 탭, 통계 카드, 인라인 승인/발송/재시도/취소 액션
- **API**: `GET/POST /api/outbound`, `:id/approve`, `:id/send`, `:id/retry`, `:id/cancel`, `/stats`
- **Provider 추상화**: MockMessageProvider (95% 성공 시뮬), KakaoAlimtalkProvider (stub)
- **대시보드 연동**: 메시지 발송 현황 카드 (검토 필요/발송 대기/오늘 발송/실패/차단)

### 11. 개인정보 보호 아키텍처 (NEW)
- **PII 분리**: 이름/전화번호를 별도 `PatientIdentity` 테이블에 분리 저장
- **UI 마스킹**: 기본 화면에서 이름/전화번호 마스킹 표시 (토글 가능)
- **LLM 안전성**: AI API에 최소 컨텍스트만 전달 (마스킹된 이름 + 정형 사유)
- **감사 로그**: 모든 PII 조회/변경/발송 기록을 `AuditLog`에 저장
- **데이터 최소화**: 차트 원문/자유서술/주민번호 등 불필요 정보 저장하지 않음

> 상세 아키텍처: [`docs/DATA-ARCHITECTURE.md`](docs/DATA-ARCHITECTURE.md)

---

## 데이터 모델

| 모델 | 설명 |
|------|------|
| `Patient` | 환자 운영 데이터 (차트번호, 성별, 생년, VIP, 태그) |
| `PatientIdentity` | PII 분리 저장 (이름, 전화번호) — 별도 접근 제어 |
| `Visit` | 방문 이력 (날짜, 유입 채널, CTA 여부) |
| `Diagnosis` | 진단 코드 (KCD 코드, 치아번호) |
| `Procedure` | 처치 코드 (처치 코드, 치아번호) |
| `Campaign` | CTA 광고 캠페인 (플랫폼, 예산, CPC) |
| `LeadAttribution` | CTA 유입 귀속 (검토 상태, 자동 분류 근거) |
| `RecallRecommendation` | 리콜 추천 기록 |
| `MessageDraft` | 문자 초안 (톤, 길이, 내용, 상태: draft→reviewed→queued→sent/failed) |
| `MessageDelivery` | 메시지 발송 추적 (프로바이더, 상태, 재시도, 외부ID) |
| `OutboundMessage` | 아웃바운드 메시지 (승인/발송/재시도/차단 전체 라이프사이클) |
| `AuditLog` | 감사 로그 (액션, 엔티티, PII 미포함) |
| `RuleConfig` | 규칙 설정 (활성/비활성, JSON 파라미터) |
| `User` | 사용자 계정 (username, passwordHash, name, role: ADMIN/DESK/COUNSELOR/VIEWER/MARKETING) |
| `SyncJob` | 동기화 작업 추적 (syncType, sourceSystem, 상태, 건수 요약, triggeredBy, importBatchId) |
| `ImportBatch` | CSV 가져오기 배치 (파일명, 행 수, 성공/실패/미분류 수, 상태) |
| `SourceNormalizationHistory` | 방문경로 정규화 이력 (변경 전/후 값, 변경 유형, 변경자, 메모) |

---

## 프로젝트 구조

```
careflow-ai/
├── prisma/
│   ├── schema.prisma          # 데이터 모델 (PII 분리 구조)
│   └── seed.ts                # 87명 mock 환자 + CTA 캠페인 + 중복 방문경로 데이터
├── docs/
│   └── DATA-ARCHITECTURE.md   # 데이터 아키텍처/보안 설계 문서
├── src/
│   ├── app/                   # Next.js App Router 페이지
│   │   ├── page.tsx           # 대시보드
│   │   ├── patients/          # 환자 목록 + 상세
│   │   ├── cta/               # CTA 광고 귀속 관리
│   │   ├── source-review/     # 방문경로 검토 큐
│   │   ├── source-import/     # CSV Import
│   │   ├── source-rules/      # 분류 사전
│   │   ├── sync/              # 동기화 관리
│   │   ├── messages/          # 메시지 발송 운영 화면
│   │   ├── settings/          # 설정
│   │   ├── about/             # 제품 소개
│   │   └── api/               # API Routes
│   │       ├── dashboard/     # 대시보드 데이터
│   │       ├── patients/      # 환자 CRUD
│   │       ├── messages/      # AI 문자 생성
│   │       ├── outbound/      # 아웃바운드 메시지 API (생성/승인/발송/재시도/취소/통계)
│   │       ├── cta/           # CTA 유입 조회 + 검토 + 정산
│   │       ├── source-review/ # 검토 큐 API (개별/일괄/통계/내보내기)
│   │       ├── source-import/ # CSV Import API (업로드/이력)
│   │       ├── auth/          # 인증 API (login/logout/me)
│   │       ├── sync/          # 동기화 관리 API (목록/상세/재처리)
│   │       └── seed/          # 데모 데이터 생성
│   ├── components/
│   │   ├── auth/              # 인증 (AuthGate, AuthProvider, LoginPage)
│   │   ├── dashboard/         # 대시보드 UI
│   │   ├── patients/          # 환자 목록/상세 UI
│   │   ├── cta/               # CTA 광고 관리 UI
│   │   ├── source-review/     # 방문경로 검토 큐 UI (3뷰 모드)
│   │   ├── source-import/     # CSV Import UI
│   │   ├── sync/              # 동기화 관리 UI
│   │   ├── messages/          # 메시지 발송 운영 UI (필터/승인/발송/재시도)
│   │   ├── layout/            # 사이드바/레이아웃 (역할 기반 메뉴)
│   │   ├── settings/          # 설정 UI
│   │   └── ui/                # shadcn/ui 컴포넌트
│   ├── lib/
│   │   ├── auth.ts            # 인증 (세션, 비밀번호, 역할/권한)
│   │   ├── sync/              # 동기화 파이프라인
│   │   │   └── pipeline.ts    # SyncJob 생성/완료/실패 추상화
│   │   ├── engine/            # 규칙 기반 탐지 엔진
│   │   │   ├── index.ts       # 오케스트레이터
│   │   │   ├── types.ts       # Rule 인터페이스
│   │   │   ├── scoring.ts     # 우선순위 점수 (explainable)
│   │   │   └── rules/         # 개별 규칙
│   │   ├── ai/                # AI 메시지 생성
│   │   │   ├── provider.ts    # AIProvider 인터페이스
│   │   │   ├── vertex.ts      # Vertex AI 프로바이더
│   │   │   ├── template-fallback.ts
│   │   │   ├── generate-message.ts
│   │   │   └── prompts.ts     # 프롬프트 설계
│   │   ├── cta/               # CTA 광고 유입 분류/정산
│   │   │   └── classify.ts    # 자유입력→채널 분류, 정산 적격 판정
│   │   ├── messaging/         # 메시지 발송 프로바이더 + 오케스트레이터
│   │   │   ├── provider.ts    # MockProvider / KakaoAlimtalkProvider
│   │   │   └── send.ts        # 발송 오케스트레이터 (안전 체크 + 상태 관리)
│   │   ├── privacy.ts         # PII 마스킹/LLM 안전성 유틸리티
│   │   └── message-generator/
│   │       └── templates.ts   # 33개 한국어 메시지 템플릿
│   ├── types/index.ts         # 공유 타입/라벨 (CTA 포함)
│   └── __tests__/             # Vitest 유닛 테스트
├── .env.example               # 환경변수 템플릿
├── vitest.config.ts           # 테스트 설정
└── package.json
```

---

## 테스트

```bash
npm test           # 전체 테스트 실행
npm run test:watch # 감시 모드
```

### 테스트 커버리지
- **치료 중단 탐지** (8 tests): 신경치료/보철 중단, 완료 케이스, 경계값, 치아별 독립 판정
- **스케일링/치주 리콜** (5 tests): 보험 스케일링, 치주 리콜 주기, 미이력 케이스
- **우선순위 점수** (7 tests): 심각도, 미방문 기간, VIP, 단골, 복합 케이스
- **템플릿 fallback** (9 tests): 3버전 생성, 톤별 분기, SMS 길이, 미지원 subType 처리

---

## 대표 데모 시나리오

데모 시 아래 순서로 설명하면 제품 가치를 1분 안에 전달할 수 있습니다:

| 순서 | 환자 | 케이스 | 설명 포인트 |
|------|------|--------|------------|
| 1 | 김민수 | 신경치료 중단 | "발수 후 46일 경과, 근관충전 안 함. 바쁜 직장인이 통증 사라지면 안 옴" |
| 2 | 정태영 (VIP) | VIP 이탈 위험 | "가족 4인 모두 환자. 근관충전 23일 미내원. VIP이므로 높은 우선순위" |
| 3 | 한지은 | 보철 중단 | "크라운 인상 후 30일 경과, 세팅 안 함. 비용 문제 추정" |
| 4 | 남궁석 (VIP) | 치주 관리 누락 | "만성치주염 10년차, 3~4개월 주기 필수. 5개월 경과" |
| 5 | 문정훈 (VIP) | 임플란트 점검 | "보철 완료 2개월 전, 1개월 점검 누락. 당뇨 환자" |
| 6 | 민경호 (VIP) | 복합 케이스 | "임플란트+신경치료 중단+스케일링 3건 동시 탐지. 최고 점수" |
| 7 | 석진우 | 정상 종료 | "발수+근관충전 같은 날 완료 → 탐지 안 됨. 엔진의 정확성 입증" |
| 8 | 탁지민 | 교정 잠재수요 | "상담+검사까지 완료했으나 비용 부담으로 미시작. 전환 기회" |

---

## 배포 가이드

### Vercel (권장)

> **중요**: SQLite 파일은 Vercel serverless 환경에서 사용할 수 없습니다.
> 반드시 PostgreSQL (Neon, Supabase 등 무료 제공)로 전환해야 합니다.

**단계별 설정:**

1. `prisma/schema.prisma`에서 provider를 `postgresql`로 변경
2. GitHub 레포지토리를 Vercel에 연결
3. Vercel 프로젝트 Settings:
   - **Root Directory**: `careflow-ai` (모노레포인 경우)
   - **Framework**: Next.js (자동 감지)
4. Environment Variables 설정:
   - `DATABASE_URL`: PostgreSQL 연결 URL (예: Neon 무료 제공)
5. 배포 후 `https://your-app.vercel.app/api/seed` 에 POST 요청을 보내 데모 데이터 생성
   ```bash
   curl -X POST https://your-app.vercel.app/api/seed
   ```
6. 또는 앱 접속 시 나타나는 "데모 데이터 생성" 버튼 클릭

**DB 연결 없이 배포한 경우:**
- 앱이 크래시되지 않고, 데이터베이스 연결 안내 페이지가 표시됩니다.
- 설정 완료 후 새로고침하면 정상 작동합니다.

### Node.js 서버

```bash
cp .env.example .env
# .env 파일 편집 (DB URL 등)
npm install
npm run setup
npm run build
npm start         # http://localhost:3000
```

### Docker (참고)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## SQLite → PostgreSQL 마이그레이션

프로덕션 배포 시 SQLite에서 Postgres로 전환하는 방법:

1. `prisma/schema.prisma`에서 provider 변경:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. `.env` 업데이트:
```env
DATABASE_URL="postgresql://user:password@host:5432/careflow"
```

3. 마이그레이션 실행:
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

---

## Vertex AI 연동 방법

### 1. 환경변수 설정 (.env)
```env
ENABLE_LLM_MESSAGE_GENERATION=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.0-flash
```

### 2. 인증 설정
```bash
# 방법 A: gcloud CLI (로컬 개발)
gcloud auth login
gcloud auth application-default login

# 방법 B: 서비스 계정 (프로덕션)
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 3. LLM 없이 실행
```env
ENABLE_LLM_MESSAGE_GENERATION=false  # 또는 변수 미설정
```
템플릿 기반 메시지 생성기가 자동으로 사용됩니다. 모든 기능이 정상 작동합니다.

---

## 환경변수 목록

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `DATABASE_URL` | O | `file:./dev.db` | DB 경로 |
| `ENABLE_LLM_MESSAGE_GENERATION` | X | `false` | LLM 메시지 생성 활성화 |
| `GOOGLE_CLOUD_PROJECT` | X | - | GCP 프로젝트 ID |
| `GOOGLE_CLOUD_LOCATION` | X | `us-central1` | Vertex AI 리전 |
| `VERTEX_MODEL` | X | `gemini-2.0-flash` | Vertex AI 모델 |
| `GOOGLE_APPLICATION_CREDENTIALS` | X | - | 서비스 계정 키 경로 |
| `AUTH_SECRET` | X | (dev fallback) | 세션 쿠키 서명 키 (프로덕션 필수) |
| `MESSAGE_PROVIDER` | X | `mock` | 메시지 발송 프로바이더 (mock/kakao) |
| `KAKAO_API_KEY` | X | - | 카카오 알림톡 API 키 |
| `KAKAO_SENDER_KEY` | X | - | 카카오 발신 프로필 키 |

---

## Mock vs 실제 연동 현황

| 기능 | 현재 상태 | 실제 연동 시 |
|------|-----------|-------------|
| 환자 데이터 | ✅ Mock 87명 seed (중복 방문경로 포함) | EMR ETL 파이프라인 연동 |
| CSV Import | ✅ 업로드/파싱/검증/정규화/이력 | EMR 직접 연동 시 불필요 |
| 검토 큐 | ✅ 3뷰 모드 (개별/원문묶음/추천값별) | 그대로 사용 |
| 일괄 검토 | ✅ 확정/반려/수정 묶음 처리 | 그대로 사용 |
| 정규화 이력 | ✅ 모든 변경 추적 (누가/언제/무엇을/왜) | 그대로 사용 |
| CSV Export | ✅ UTF-8 BOM (Excel 호환) | 그대로 사용 |
| PII 분리 | ✅ PatientIdentity 테이블 분리 | 그대로 사용 + 암호화 추가 |
| UI 마스킹 | ✅ 이름/전화번호 마스킹 토글 | 그대로 사용 + 권한 연동 |
| 규칙 엔진 | ✅ 실제 작동 (규칙 기반) | 그대로 사용 + ML 확장 |
| 우선순위 점수 | ✅ 실제 작동 | 그대로 사용 |
| 문자 생성 (템플릿) | ✅ 실제 작동 | 그대로 사용 (fallback) |
| 문자 생성 (AI) | 🔧 Vertex AI 구조 준비 | 환경변수 설정만 하면 작동 |
| LLM 안전성 | ✅ sanitizeForLLM 적용 | 그대로 사용 |
| CTA 광고 귀속 | ✅ 반자동 분류 + 검토 워크플로우 | 광고 플랫폼 API 연동 |
| CTA 정산 | ✅ CPC 기반 정산 계산 | 실제 광고비 데이터 연동 |
| 감사 로그 | ✅ AuditLog 기록 | 그대로 사용 + 모니터링 연동 |
| 상태 변경 | ✅ DB 저장 | 그대로 사용 |
| CTA 정산 적격 판정 | ✅ 3조건 판정 + 사유 표시 | 그대로 사용 |
| CTA 자유입력 분류 | ✅ 키워드 기반 자동 분류 | 그대로 사용 + ML 보강 |
| 메시지 발송 | ✅ MockProvider (95% 시뮬) | MESSAGE_PROVIDER=kakao 전환 |
| 메시지 발송 추적 | ✅ MessageDelivery 상태 관리 | 그대로 사용 |
| 아웃바운드 운영 | ✅ 승인/발송/재시도/차단 전체 흐름 | 그대로 사용 |
| 발송 안전 체크 | ✅ 수신거부/중복/전화번호/승인 4단계 | 그대로 사용 |
| 메시지 운영 화면 | ✅ 필터/통계/인라인 액션 | 그대로 사용 |
| 카카오 알림톡 | 🔧 Provider stub 준비됨 | API 키 + 템플릿 등록 |
| 동기화 관리 | ✅ SyncJob 추적 + 관리 화면 | 그대로 사용 |
| 인증/세션 | ✅ Cookie 기반 HMAC 세션 (6 demo 계정) | 프로덕션: NextAuth/OAuth 확장 |
| 역할 기반 권한 | ✅ 5역할 + 메뉴/기능 분기 | 그대로 사용 + 세분화 |
| 사용자 추적 | ✅ changedBy/triggeredBy에 실제 사용자 반영 | 그대로 사용 |
| 전주 대비 변화 | 🔧 결정적 Mock | 실제 날짜 기반 비교 |

---

## 실제 운영 전 필요한 작업

1. **DB 전환**: SQLite → PostgreSQL (Prisma provider 변경만으로 가능)
2. **인증/권한**: NextAuth 또는 자체 인증 추가 → PII 접근 권한 연동
3. **EMR 연동**: ETL 파이프라인 구축 (원본 차트 → 정형 데이터 추출 → 운영 DB)
4. **PII 암호화**: PatientIdentity 테이블 AES 암호화 적용
5. **문자 발송**: 실제 SMS API 연동 (카카오 알림톡, NHN 등)
6. **광고 플랫폼 연동**: CTA 유입 소스 자동 수집 (UTM/리퍼러 파싱)
7. **HTTPS**: 프로덕션 배포 시 SSL 인증서
8. **감사 로그 모니터링**: AuditLog 대시보드/알림 설정

---

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run start      # 프로덕션 서버
npm run setup      # 전체 초기 설정 (설치 + DB + seed)
npm run db:push    # 스키마 반영
npm run db:seed    # seed 데이터 재삽입
npm run db:reset   # DB 초기화 + seed
npm run lint       # ESLint
npm test           # 유닛 테스트
npm run test:watch # 테스트 감시 모드
```

---

## 보안 및 개인정보 아키텍처

- **PII 분리 저장**: 이름/전화번호는 `PatientIdentity` 테이블에 분리, 운영 데이터와 독립적 접근 제어 가능
- **데이터 최소화**: 차트 원문, 자유서술 메모, 주민번호, 주소 등 불필요 정보는 운영 DB에 저장하지 않음
- **UI 마스킹**: 기본 화면에서 이름(`김*수`), 전화번호(`010-****-5678`) 마스킹 표시, 토글로 해제
- **LLM 안전성**: `sanitizeForLLM()` — AI API에 마스킹된 이름 + 정형 사유만 전달, 차트 원문 전달 금지
- **감사 로그**: 모든 PII 조회/메시지 생성/CTA 검토 기록을 `AuditLog`에 저장 (PII 미포함)
- **로그 안전성**: 콘솔/서버 로그에 민감정보(이름, 전화번호)를 출력하지 않음
- 현재 mock 데이터만 사용하며 실제 환자 정보는 포함되어 있지 않습니다
- `.env` 파일은 git에 포함하지 마세요

> 상세 설계: [`docs/DATA-ARCHITECTURE.md`](docs/DATA-ARCHITECTURE.md)

---

## CTA 광고 유입 환자 정의 및 정산 기준

### CTA 광고 유입 환자란?
방문경로(자유 입력 텍스트)에 **광고 플랫폼 키워드**가 포함된 환자를 자동 분류합니다.

### 자유 입력 → 채널 분류 방식
```
"인스타 광고 보고 옴" → Instagram (confidence: 0.9)
"블로그 보고 옴"     → Naver Blog (confidence: 0.8)
"지인 소개"          → Referral (confidence: 0.9)
"그냥 지나가다"       → Walk-in (confidence: 0.7)
```
- `src/lib/cta/classify.ts`의 `CHANNEL_RULES` — 키워드 매칭 기반
- 분류 결과(채널, 신뢰도, 근거)를 `LeadAttribution`에 저장
- 운영자가 검토(확정/반려) → 최종 확정

### 정산 적격 조건 (3가지 모두 충족)

| 조건 | 설명 |
|------|------|
| **확정 (confirmed)** | 운영자가 CTA 유입으로 최종 확인 |
| **실제 진료 시작 (treatmentStarted)** | 상담/검사만으로는 불인정. 실제 치료 시술 코드가 있어야 인정 |
| **중복 아님 (!isDuplicate)** | 같은 환자·같은 캠페인은 **1회만 인정** |

### 진료 시작 판정 로직
상담, 초진, 검사, 방사선 등 **비치료 코드는 제외**하고, 실제 치료 시술 코드(스케일링, 충전, 발치, 보철 등)가 1건 이상 있으면 `treatmentStarted = true`.

### 정산 단위
- **월 기준** (`settlementMonth: "2026-03"`)
- 해당 월에 유입된 CTA 환자 중 적격 조건 충족 건수 × CPC 단가

### 비적격 사유 예시
- `"검토 대기 중입니다"` — 아직 운영자 확인 전
- `"실제 진료가 시작되지 않았습니다"` — 상담만 하고 치료 미시작
- `"동일 환자·캠페인 중복 유입입니다"` — 이미 1회 인정됨
- `"CTA 유입으로 인정되지 않았습니다"` — 반려

---

## EMR 연동 시 필요한 데이터 필드

CareFlow AI가 정상 작동하기 위해 EMR에서 가져와야 하는 최소 필드:

| 데이터 | 필드 | 형식 | 용도 |
|--------|------|------|------|
| **환자** | 차트번호 | string | 식별 키 |
| **환자** | 이름 | string | PII (PatientIdentity) |
| **환자** | 전화번호 | string | PII (PatientIdentity) |
| **환자** | 성별 | M/F | 메시지 개인화 |
| **환자** | 출생연도 | number | 연령대 기반 추천 |
| **방문** | 방문일 | date | 리콜 주기 계산 |
| **방문** | 유입경로 | free text | CTA 자동 분류 |
| **진료** | 진료코드 | string | 치료 중단 탐지 |
| **진료** | 진료명 | string | UI 표시 |
| **진료** | 치아번호 | number (옵션) | 치아별 판정 |
| **진단** | KCD 코드 | string | 잠재수요 탐지 |
| **진단** | 진단명 | string | UI 표시 |
| **진단** | 치아번호 | number (옵션) | 치아별 매칭 |

> **주의**: 차트 원문, 자유서술 메모, 주민번호, 주소, 보험 상세는 **가져오지 않습니다**.
> ETL 파이프라인에서 위 필드만 추출하고 나머지는 폐기합니다.

---

## 카카오톡 채널 연동 구조

### 아키텍처 (OutboundMessage 기반)
```
OutboundMessage 생성 (DRAFT)
  → 검토 요청 (REVIEW_NEEDED)
    → 승인 (APPROVED) / 반려 (REJECTED → CANCELLED)
      → 발송 안전 체크 (수신거부/중복/전화번호/승인 확인)
        → Provider.send() → 성공(SENT) / 실패(FAILED)
          → 실패 시 sendAttemptCount++, 최대 3회 재시도
          → 수신 거부/중복 → BLOCKED (자동 차단)
```

### Provider 추상화 (`src/lib/messaging/provider.ts`)
```typescript
interface MessageProvider {
  send(request: SendRequest): Promise<SendResult>;
}
```
- **MockMessageProvider**: 개발/데모용 (95% 성공 시뮬레이션)
- **KakaoAlimtalkProvider**: 실제 카카오 알림톡 연동 (stub 준비됨)

### 환경변수로 전환
```env
MESSAGE_PROVIDER=mock    # 현재 기본값
MESSAGE_PROVIDER=kakao   # 카카오 알림톡 연동 시
KAKAO_API_KEY=...
KAKAO_SENDER_KEY=...
```

### 카카오 알림톡 연동 시 필요한 작업
1. 카카오 비즈니스 채널 개설
2. 알림톡 템플릿 등록 및 검수 승인
3. 발신 프로필 등록
4. `KAKAO_API_KEY`, `KAKAO_SENDER_KEY` 환경변수 설정
5. `KakaoAlimtalkProvider`의 TODO 부분 구현

### OutboundMessage 상태 흐름
```
승인 흐름: DRAFT → REVIEW_NEEDED → APPROVED / REJECTED
발송 흐름: PENDING → SENDING → SENT ✅ / FAILED ❌ (최대 3회 재시도)
차단 흐름: → BLOCKED 🚫 (수신거부 / 7일 내 중복)
취소 흐름: → CANCELLED 🚫 (운영자 취소 / 반려)
예약 흐름: SCHEDULED → SENDING → SENT ✅
```

---

## 제품 원칙

1. **Explainability**: 모든 추천에 "왜?"를 보여줍니다
2. **운영 보조 도구**: AI가 의사를 대체하지 않음을 명확히 합니다
3. **병원 현장 수준**: 데스크 직원이 바로 이해할 수 있는 UI
4. **확장 가능 구조**: 규칙 엔진, AI 프로바이더 모두 인터페이스 기반 설계
5. **안전한 AI 메시지**: 광고/과장/불안 조장/의료 판단 금지 프롬프트

---

## 향후 로드맵

| 단계 | 기능 | 설명 |
|------|------|------|
| V2 | EMR ETL 파이프라인 | 실제 병원 EMR → 정형 데이터 자동 추출 |
| V2 | 문자 발송 | 카카오 알림톡, NHN 등 실제 SMS 발송 |
| V2 | 인증/권한 | 사용자 로그인, 역할 기반 접근 제어, PII 접근 권한 |
| V2 | PII 암호화 | PatientIdentity 테이블 AES 암호화 |
| V2 | 광고 플랫폼 연동 | UTM/리퍼러 기반 CTA 유입 자동 수집 |
| V3 | Revisit Prediction | ML 기반 재내원 확률 예측 |
| V3 | Churn Prediction | 이탈 위험 환자 조기 경보 |
| V3 | CTA ROI 분석 | 캠페인별 전환율/LTV 분석 대시보드 |
| V3 | 다국어 지원 | 영어, 일본어 UI/메시지 지원 |
