import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { artists } from "./artists";

/** Mirror of ContractAnalysis from @workspace/integrations-gemini-ai — kept local to avoid circular deps */
export type ContractAnalysisResult = {
  summary: string;
  keyTerms: string[];
  riskFlags: string[];
  royaltyRate?: string;
  contractDuration?: string;
  recommendation: "SIGN" | "NEGOTIATE" | "REJECT" | "REVIEW";
  confidenceScore: number;
};

export const contractStatusEnum = pgEnum("contract_status", [
  "DRAFT",
  "PENDING",
  "SIGNED",
  "REJECTED",
  "EXPIRED",
]);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    status: contractStatusEnum("status").notNull().default("DRAFT"),
    pdfUrl: text("pdf_url"),
    pdfText: text("pdf_text"),
    aiAnalysis: jsonb("ai_analysis").$type<ContractAnalysisResult>(),
    aiConfidence: real("ai_confidence"),
    terms: jsonb("terms").$type<Record<string, unknown>>(),
    royaltyRate: text("royalty_rate"),
    contractDuration: text("contract_duration"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("contracts_artist_id_idx").on(t.artistId),
    index("contracts_status_idx").on(t.status),
    index("contracts_deleted_at_idx").on(t.deletedAt),
  ],
);

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;
