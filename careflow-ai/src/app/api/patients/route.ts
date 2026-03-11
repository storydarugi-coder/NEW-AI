import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get("segment"); // treatment_dropout, scaling_recall, implant_followup, potential_demand
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "priority"; // priority, name, lastVisit
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // 모든 환자 + 방문 이력
    const patients = await prisma.patient.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { chartNumber: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      include: {
        visits: {
          include: {
            procedures: true,
            diagnoses: true,
          },
          orderBy: { visitDate: "desc" },
        },
      },
    });

    // 규칙 엔진 실행
    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);
    const detectionMap = evaluateAllPatients(patients, engineConfig);

    // 결과 매핑
    const results = patients.map((patient) => {
      const detections = detectionMap.get(patient.id) || [];
      const lastVisit = patient.visits[0]?.visitDate || null;

      return {
        id: patient.id,
        chartNumber: patient.chartNumber,
        name: patient.name,
        gender: patient.gender,
        birthYear: patient.birthYear,
        phone: patient.phone,
        isVip: patient.isVip,
        memo: patient.memo,
        lastVisitDate: lastVisit,
        visitCount: patient.visits.length,
        detections: detections.map((d) => ({
          ruleType: d.ruleType,
          subType: d.subType,
          priority: d.priority,
          reason: d.reason,
        })),
        topPriority: detections.length > 0 ? Math.min(...detections.map((d) => d.priority)) : 99,
        hasAction: detections.length > 0,
      };
    });

    // 세그먼트 필터
    let filtered = results;
    if (segment) {
      if (segment === "vip") {
        filtered = results.filter((r) => r.isVip);
      } else if (segment === "no_recent_visit") {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        filtered = results.filter(
          (r) => r.lastVisitDate && new Date(r.lastVisitDate) < sixMonthsAgo
        );
      } else {
        filtered = results.filter((r) =>
          r.detections.some((d) => d.ruleType === segment)
        );
      }
    }

    // 정렬
    if (sort === "priority") {
      filtered.sort((a, b) => a.topPriority - b.topPriority);
    } else if (sort === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else if (sort === "lastVisit") {
      filtered.sort((a, b) => {
        if (!a.lastVisitDate) return 1;
        if (!b.lastVisitDate) return -1;
        return new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime();
      });
    }

    // 페이지네이션
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      patients: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Patients API error:", error);
    return NextResponse.json(
      { error: "환자 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
