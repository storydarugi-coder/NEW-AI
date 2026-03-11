import { DetectionResult, RuleType } from "@/types";
import { PatientWithVisits, RuleParams } from "./types";
import { treatmentDropoutRule } from "./rules/treatment-dropout";
import { scalingRecallRule } from "./rules/scaling-recall";
import { implantFollowupRule } from "./rules/implant-followup";
import { potentialDemandRule } from "./rules/potential-demand";

const ALL_RULES = [
  treatmentDropoutRule,
  scalingRecallRule,
  implantFollowupRule,
  potentialDemandRule,
];

export interface EngineConfig {
  enabledRules: Set<RuleType>;
  params: RuleParams;
}

/**
 * 단일 환자에 대해 활성화된 모든 규칙을 실행합니다.
 */
export function evaluatePatient(
  patient: PatientWithVisits,
  config: EngineConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (const rule of ALL_RULES) {
    if (config.enabledRules.has(rule.type as RuleType)) {
      const ruleResults = rule.evaluate(patient, config.params);
      results.push(...ruleResults);
    }
  }

  // 우선순위순 정렬
  results.sort((a, b) => a.priority - b.priority);

  return results;
}

/**
 * 여러 환자에 대해 규칙 엔진을 실행합니다.
 */
export function evaluateAllPatients(
  patients: PatientWithVisits[],
  config: EngineConfig
): Map<string, DetectionResult[]> {
  const resultMap = new Map<string, DetectionResult[]>();

  for (const patient of patients) {
    const results = evaluatePatient(patient, config);
    if (results.length > 0) {
      resultMap.set(patient.id, results);
    }
  }

  return resultMap;
}

/**
 * DB의 RuleConfig에서 EngineConfig를 구성합니다.
 */
export function buildEngineConfig(
  ruleConfigs: { ruleType: string; enabled: boolean; parameters: string }[]
): EngineConfig {
  const enabledRules = new Set<RuleType>();
  const params: RuleParams = {};

  for (const rc of ruleConfigs) {
    if (rc.enabled) {
      enabledRules.add(rc.ruleType as RuleType);
    }
    try {
      const parsed = JSON.parse(rc.parameters);
      Object.assign(params, parsed);
    } catch {
      // ignore invalid JSON
    }
  }

  // 설정이 없으면 모든 규칙 활성화
  if (enabledRules.size === 0 && ruleConfigs.length === 0) {
    enabledRules.add("treatment_dropout");
    enabledRules.add("scaling_recall");
    enabledRules.add("implant_followup");
    enabledRules.add("potential_demand");
  }

  return { enabledRules, params };
}
