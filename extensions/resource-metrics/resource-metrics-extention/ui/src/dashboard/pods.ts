// Pods of the selected resource, taken from the Argo CD resource tree.

export interface TreeNode {
  kind: string;
  name: string;
  namespace?: string;
  uid?: string;
  parentRefs?: { uid?: string; kind?: string; name?: string }[];
  health?: { status?: string; message?: string };
  info?: { name: string; value: string }[];
  createdAt?: string;
}

export interface PodInfo {
  name: string;
  status: string;
  health: string;
  restarts: number | null;
  node: string;
  createdAt?: string;
}

const info = (n: TreeNode, key: string) => (n.info || []).find((i) => i.name === key)?.value;

export function podsOf(resource: any, tree: any): PodInfo[] {
  const nodes: TreeNode[] = tree?.nodes || [];
  if (!resource) return [];
  const uid = resource?.metadata?.uid;
  const byUid = new Map<string, TreeNode>();
  nodes.forEach((n) => n.uid && byUid.set(n.uid, n));

  const belongs = (n: TreeNode): boolean => {
    if (resource.kind === "Pod") return n.uid === uid || n.name === resource?.metadata?.name;
    const seen = new Set<string>();
    let frontier = n.parentRefs || [];
    while (frontier.length) {
      const next: TreeNode["parentRefs"] = [];
      for (const ref of frontier) {
        if (!ref.uid || seen.has(ref.uid)) continue;
        if (ref.uid === uid) return true;
        seen.add(ref.uid);
        const parent = byUid.get(ref.uid);
        if (parent?.parentRefs) next.push(...parent.parentRefs);
      }
      frontier = next;
    }
    return false;
  };

  return nodes
    .filter((n) => n.kind === "Pod" && belongs(n))
    .map((n) => {
      const restarts = info(n, "Restart Count");
      return {
        name: n.name,
        status: info(n, "Status Reason") || n.health?.status || "Unknown",
        health: n.health?.status || "Unknown",
        restarts: restarts !== undefined && isFinite(parseInt(restarts, 10)) ? parseInt(restarts, 10) : null,
        node: info(n, "Node") || "—",
        createdAt: n.createdAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
