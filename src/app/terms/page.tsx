import { AppShell } from "@/components/layout";
import { FileText } from "lucide-react";

export default async function TermsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="text-primary size-6" />
            服务条款
          </h1>
          <p className="text-muted-foreground text-sm">使用本应用即表示您同意以下条款</p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <section>
            <h2 className="text-lg font-semibold">1. 服务说明</h2>
            <p className="text-muted-foreground">
              本应用为个人财务管理工具，提供交易记录、资产分析、数据导入导出等功能。
              所有数据存储在用户自己的数据库中，我们不会访问、收集或分享您的财务数据。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. 数据所有权</h2>
            <p className="text-muted-foreground">
              用户对其所有财务数据拥有完全所有权。用户可以随时导出或删除其数据。
              我们不会在未经用户授权的情况下访问或处理用户数据。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. 免责声明</h2>
            <p className="text-muted-foreground">
              本应用提供的分析结果、AI 洞察等内容仅供参考，不构成任何投资建议。
              用户应自行判断并承担因使用本应用而产生的任何风险。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. 服务变更</h2>
            <p className="text-muted-foreground">
              我们保留随时修改或中断服务的权利。重大变更将提前通知用户。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. 联系方式</h2>
            <p className="text-muted-foreground">
              如有任何疑问，请通过项目 GitHub 仓库提交 Issue。
            </p>
          </section>
        </div>

        <p className="text-muted-foreground text-xs">最后更新：2026年1月</p>
      </div>
    </AppShell>
  );
}
