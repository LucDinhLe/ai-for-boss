import type { NativeCatalogue } from './workbench-api';

export type CapabilityEntry = { id: string; label: string; description?: string; brandId?: string; bundled?: boolean; installed?: boolean; enabled?: boolean; state?: string; category?: string; transport?: string };
export type CapabilityKind = 'providers' | 'plugins' | 'mcp';
export type LiveCapabilityCatalogue = { entries: CapabilityEntry[]; mutationAllowed?: boolean };

/** Renderer-lifetime display snapshots only. Every live read and every mutation revalidates with the host. */
export function createCapabilityCatalogReader(source: {
  catalogue(): Promise<NativeCatalogue>;
  live(kind: CapabilityKind): Promise<LiveCapabilityCatalogue>;
}) {
  let catalogue: NativeCatalogue | null = null, pendingCatalogue: Promise<NativeCatalogue> | null = null;
  const snapshots = new Map<CapabilityKind, CapabilityEntry[]>(), revisions = new Map<CapabilityKind, number>();
  function readCatalogue() {
    if (catalogue) return Promise.resolve(catalogue);
    if (!pendingCatalogue) pendingCatalogue = source.catalogue().then(value => { catalogue = value; return value; })
      .finally(() => { pendingCatalogue = null; });
    return pendingCatalogue;
  }
  async function readLive(kind: CapabilityKind) {
    const revision = (revisions.get(kind) ?? 0) + 1;
    revisions.set(kind, revision);
    const result = await source.live(kind);
    if (revisions.get(kind) === revision) snapshots.set(kind, result.entries);
    return result;
  }
  return {
    snapshot: (kind: CapabilityKind) => ({ catalogue, entries: snapshots.get(kind) ?? null }),
    read: (kind: CapabilityKind, ready: boolean) => ({ catalogue: readCatalogue(), live: ready ? readLive(kind) : Promise.resolve(null) }),
    updatePlugin: (plugin: CapabilityEntry) => {
      revisions.set('plugins', (revisions.get('plugins') ?? 0) + 1);
      const entries = snapshots.get('plugins');
      if (entries) snapshots.set('plugins', entries.map(item => item.id === plugin.id ? plugin : item));
    }
  };
}
