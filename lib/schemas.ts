import { z } from "zod";

export const strategySchema = z.enum(["llm", "dm", "hybrid"]);
export type Strategy = z.infer<typeof strategySchema>;
export const ticketSchema = z.strictObject({
  subject: z.string().max(500),
  body: z.string().trim().min(1, "Describe the ticket before submitting.").max(20000),
});
export const triageRequestSchema = ticketSchema.extend({ strategy: strategySchema.default("llm") });
export const categorySchema = z.enum(["account", "billing", "feature_request", "technical_bug"]);
export const prioritySchema = z.enum(["low", "medium", "high"]);
export const predictionSchema = z.strictObject({
  category: categorySchema,
  priority: prioritySchema,
  needs_human_review: z.boolean(),
  explanation: z.string().min(1),
});
export const usageSchema = z.strictObject({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).refine(u => u.total === u.input + u.output, "Total tokens must equal input plus output.");
const probability = z.number().min(0).max(1);
export const dmDetailsSchema = z.strictObject({
  categoryProbabilities: z.strictObject({ account: probability, billing: probability, feature_request: probability, technical_bug: probability }),
  priorityProbabilities: z.strictObject({ low: probability, medium: probability, high: probability }),
  categoryConfidence: probability,
  priorityConfidence: probability,
  priorityScore: z.number().min(0).max(2),
  reviewProbability: probability,
});
export const stageSchema = z.strictObject({
  provider: z.enum(["llm", "dm"]),
  model: z.string(),
  prediction: predictionSchema.nullable(),
  usage: usageSchema.nullable(),
  latencyMs: z.number().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
  retries: z.number().int().nonnegative(),
});
export const triageResponseSchema = z.strictObject({
  prediction: predictionSchema,
  usage: usageSchema.nullable(),
  model: z.string(),
  strategy: strategySchema,
  stages: z.array(stageSchema).min(1),
  dm: dmDetailsSchema.nullable(),
  latencyMs: z.number().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
});
export const triageRequestJsonSchema = z.toJSONSchema(triageRequestSchema);
export const triageResponseJsonSchema = z.toJSONSchema(triageResponseSchema);
export const smokeRequestSchema = z.strictObject({
  dataset: z.enum(["labelled100", "tickets500"]),
  sampleSize: z.number().int().min(1).max(500),
  strategy: strategySchema.default("llm"),
  sampleSeed: z.string().trim().min(1).max(100).optional(),
}).refine(x => x.dataset !== "labelled100" || x.sampleSize <= 100, {
  message: "The labelled dataset contains only 100 tickets.", path: ["sampleSize"],
});
export type TriageResult = z.infer<typeof triageResponseSchema>;
export type Prediction = z.infer<typeof predictionSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type DmDetails = z.infer<typeof dmDetailsSchema>;
export function validationMessage(error: z.ZodError) {
  return error.issues.map(i => `${i.path.join(".") || "Request"}: ${i.message}`).join("; ");
}
