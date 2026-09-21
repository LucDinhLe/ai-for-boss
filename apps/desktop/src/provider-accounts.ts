import { compareProviders, providerLabel } from "./provider-order.ts";

/**
 * Projection for Settings → Nhà cung cấp (spec 0060).
 *
 * Everything here comes from the core's own `models.authStatus`: which
 * providers exist, which accounts are stored under each, their health and the
 * usage the core recorded. The shell adds Vietnamese labels and an order, and
 * names no provider of its own, so a provider OpenClaw adds later shows up with
 * no code change (D-0022).
 */
export type AuthProfile = {
  profileId: string;
  type: "oauth" | "token" | "api_key";
  status: "ok" | "expiring" | "expired" | "missing" | "static";
  expiry?: { label?: string; remainingMs?: number };
  logoutSupported?: boolean;
};
export type AuthProvider = {
  provider: string;
  displayName?: string;
  status: "ok" | "expiring" | "expired" | "missing" | "static";
  expiry?: { label?: string };
  profiles?: AuthProfile[];
  apiKey?: { source: "config" | "env"; envVar?: string };
  usage?: { summary?: string; plan?: string; accountEmail?: string };
};

export type AccountRow = {
  profileId: string;
  /** Null when the core gave no readable name: the row then leads with `kind`. */
  name: string | null;
  kind: "OAuth" | "API key" | "Ứng dụng trên máy";
  health: { tone: "ok" | "warn" | "error" | "muted"; label: string };
  primary: boolean;
  canLogout: boolean;
};
export type ProviderCard = {
  provider: string;
  label: string;
  status: AuthProvider["status"];
  headline: { tone: "ok" | "warn" | "error" | "muted"; label: string };
  accounts: AccountRow[];
  usage: string | null;
  /** Reordering only means something once a provider has two or more accounts. */
  canReorder: boolean;
  modelCount: number;
};

const PROVIDER_TONE: Record<string, { tone: ProviderCard["headline"]["tone"]; label: string }> = {
  ok: { tone: "ok", label: "Đang dùng được" },
  static: { tone: "ok", label: "Đang dùng được bằng API key" },
  expiring: { tone: "warn", label: "Sắp hết hạn, nên đăng nhập lại" },
  expired: { tone: "error", label: "Đã hết hạn, cần đăng nhập lại" },
  missing: { tone: "muted", label: "Chưa kết nối" }
};
const PROFILE_TONE: Record<string, { tone: AccountRow["health"]["tone"]; label: string }> = {
  ok: { tone: "ok", label: "Tốt" },
  static: { tone: "ok", label: "Đang dùng" },
  expiring: { tone: "warn", label: "Sắp hết hạn" },
  expired: { tone: "error", label: "Hết hạn" },
  missing: { tone: "muted", label: "Chưa dùng được" }
};
const KIND: Record<AuthProfile["type"], AccountRow["kind"]> = {
  oauth: "OAuth",
  token: "Ứng dụng trên máy",
  api_key: "API key"
};

/**
 * `openai:setup-3c9947ca-…` reads as noise, and so does falling back to the
 * provider name: three OAuth logins under one provider then all read "openai"
 * and the rows are indistinguishable. Return null instead and let the row lead
 * with what it actually knows — OAuth or a key.
 */
export function accountName(profileId: string): string | null {
  const tail = profileId.includes(":") ? profileId.slice(profileId.indexOf(":") + 1) : profileId;
  if (!tail || /^setup-[0-9a-f-]{8,}$/i.test(tail) || /^[0-9a-f-]{16,}$/i.test(tail)) return null;
  return tail;
}

/**
 * Stored order first, then whatever the core still reports. An account named in
 * the order but no longer present simply drops out, so a stale order can never
 * hide a working account.
 */
export function orderProfiles(profiles: AuthProfile[], order: string[] | undefined): AuthProfile[] {
  if (!order?.length) return [...profiles];
  const byId = new Map(profiles.map(profile => [profile.profileId, profile]));
  const ordered = order.map(id => byId.get(id)).filter((profile): profile is AuthProfile => Boolean(profile));
  const seen = new Set(ordered.map(profile => profile.profileId));
  return [...ordered, ...profiles.filter(profile => !seen.has(profile.profileId))];
}

export function providerCards(providers: AuthProvider[], options: {
  order?: Record<string, string[]>;
  modelCounts?: Record<string, number>;
} = {}): ProviderCard[] {
  // `models.authStatus` only knows providers that stored a credential. A provider
  // reached through an app already signed in on the machine — Claude via the
  // Claude Code CLI, for one — has models and no profile, and used to be invisible
  // here. Fold those in so the page shows everything the core can actually run.
  const named = new Set(providers.map(entry => entry.provider));
  const modelOnly: AuthProvider[] = Object.keys(options.modelCounts ?? {})
    .filter(provider => !named.has(provider) && (options.modelCounts?.[provider] ?? 0) > 0)
    .map(provider => ({ provider, status: "static", profiles: [] } as AuthProvider));
  return [...providers, ...modelOnly]
    .map(entry => {
      const label = entry.displayName?.trim() || providerLabel(entry.provider);
      const ordered = orderProfiles(entry.profiles ?? [], options.order?.[entry.provider]);
      const headline = PROVIDER_TONE[entry.status] ?? { tone: "muted" as const, label: entry.status };
      const expiry = entry.expiry?.label;
      const usage = [entry.usage?.plan, entry.usage?.summary].filter(Boolean).join(" · ") || null;
      return {
        provider: entry.provider,
        label,
        status: entry.status,
        headline: { tone: headline.tone, label: expiry ? `${headline.label} · còn ${expiry}` : headline.label },
        accounts: ordered.map((profile, index) => {
          const health = PROFILE_TONE[profile.status] ?? { tone: "muted" as const, label: profile.status };
          return {
            profileId: profile.profileId,
            name: accountName(profile.profileId),
            kind: KIND[profile.type] ?? "Đăng nhập tài khoản",
            health: { tone: health.tone, label: profile.expiry?.label ? `${health.label} · còn ${profile.expiry.label}` : health.label },
            primary: index === 0,
            canLogout: profile.logoutSupported === true
          };
        }),
        usage,
        canReorder: ordered.length > 1,
        modelCount: options.modelCounts?.[entry.provider] ?? 0
      };
    })
    .sort((a, b) => compareProviders(a.provider, b.provider));
}

/** Move one account up or down; returns null when the move changes nothing. */
export function reorder(profileIds: string[], profileId: string, direction: -1 | 1): string[] | null {
  const from = profileIds.indexOf(profileId), to = from + direction;
  if (from < 0 || to < 0 || to >= profileIds.length) return null;
  const next = [...profileIds];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
