# CareFlow AI — 치과/병원용 AI 리콜 관리 시스템

> ⚕️ **본 시스템은 병원 운영 보조 및 리콜 추천 도구이며, 의료적 판단을 대신하지 않습니다.**

환자 재내원 관리, 치료 중단 탐지, 리콜 자동화, AI 개인화 메시지 생성을 통해
병원의 매출과 환자 관리 품질을 높이는 운영 보조 웹앱입니다.

---

## 빠른 시작

```bash
npm install
npm run setup     # Prisma generate + DB push + seed (45명 mock 환자)
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

## 데이터 모델

| 모델 | 설명 |
|------|------|
| `Patient` | 환자 기본 정보 (차트번호, 이름, 성별, 생년, VIP) |
| `Visit` | 방문 이력 (날짜, 메모) |
| `Diagnosis` | 진단 코드 (KCD 코드, 치아번호) |
| `Procedure` | 처치 코드 (처치 코드, 치아번호) |
| `RecallRecommendation` | 리콜 추천 기록 (상태: pending/contacted/completed/dismissed) |
| `MessageDraft` | 문자 초안 (톤, 길이, 내용, 상태) |
| `RuleConfig` | 규칙 설정 (활성/비활성, JSON 파라미터) |

### 실제 EMR 연동 시 필요한 데이터
```
환자: 차트번호, 이름, 성별, 생년월일, 연락처
방문: 방문일, 메모
진단: KCD 진단코드, 진단명, 치아번호
처치: 처치코드, 처치명, 치아번호
```

---

## 규칙 엔진 구조

```
src/lib/engine/
├── index.ts              # 오케스트레이터 (모든 규칙 실행)
├── types.ts              # Rule 인터페이스 정의
├── scoring.ts            # 우선순위 점수 산정 (explainable)
└── rules/
    ├── treatment-dropout.ts  # 치료 중단 탐지
    ├── scaling-recall.ts     # 스케일링/치주 리콜
    ├── implant-followup.ts   # 임플란트 사후관리
    └── potential-demand.ts   # 잠재 수요 발굴
```

새 규칙 추가 시 `Rule` 인터페이스를 구현하고 `index.ts`의 `ALL_RULES`에 등록하면 됩니다.

---

## AI 메시지 생성 구조

```
src/lib/ai/
├── provider.ts           # AIProvider 인터페이스 (확장 포인트)
├── vertex.ts             # Vertex AI (Gemini) 프로바이더
├── template-fallback.ts  # 템플릿 기반 fallback 프로바이더
├── generate-message.ts   # 오케스트레이터 (provider 선택 + fallback)
└── prompts.ts            # 프롬프트 설계 (별도 모듈)
```

### Fallback 구조
```
ENABLE_LLM=true?
  → Vertex AI 호출 시도
    → 성공: generatedBy = "vertex"
    → 실패: 템플릿 fallback, generatedBy = "fallback"
ENABLE_LLM=false?
  → 직접 템플릿 사용, generatedBy = "template"
```

### 프로바이더 확장
`AIProvider` 인터페이스를 구현하면 OpenAI, Claude 등 다른 LLM도 추가 가능:
```typescript
interface AIProvider {
  name: string;
  generate(input: MessageGenerationInput): Promise<GeneratedMessages>;
  isAvailable(): Promise<boolean>;
}
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
| `DATABASE_URL` | O | `file:./dev.db` | SQLite DB 경로 |
| `ENABLE_LLM_MESSAGE_GENERATION` | X | `false` | LLM 메시지 생성 활성화 |
| `GOOGLE_CLOUD_PROJECT` | X | - | GCP 프로젝트 ID |
| `GOOGLE_CLOUD_LOCATION` | X | `us-central1` | Vertex AI 리전 |
| `VERTEX_MODEL` | X | `gemini-2.0-flash` | Vertex AI 모델 |
| `GOOGLE_APPLICATION_CREDENTIALS` | X | - | 서비스 계정 키 경로 |

---

## Mock vs 실제 연동 현황

| 기능 | 현재 상태 | 실제 연동 시 |
|------|-----------|-------------|
| 환자 데이터 | ✅ Mock 45명 seed | EMR/CRM API 연동 |
| 규칙 엔진 | ✅ 실제 작동 (규칙 기반) | 그대로 사용 + ML 확장 |
| 우선순위 점수 | ✅ 실제 작동 | 그대로 사용 |
| 문자 생성 (템플릿) | ✅ 실제 작동 | 그대로 사용 (fallback) |
| 문자 생성 (AI) | 🔧 Vertex AI 구조 준비 | 환경변수 설정만 하면 작동 |
| 상태 변경 | ✅ DB 저장 | 그대로 사용 |
| 문자 발송 | ❌ UI만 (발송 안 됨) | 문자 발송 API 연동 |
| 인증/권한 | ❌ 없음 | NextAuth 등 추가 |

---

## 보안 및 개인정보 주의사항

- 현재 mock 데이터만 사용하며 실제 환자 정보는 포함되어 있지 않습니다.
- 실제 운영 시 개인정보 마스킹/가명처리가 필요합니다.
  - 확장 포인트: `Patient` 모델의 `name`, `phone` 필드 마스킹 유틸리티 추가
- AI 프롬프트에 환자의 구체적 질환명/상세 치료 내용을 직접 전달하지 않도록 설계했습니다.
- 로그에 민감정보(이름, 전화번호)를 출력하지 않습니다.
- `.env` 파일은 git에 포함하지 마세요.

---

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run setup      # 전체 초기 설정 (설치 + DB + seed)
npm run db:push    # 스키마 반영
npm run db:seed    # seed 데이터 재삽입
npm run db:reset   # DB 초기화 + seed
npm run lint       # ESLint
```

---

## 확장 포인트 (V2+)

- **재방문 예측** (Revisit Prediction) — ML 기반 규칙 추가
- **케어 갭 분석** (Care Gap Analysis)
- **이탈 예측** (Churn Prediction)
- **실시간 알림/대시보드**
- **멀티테넌시** (병원별 분리)
- **실제 EMR 연동** (HL7 FHIR 등)
- **문자 발송 API 연동**

---

## 제품 원칙

1. **Explainability**: 모든 추천에 "왜?"를 보여줍니다
2. **운영 보조 도구**: AI가 의사를 대체하지 않음을 명확히 합니다
3. **병원 현장 수준**: 데스크 직원이 바로 이해할 수 있는 UI
4. **확장 가능 구조**: 규칙 엔진, AI 프로바이더 모두 인터페이스 기반 설계
5. **안전한 AI 메시지**: 광고/과장/불안 조장/의료 판단 금지 프롬프트
