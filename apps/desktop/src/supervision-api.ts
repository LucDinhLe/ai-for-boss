import type { AdvisorModel, AdvisorResult } from './advisor-types';
export type SupervisionState = { id: string; key: string; phase: string; busy: boolean; accepted: boolean; modelActive?: boolean;
  plan: string; consultation?: string; planAttempt?: number; workAttempt?: number; planReview: AdvisorResult | null; finalReview: AdvisorResult | null; error: string | null };
export type SupervisionChoice = { enabled: boolean; model: AdvisorModel | null };
export async function supervisionRequest<T>(input: unknown): Promise<T> {
  if (!window.aiForBoss?.advisor) throw new Error('Chưa có cầu nối Advisor.');
  return (window.aiForBoss.advisor.request as (payload: unknown) => Promise<T>)(input);
}
