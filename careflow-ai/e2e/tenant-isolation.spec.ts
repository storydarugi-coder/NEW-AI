/**
 * 멀티테넌시 데이터 격리 테스트
 *
 * 시나리오:
 * 1. 병원A(서울) 계정 → 병원B(부산) 환자 목록/상세 접근 차단
 * 2. 병원A 계정 → 병원B 환자에 메시지 생성 차단
 * 3. 병원A 계정 → 병원B outbound 액션 차단
 * 4. 슈퍼어드민(tenantId=null) → 전체 데이터 접근 허용
 * 5. 병원A 계정 → 병원B 직원 미노출
 *
 * 사전 조건: seed 완료
 *   - desk01/desk123 (서울, tenant_a)
 *   - desk_b01/desk123 (부산, tenant_b)
 *   - admin/admin123 (슈퍼어드민, tenantId=null)
 *
 * 실행: npx playwright test e2e/tenant-isolation.spec.ts
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

async function apiGet(page: Page, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await page.request.get(`${BASE}${path}`);
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function apiPost(page: Page, path: string, data: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await page.request.post(`${BASE}${path}`, { data: data as Record<string, unknown> });
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

// ── 테스트 ──

test.describe("테넌트 데이터 격리", () => {
  test.describe.configure({ mode: "serial" });

  // 병원A 환자 목록에 병원B 환자가 포함되지 않음
  test("병원A 계정 → 자기 테넌트 환자만 조회", async ({ page }) => {
    await login(page, "desk01", "desk123");
    const res = await apiGet(page, "/api/patients?limit=100");
    expect(res.status).toBe(200);

    const patients = res.body.patients as Array<{ chartNumber: string }>;
    expect(patients.length).toBeGreaterThan(0);

    // 병원A 환자 (CF-0001~CF-0005)만 포함
    const chartNumbers = patients.map((p) => p.chartNumber);
    for (const cn of chartNumbers) {
      expect(["CF-0001", "CF-0002", "CF-0003", "CF-0004", "CF-0005"]).toContain(cn);
    }

    // 병원B 환자 (CF-0006~CF-0010) 미포함
    expect(chartNumbers).not.toContain("CF-0006");
    expect(chartNumbers).not.toContain("CF-0010");
  });

  // 병원B 계정도 자기 테넌트만 조회
  test("병원B 계정 → 자기 테넌트 환자만 조회", async ({ page }) => {
    await login(page, "viewer01", "view123");
    const res = await apiGet(page, "/api/patients?limit=100");
    expect(res.status).toBe(200);

    const patients = res.body.patients as Array<{ chartNumber: string }>;
    expect(patients.length).toBeGreaterThan(0);

    const chartNumbers = patients.map((p) => p.chartNumber);
    for (const cn of chartNumbers) {
      expect(["CF-0006", "CF-0007", "CF-0008", "CF-0009", "CF-0010"]).toContain(cn);
    }
    expect(chartNumbers).not.toContain("CF-0001");
  });

  // 병원A 계정 → 병원B 환자 상세 접근 차단
  test("병원A 계정 → 병원B 환자 상세 접근 403", async ({ page }) => {
    await login(page, "desk01", "desk123");

    // 먼저 병원B 환자 ID를 admin으로 알아내기
    const adminPage = await page.context().newPage();
    await login(adminPage, "admin", "admin123");
    const adminRes = await apiGet(adminPage, "/api/patients?limit=100");
    const allPatients = adminRes.body.patients as Array<{ id: string; chartNumber: string }>;
    const tenantBPatient = allPatients.find((p) => p.chartNumber === "CF-0006");
    expect(tenantBPatient).toBeDefined();
    await adminPage.close();

    // desk01(tenant_a)로 tenant_b 환자 접근 시도
    const res = await apiGet(page, `/api/patients/${tenantBPatient!.id}`);
    expect(res.status).toBe(403);
  });

  // 병원A 계정 → 병원B 환자에 메시지 생성 차단
  test("병원A 계정 → 병원B 환자 메시지 생성 403", async ({ page }) => {
    await login(page, "desk01", "desk123");

    // admin으로 병원B 환자 ID 획득
    const adminPage = await page.context().newPage();
    await login(adminPage, "admin", "admin123");
    const adminRes = await apiGet(adminPage, "/api/patients?limit=100");
    const allPatients = adminRes.body.patients as Array<{ id: string; chartNumber: string }>;
    const tenantBPatient = allPatients.find((p) => p.chartNumber === "CF-0007");
    expect(tenantBPatient).toBeDefined();
    await adminPage.close();

    // desk01(tenant_a)로 tenant_b 환자에 메시지 생성 시도
    const res = await apiPost(page, "/api/messages", {
      patientId: tenantBPatient!.id,
      tone: "polite",
    });
    expect(res.status).toBe(403);
  });

  // 병원A 계정 → 병원B outbound 메시지 생성 차단
  test("병원A 계정 → 병원B 환자 outbound 생성 403", async ({ page }) => {
    await login(page, "desk01", "desk123");

    // admin으로 병원B 환자 ID 획득
    const adminPage = await page.context().newPage();
    await login(adminPage, "admin", "admin123");
    const adminRes = await apiGet(adminPage, "/api/patients?limit=100");
    const allPatients = adminRes.body.patients as Array<{ id: string; chartNumber: string }>;
    const tenantBPatient = allPatients.find((p) => p.chartNumber === "CF-0008");
    expect(tenantBPatient).toBeDefined();
    await adminPage.close();

    const res = await apiPost(page, "/api/outbound", {
      patientId: tenantBPatient!.id,
      messageType: "recall",
      draftMessage: "테스트 메시지",
    });
    expect(res.status).toBe(403);
  });

  // 슈퍼어드민은 전체 데이터 접근
  test("슈퍼어드민(tenantId=null) → 전체 환자 접근", async ({ page }) => {
    await login(page, "admin", "admin123");
    const res = await apiGet(page, "/api/patients?limit=100");
    expect(res.status).toBe(200);

    const patients = res.body.patients as Array<{ chartNumber: string }>;
    const chartNumbers = patients.map((p) => p.chartNumber);
    // 양쪽 테넌트 환자 모두 포함
    expect(chartNumbers).toContain("CF-0001");
    expect(chartNumbers).toContain("CF-0006");
    expect(chartNumbers).toContain("CF-0010");
  });

  // 슈퍼어드민은 모든 환자 상세 접근 가능
  test("슈퍼어드민 → 어떤 환자든 상세 접근 가능", async ({ page }) => {
    await login(page, "admin", "admin123");

    const res = await apiGet(page, "/api/patients?limit=100");
    const allPatients = res.body.patients as Array<{ id: string; chartNumber: string }>;
    const tenantAPatient = allPatients.find((p) => p.chartNumber === "CF-0001");
    const tenantBPatient = allPatients.find((p) => p.chartNumber === "CF-0006");

    const resA = await apiGet(page, `/api/patients/${tenantAPatient!.id}`);
    expect(resA.status).toBe(200);

    const resB = await apiGet(page, `/api/patients/${tenantBPatient!.id}`);
    expect(resB.status).toBe(200);
  });

  // 병원A 계정 → staff 목록에 병원B 직원 미포함
  test("병원A 계정 → 자기 테넌트 직원만 조회", async ({ page }) => {
    await login(page, "desk01", "desk123");
    const res = await apiGet(page, "/api/staff");
    expect(res.status).toBe(200);

    const staff = res.body as unknown as Array<{ name: string; tenantId?: string | null }>;
    for (const s of staff) {
      // tenant_a 직원이거나 tenantId가 null(전체 공유)인 것만 허용
      expect([null, undefined, "tenant_a"]).toContain(s.tenantId);
    }
  });

  // admin/users에서 hospital 계정 tenantId 필수 검증
  test("admin → hospital 계정에 tenantId 없이 설정 시 400", async ({ page }) => {
    await login(page, "admin", "admin123");

    // 먼저 desk02(all, tenantId=null)를 hospital로 변경 시도 (tenantId 없이)
    const usersRes = await apiGet(page, "/api/admin/users");
    const users = (usersRes.body.users as Array<{ id: string; username: string }>);
    const desk02 = users.find((u) => u.username === "desk02");
    expect(desk02).toBeDefined();

    const res = await page.request.patch(`${BASE}/api/admin/users`, {
      data: { userId: desk02!.id, productArea: "hospital" },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("tenantId");
  });
});
