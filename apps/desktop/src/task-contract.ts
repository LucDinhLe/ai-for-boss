/**
 * Renderer copy of the three task-contract buttons (spec 0056). The plugin in
 * packages/harness-plugin/contract.mjs owns the caps; this file only carries
 * what the composer shows and which thinking level each button prefers. A unit
 * test keeps the two lists identical.
 */
export type ContractMode = "nhanh" | "ky" | "quyet-dinh";
export const CONTRACT_MODES: readonly { id: ContractMode; label: string; hint: string; thinking: readonly string[] }[] = [
  { id: "nhanh", label: "Nhanh", hint: "Trả lời ngắn, ít bước, không tra cứu dài.", thinking: ["low", "minimal", "off"] },
  { id: "ky", label: "Kỹ", hint: "Làm cẩn thận, được dùng nhiều bước và tra cứu.", thinking: ["medium", "low"] },
  { id: "quyet-dinh", label: "Quyết định quan trọng", hint: "Cân nhắc nhiều phương án, nêu rủi ro, ghi sổ quyết định.", thinking: ["high", "xhigh", "medium"] }
];
export const isContractMode = (value: unknown): value is ContractMode => CONTRACT_MODES.some(mode => mode.id === value);
/** Thinking level the button prefers among the levels this model actually offers; null leaves the model's default alone. */
export function contractThinking(mode: ContractMode | null, levels: readonly { id: string }[]): string | null {
  const spec = CONTRACT_MODES.find(item => item.id === mode);
  if (!spec) return null;
  return spec.thinking.find(level => levels.some(option => option.id === level)) ?? null;
}
