export type EffortLevel = "minimum" | "target" | "stretch";

export interface Provenance {
  source: "member_manual" | "coach_on_behalf" | "wearable" | "imported_document" | "system_derived";
  enteredBy: string;
  at: string;
}

export interface Member {
  id: string;
  name: string;
  week: number;
  phase: "Stabilise" | "Build" | "Consolidate";
  weeklyFocus: string[];
  goals: string[];
  constraints: string[];
  activeModuleIds: string[];
  lastPlanChange?: { at: string; rationale: string };
}

export interface DailyAction {
  id: string;
  memberId: string;
  dayOffset: number;
  title: string;
  why: string;
  minimum: { label: string; minutes: number };
  target: { label: string; minutes: number };
  stretch: { label: string; minutes: number };
  completed: EffortLevel | "rest" | null;
}

export interface PulseEntry {
  id: string;
  memberId: string;
  dayOffset: number;
  energy: number;
  sleep: number;
  stress: number;
  partial?: boolean;
  symptoms: string[];
  note?: string;
  provenance: Provenance;
}

export interface Message {
  id: string;
  memberId: string;
  from: "coach" | "member" | "system";
  kind: "text" | "voice" | "plan_update";
  body: string;
  dayOffset: number;
  time: string;
  read: boolean;
}

export interface Session {
  id: string;
  memberId: string;
  dayOffset: number;
  time: string;
  type: string;
  status: string;
}

export interface MemberDoc {
  member: Member;
  actions: DailyAction[];
  pulses: PulseEntry[];
  messages: Message[];
  sessions: Session[];
  workoutLogs: unknown[];
  reports: unknown[];
  foodEntries: unknown[];
}
