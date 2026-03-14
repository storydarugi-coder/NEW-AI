/**
 * productArea 접근 제어 스모크 테스트
 *
 * 시나리오:
 * 1. 병원 계정 → 병원 메뉴만 표시, 내부 API 403
 * 2. 내부 계정 → 내부 메뉴만 표시, 병원 API 403
 * 3. 관리자 → 전체 메뉴 표시, 유저 관리 접근 가능
 * 4. 관리자가 유저 productArea 변경 → 기존 세션 무효화
 *
 * 사전 조건: seed 완료 (admin/admin123, desk01/desk123, mkt01/mkt123)
 *
 * 실행: npx playwright test e2e/product-area-smoke.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3000";

// ── 헬퍼 ──

async function login(page: Page, username: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 5000 });
}

async function apiGet(page: Page, path: string): Promise<{ status: number; body: unknown }> {
  const res = await page.request.get(`${BASE}${path}`);
  return { status: res.status(), body: await res.json().catch(() => null) };
}

// ── 1. 병원 계정 (desk01 / hospital) ──

test.describe("병원 계정 (desk01)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "desk01", "desk123");
  });

  test("사이드바에 병원 SaaS 메뉴만 표시", async ({ page }) => {
    // 병원 메뉴 존재
    await expect(page.getByText("대시보드")).toBeVisible();
    await expect(page.getByText("후속관리 업무")).toBeVisible();
    await expect(page.getByText("환자 관리")).toBeVisible();

    // 내부 메뉴 미표시
    await expect(page.getByText("CPA 광고 관리")).not.toBeVisible();
    await expect(page.getByText("유입 경로 검토")).not.toBeVisible();
    await expect(page.getByText("유입 경로 규칙")).not.toBeVisible();
  });

  test("병원 API 접근 성공", async ({ page }) => {
    const { status } = await apiGet(page, "/api/dashboard");
    expect(status).toBe(200);
  });

  test("내부 API 접근 차단 (403)", async ({ page }) => {
    const { status: ctaStatus } = await apiGet(page, "/api/cta");
    expect(ctaStatus).toBe(403);

    const { status: srStatus } = await apiGet(page, "/api/source-review");
    expect(srStatus).toBe(403);

    const { status: syncStatus } = await apiGet(page, "/api/sync");
    expect(syncStatus).toBe(403);
  });

  test("공유 API 접근 성공 (reports, staff)", async ({ page }) => {
    const { status: reportsStatus } = await apiGet(page, "/api/reports/kpi?period=30d");
    expect(reportsStatus).toBe(200);

    const { status: staffStatus } = await apiGet(page, "/api/staff");
    expect(staffStatus).toBe(200);
  });
});

// ── 2. 내부 계정 (mkt01 / internal) ──

test.describe("내부 계정 (mkt01)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "mkt01", "mkt123");
  });

  test("사이드바에 회사 운영 메뉴만 표시", async ({ page }) => {
    // 내부 메뉴 존재
    await expect(page.getByText("CPA 광고 관리")).toBeVisible();
    await expect(page.getByText("유입 경로 검토")).toBeVisible();

    // 병원 메뉴 미표시
    await expect(page.getByText("후속관리 업무")).not.toBeVisible();
    await expect(page.getByText("환자 관리")).not.toBeVisible();
  });

  test("내부 API 접근 성공", async ({ page }) => {
    const { status } = await apiGet(page, "/api/cta");
    expect(status).toBe(200);
  });

  test("병원 API 접근 차단 (403)", async ({ page }) => {
    const { status: dashStatus } = await apiGet(page, "/api/dashboard");
    expect(dashStatus).toBe(403);

    const { status: patientsStatus } = await apiGet(page, "/api/patients");
    expect(patientsStatus).toBe(403);

    const { status: workflowStatus } = await apiGet(page, "/api/workflow/tasks");
    expect(workflowStatus).toBe(403);
  });
});

// ── 3. 관리자 (admin / all) ──

test.describe("관리자 (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", "admin123");
  });

  test("사이드바에 양쪽 메뉴 모두 표시", async ({ page }) => {
    await expect(page.getByText("대시보드")).toBeVisible();
    await expect(page.getByText("CPA 광고 관리")).toBeVisible();
    await expect(page.getByText("유입 경로 검토")).toBeVisible();
    await expect(page.getByText("환자 관리")).toBeVisible();
  });

  test("양쪽 API 모두 접근 성공", async ({ page }) => {
    const { status: dashStatus } = await apiGet(page, "/api/dashboard");
    expect(dashStatus).toBe(200);

    const { status: ctaStatus } = await apiGet(page, "/api/cta");
    expect(ctaStatus).toBe(200);
  });

  test("유저 관리 API 접근 가능", async ({ page }) => {
    const { status } = await apiGet(page, "/api/admin/users");
    expect(status).toBe(200);
  });

  test("감사 로그 API 접근 가능", async ({ page }) => {
    const { status } = await apiGet(page, "/api/admin/audit-logs");
    expect(status).toBe(200);
  });
});

// ── 4. /cta → /internal/cpa 리다이렉트 ──

test.describe("CTA → Internal/CPA 리다이렉트", () => {
  test("레거시 /cta 접근 시 /internal/cpa 로 리다이렉트", async ({ page }) => {
    await login(page, "mkt01", "mkt123");
    await page.goto(`${BASE}/cta`);
    await page.waitForURL((url) => url.pathname === "/internal/cpa", { timeout: 5000 });
    expect(page.url()).toContain("/internal/cpa");
  });

  test("내부 계정 로그인 → /internal/cpa 랜딩", async ({ page }) => {
    await login(page, "mkt01", "mkt123");
    // 로그인 후 /internal/cpa로 이동해야 함
    expect(page.url()).toContain("/internal/cpa");
  });
});

// ── 5. 비인증 접근 차단 ──

test.describe("비인증 접근", () => {
  test("API 호출 시 401", async ({ page }) => {
    const endpoints = ["/api/dashboard", "/api/cta", "/api/patients", "/api/source-review"];
    for (const ep of endpoints) {
      const { status } = await apiGet(page, ep);
      expect(status).toBe(401);
    }
  });
});

// ── 6. 세션 무효화 (관리자가 productArea 변경 후) ──

test.describe("세션 무효화", () => {
  test("관리자가 productArea 변경 → 기존 세션 401", async ({ browser }) => {
    // desk01로 로그인
    const deskContext = await browser.newContext();
    const deskPage = await deskContext.newPage();
    await login(deskPage, "desk01", "desk123");

    // desk01이 dashboard 접근 → 성공
    const { status: beforeStatus } = await apiGet(deskPage, "/api/dashboard");
    expect(beforeStatus).toBe(200);

    // admin으로 로그인하여 desk01의 productArea를 internal로 변경
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, "admin", "admin123");

    // 유저 목록 가져오기
    const usersRes = await adminPage.request.get(`${BASE}/api/admin/users`);
    const usersData = await usersRes.json();
    const desk01 = usersData.users.find((u: { username: string }) => u.username === "desk01");

    // productArea 변경
    await adminPage.request.patch(`${BASE}/api/admin/users`, {
      data: { userId: desk01.id, productArea: "internal" },
    });

    // desk01의 기존 세션으로 dashboard 접근 → 401 (세션 만료)
    const { status: afterStatus } = await apiGet(deskPage, "/api/dashboard");
    expect(afterStatus).toBe(401);

    // 원복: desk01 productArea를 hospital로 되돌리기
    await adminPage.request.patch(`${BASE}/api/admin/users`, {
      data: { userId: desk01.id, productArea: "hospital" },
    });

    await deskContext.close();
    await adminContext.close();
  });
});
