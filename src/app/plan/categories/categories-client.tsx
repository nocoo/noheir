"use client";

// CategoriesClient — owns the categories CRUD UI behind /plan/categories.
//
// Architecture:
// - Pure Client Component. Imports CategoryForm (P3-C3), Server Actions
//   for delete (P2-C7), and the project's shadcn Dialog + AlertDialog
//   primitives. Never touches Worker client / DB / api-helpers.
// - Parent page (server component) hydrates this with `categories` and
//   `usage` — the per-category rule count is computed server-side so the
//   delete-confirm dialog can warn that N rules will lose their color.

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CategoryForm } from "@/components/plan/category-form";
import { deleteExpenseCategory } from "@/app/actions/expense-category-actions";
import { CHART_TOKENS } from "@/lib/palette";

export interface CategoryRow {
  id: string;
  name: string;
  colorToken: string;
  sortOrder: number;
}

export interface CategoriesClientProps {
  categories: CategoryRow[];
  /** ruleCount keyed by categoryId. Used for the delete warning copy. */
  usage: Record<string, number>;
}

function colorCss(token: string): string {
  return CHART_TOKENS.includes(token)
    ? `hsl(var(--${token}))`
    : "hsl(var(--muted-foreground))";
}

export function CategoriesClient({
  categories,
  usage,
}: CategoriesClientProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = React.useState<CategoryRow | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const result = await deleteExpenseCategory(deleting.id);
      if (result.success) {
        toast.success("分类已删除");
        setDeleting(null);
        // revalidatePath() in the action only marks the cache stale;
        // mounted Client Components need router.refresh() to pull fresh
        // server-rendered props so the row disappears immediately.
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">分类</h1>
          <p className="text-sm text-muted-foreground">
            管理周期支出的分类与颜色标记
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="open-create">
          <Plus className="size-4" />
          新建分类
        </Button>
      </div>

      {categories.length === 0 ? (
        <div
          data-testid="categories-empty"
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-12 text-sm text-muted-foreground"
        >
          <p>还没有任何分类</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            创建第一个分类
          </Button>
        </div>
      ) : (
        <ul
          role="list"
          aria-label="分类列表"
          className="divide-y divide-border rounded-md border border-border"
        >
          {categories.map((cat) => {
            const count = usage[cat.id] ?? 0;
            return (
              <li
                key={cat.id}
                data-category-id={cat.id}
                className="flex items-center gap-3 p-4"
              >
                <span
                  aria-hidden="true"
                  data-testid={`cat-color-${cat.id}`}
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: colorCss(cat.colorToken) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {count > 0 ? `${count} 条规则使用` : "未被规则使用"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑 ${cat.name}`}
                  onClick={() => setEditing(cat)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`删除 ${cat.name}`}
                  onClick={() => setDeleting(cat)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
            <DialogDescription>
              选择一个名称和颜色标记。颜色用于日历和列表的可视化。
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
            onSuccess={() => {
              setCreateOpen(false);
              router.refresh();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
            <DialogDescription>修改名称、颜色或排序。</DialogDescription>
          </DialogHeader>
          {editing ? (
            <CategoryForm
              initial={editing}
              onSuccess={() => {
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deletePending) setDeleting(null);
        }}
        title={deleting ? `删除分类「${deleting.name}」？` : "删除分类？"}
        description={
          deleting && (usage[deleting.id] ?? 0) > 0
            ? `${usage[deleting.id]} 条规则正在使用这个分类。删除后这些规则将变成「未分类」，规则本身不会被删除。`
            : "确认删除？此操作不可撤销。"
        }
        loading={deletePending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
