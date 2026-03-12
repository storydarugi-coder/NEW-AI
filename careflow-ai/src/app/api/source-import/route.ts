import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSource, dbRuleToDefinition } from "@/lib/attribution/normalizer";
import { randomUUID } from "crypto";

/**
 * CSV Import API
 *
 * POST /api/source-import — CSV 파싱 + 정규화 파이프라인 실행
 * GET  /api/source-import — Import 배치 이력 조회
 */

const MAX_CSV_ROWS = 5000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface CsvRow {
  chartNumber?: string;
  sourceRaw: string;
  visitDate?: string;
  memo?: string;
}

function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV 파일에 헤더와 데이터가 최소 2줄 이상 필요합니다."] };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const errors: string[] = [];
  const rows: CsvRow[] = [];

  // 필수 컬럼 검증
  const sourceRawIdx = header.findIndex((h) => h === "sourceraw" || h === "source_raw" || h === "방문경로" || h === "유입경로");
  if (sourceRawIdx === -1) {
    return { rows: [], errors: ["필수 컬럼 'sourceRaw' (또는 '방문경로', '유입경로')이 없습니다."] };
  }

  const chartIdx = header.findIndex((h) => h === "chartnumber" || h === "chart_number" || h === "차트번호" || h === "patientid");
  const dateIdx = header.findIndex((h) => h === "visitdate" || h === "visit_date" || h === "방문일" || h === "날짜");
  const memoIdx = header.findIndex((h) => h === "memo" || h === "note" || h === "비고" || h === "메모");

  for (let i = 1; i < lines.length; i++) {
    if (i > MAX_CSV_ROWS) {
      errors.push(`최대 ${MAX_CSV_ROWS}행까지만 처리됩니다. ${lines.length - 1}행 중 ${MAX_CSV_ROWS}행만 처리합니다.`);
      break;
    }

    const fields = parseCsvLine(lines[i]);
    const sourceRaw = fields[sourceRawIdx]?.trim();

    if (!sourceRaw) {
      errors.push(`${i + 1}행: sourceRaw(방문경로)가 비어있습니다. 건너뜁니다.`);
      continue;
    }

    rows.push({
      chartNumber: chartIdx >= 0 ? fields[chartIdx]?.trim() || undefined : undefined,
      sourceRaw,
      visitDate: dateIdx >= 0 ? fields[dateIdx]?.trim() || undefined : undefined,
      memo: memoIdx >= 0 ? fields[memoIdx]?.trim() || undefined : undefined,
    });
  }

  return { rows, errors };
}

