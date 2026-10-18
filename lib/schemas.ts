import { z } from "zod";

export const triageRequestSchema = z.strictObject({
  subject: z.string().max(500),
  body: z.string().trim().min(1, "Describe the ticket before submitting.").max(20000),
});
export const predictionSchema = z.strictObject({
  category: z.enum(["account", "billing", "feature_request", "technical_bug"]),
  priority: z.enum(["low", "medium", "high"]),
  needs_human_review: z.boolean(),
  explanation: z.string().min(1),
});
export const usageSchema = z.strictObject({
  input: z.number().int().nonnegative(), output: z.number().int().nonnegative(), total: z.number().int().nonnegative(),
});
export const triageResponseSchema = z.strictObject({
  prediction: predictionSchema, usage: usageSchema.nullable(), model: z.string(), latencyMs: z.number().nonnegative(), costUsd: z.number().nonnegative().nullable(),
});
export const triageRequestJsonSchema = z.toJSONSchema(triageRequestSchema);
export const triageResponseJsonSchema = z.toJSONSchema(triageResponseSchema);
export const smokeRequestSchema = z.strictObject({ dataset: z.enum(["labelled100", "tickets500"]), sampleSize: z.number().int().min(1).max(500) }).refine(x => x.dataset !== "labelled100" || x.sampleSize <= 100, { message: "The labelled dataset contains only 100 tickets.", path: ["sampleSize"] });
export type TriageResult = z.infer<typeof triageResponseSchema>;
export function validationMessage(error: z.ZodError) { return error.issues.map(i => `${i.path.join(".") || "Request"}: ${i.message}`).join("; "); }
