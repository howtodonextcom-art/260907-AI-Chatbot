export type ResolveUnknownPayload =
  | { action: "VERIFY_NOW" }
  | { action: "MARK_EXPERIMENT" }
  | { action: "REQUEST_HUMAN_DECISION" }
  | { action: "RESOLVE_WITH_EVIDENCE"; evidenceIds: string[] }
  | { action: "HUMAN_DECISION"; resolutionNote: string }
  | { action: "ACCEPT_RISK"; resolutionNote: string };
