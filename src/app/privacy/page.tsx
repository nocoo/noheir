import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout";

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="text-primary size-6" />
            隐私政策
          </h1>
          <p className="text-muted-foreground text-sm">我们重视并保护您的隐私</p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <section>
            <h2 className="text-lg font-semibold">1. 数据收集</h2>
            <p className="text-muted-foreground">
              本应用不收集任何用户数据。所有财务数据直接存储在用户自己的 Cloudflare D1
              数据库中，通过加密通道传输，我们不持有任何中间数据。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. 数据存储</h2>
            <p className="text-muted-foreground">
              用户数据存储在 Cloudflare D1 数据库中，数据位于用户选择的区域。
              数据库访问仅通过经过身份验证的 Worker API，由 Cloudflare Access 进行统一保护。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. 外部访问与报告</h2>
            <p className="text-muted-foreground">
              外部工具只能通过用户授予范围且未过期的 API
              密钥访问财务数据。报告内容由用户或外部工具提交，
              本应用不调用模型服务。密钥可随时撤销。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Cookie 与追踪</h2>
            <p className="text-muted-foreground">
              本应用不使用 Cookie 进行用户追踪，不使用第三方分析服务，不嵌入任何
              追踪像素或社交媒体插件。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. 数据删除</h2>
            <p className="text-muted-foreground">
              用户可以随时通过数据管理功能导出或删除所有数据。删除账户将永久清除
              所有相关数据，此操作不可撤销。
            </p>
          </section>
        </div>

        <p className="text-muted-foreground text-xs">最后更新：2026年1月</p>
      </div>
    </AppShell>
  );
}
