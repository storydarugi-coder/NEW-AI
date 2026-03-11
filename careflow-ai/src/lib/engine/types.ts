import { DetectionResult } from "@/types";

export interface PatientWithVisits {
  id: string;
  visits: {
    id: string;
    visitDate: Date;
    procedures: { code: string; name: string; tooth: string | null }[];
    diagnoses: { code: string; name: string; tooth: string | null }[];
  }[];
}

export interface RuleParams {
  [key: string]: number | number[] | boolean | string;
}

export interface Rule {
  type: string;
  evaluate(patient: PatientWithVisits, params: RuleParams): DetectionResult[];
}
