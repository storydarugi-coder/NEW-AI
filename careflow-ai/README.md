# CareFlow AI — 치과/병원용 AI 리콜 관리 시스템

> ⚕️ **본 시스템은 병원 운영 보조 및 리콜 추천 도구이며, 의료적 판단을 대신하지 않습니다.**

## 빠른 시작

```bash
npm install
npm run setup     # Prisma generate + DB push + seed (45명 mock 환자)
npm run dev       # http://localhost:3000
```

## 기술 스택

Next.js 16 (App Router) / TypeScript / Tailwind CSS 4 / shadcn/ui / Prisma 5 / SQLite

## 주요 기능

- 대시보드: KPI 카드 + 우선순위 환자 리스트
- 환자 관리: 세그먼트 필터, 검색, 정렬, 상세 보기
- 규칙 기반 탐지 엔진: 신경치료/보철 중단, 스케일링/치주 리콜, 임플란트 점검, 잠재수요
- 문자 초안 생성: 톤/길이 선택, 템플릿 기반 (LLM 확장 가능)
- 관리자 설정: 규칙 on/off, 파라미터 조정

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run setup      # 전체 초기 설정
npm run db:seed    # seed 데이터 재삽입
npm run db:reset   # DB 초기화 + seed
```
