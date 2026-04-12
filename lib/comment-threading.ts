export type FlatComment = {
  id: string;
  parent_comment_id: string | null;
  body: string;
  author_id: string | null;
  created_at: string;
};

export type CommentTreeNode = FlatComment & { children: CommentTreeNode[] };

export function buildCommentTree(rows: FlatComment[]): CommentTreeNode[] {
  const byId = new Map<string, CommentTreeNode>();
  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }
  const roots: CommentTreeNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const pid = row.parent_comment_id;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