/** 간단한 CSV 라인 파서 (쌍따옴표 처리) */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.replace(/^"|"$/g, "").trim());
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let csvText: string;
    let fileName = "import.csv";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "CSV 파일이 필요합니다." }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `파일 크기가 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과합니다.` }, { status: 400 });
      }
      fileName = file.name;
      csvText = await file.text();
    } else {
      const body = await request.json();
      if (!body.csvText) {
        return NextResponse.json({ error: "csvText 또는 파일이 필요합니다." }, { status: 400 });
      }
      csvText = body.csvText;
      fileName = body.fileName || "import.csv";
    }

    // CSV 파싱
    const { rows, errors: parseErrors } = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({
        error: "유효한 데이터가 없습니다.",
        parseErrors,
      }, { status: 400 });
    }

    // DB 규칙 로드
    const dbRules = await prisma.sourceRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
    });
    const rules = dbRules.length > 0 ? dbRules.map(dbRuleToDefinition) : undefined;

    // 차트번호 → 환자 매핑
    const chartNumbers = rows.map((r) => r.chartNumber).filter(Boolean) as string[];
    const patientsMap = new Map<string, string>();
    if (chartNumbers.length > 0) {
      const patients = await prisma.patient.findMany({
        where: { chartNumber: { in: chartNumbers } },
        select: { id: true, chartNumber: true },
      });
      for (const p of patients) {
        patientsMap.set(p.chartNumber, p.id);
      }
    }

    // 기존 환자가 없는 경우 첫 번째 환자를 기본값으로 사용
    let defaultPatientId: string | null = null;
    if (patientsMap.size === 0) {
      const firstPatient = await prisma.patient.findFirst({ select: { id: true } });
      defaultPatientId = firstPatient?.id || null;
    }

    // Import 배치 생성
    const batchId = randomUUID();
    await prisma.importBatch.create({
      data: {
        id: batchId,
        fileName,
        totalRows: rows.length,
        status: "processing",
      },
    });

    // 정규화 실행 + Visit 생성
    let successCount = 0;
    let failCount = 0;
    let unclassifiedCount = 0;
    let reviewNeededCount = 0;
    const historyRows: {
      id: string;
      visitId: string;
      newNormalizedSource: string | null;
      newCategory: string | null;
      newCtaCandidate: boolean | null;
      newReviewStatus: string;
      changeType: string;
      changeMemo: string | null;
    }[] = [];

    for (const row of rows) {
      try {
        const patientId = row.chartNumber
          ? patientsMap.get(row.chartNumber) || defaultPatientId
          : defaultPatientId;

        if (!patientId) {
          failCount++;
          continue;
        }

        // 정규화 실행
        const norm = normalizeSource(row.sourceRaw, rules);
        const matchedRuleId = norm.matchedRuleName && dbRules.length > 0
          ? dbRules.find((r) => r.ruleName === norm.matchedRuleName)?.id || null
          : null;
        const isHighConfidence = norm.matchConfidence === "HIGH";

        // Visit 생성
        const visitId = randomUUID();
        const visitDate = row.visitDate ? new Date(row.visitDate) : new Date();

        await prisma.visit.create({
          data: {
            id: visitId,
            patientId,
            visitDate,
            memo: row.memo || `CSV import: ${fileName}`,
            sourceRaw: row.sourceRaw,
            normalizedSource: norm.normalizedSource,
            sourceCategory: norm.sourceCategory,
            ctaCandidate: norm.ctaCandidate,
            matchConfidence: norm.matchConfidence,
            matchReason: norm.matchReason,
            matchedRuleId,
            reviewedSource: isHighConfidence ? norm.normalizedSource : null,
            reviewedCategory: isHighConfidence ? norm.sourceCategory : null,
            reviewedCtaFlag: isHighConfidence ? norm.ctaCandidate : null,
            sourceReviewStatus: isHighConfidence ? "auto_confirmed" : "unreviewed",
          },
        });

        // 이력 기록
        historyRows.push({
          id: randomUUID(),
          visitId,
          newNormalizedSource: norm.normalizedSource,
          newCategory: norm.sourceCategory,
          newCtaCandidate: norm.ctaCandidate,
          newReviewStatus: isHighConfidence ? "auto_confirmed" : "unreviewed",
          changeType: "csv_import",
          changeMemo: `CSV import: ${fileName}`,
        });

        successCount++;
        if (norm.normalizedSource === "Unknown") unclassifiedCount++;
        if (!isHighConfidence) reviewNeededCount++;
      } catch {
        failCount++;
      }
    }

    // 이력 벌크 생성
    if (historyRows.length > 0) {
      await prisma.sourceNormalizationHistory.createMany({ data: historyRows });
    }

    // 배치 상태 업데이트
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "completed",
        successCount,
        failCount,
        unclassifiedCount,
        reviewNeededCount,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "csv_import",
        entityType: "import_batch",
        entityId: batchId,
        detail: JSON.stringify({ fileName, totalRows: rows.length, successCount, failCount, unclassifiedCount, reviewNeededCount }),
      },
    });

    return NextResponse.json({
      success: true,
      batchId,
      summary: {
        totalRows: rows.length,
        successCount,
        failCount,
        unclassifiedCount,
        reviewNeededCount,
      },
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { error: "CSV import 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ batches });
  } catch (error) {
    console.error("Import history GET error:", error);
    return NextResponse.json({ error: "Import 이력 조회 실패" }, { status: 500 });
  }
}
