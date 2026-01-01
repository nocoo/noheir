import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-primary py-8 px-4">
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader className="space-y-4">
            {/* Logo */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary overflow-hidden">
              <img src="/logo/logo-64.png" alt="Logo" className="h-14 w-14" />
            </div>

            <div className="flex items-center gap-2">
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <CardTitle className="text-2xl">服务条款</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              最后更新日期：2026年1月1日
            </p>
          </CardHeader>

          <CardContent className="space-y-6 text-sm">
            {/* 1. Acceptance of Terms */}
            <section>
              <h3 className="font-semibold mb-2 text-base">1. 接受条款</h3>
              <p className="text-muted-foreground leading-relaxed">
                欢迎使用 noheir 个人财务管理服务。noheir 是一个开源项目，源代码托管在{' '}
                <a href="https://github.com/nocoo/noheir" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  GitHub
                </a>
                。通过访问或使用本服务，您确认您已阅读、理解并同意受这些服务条款约束。如果您不同意这些条款，请不要使用本服务。
              </p>
            </section>

            {/* 2. Service Description */}
            <section>
              <h3 className="font-semibold mb-2 text-base">2. 服务描述</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                noheir 是一款个人财务管理工具，提供以下功能：
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>收支记录与分析</li>
                <li>财务健康评估</li>
                <li>资产管理与跟踪</li>
                <li>财务数据可视化</li>
                <li>数据导入导出功能</li>
              </ul>
            </section>

            {/* 3. User Responsibilities */}
            <section>
              <h3 className="font-semibold mb-2 text-base">3. 用户责任</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                使用本服务时，您同意：
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>提供准确、真实的注册信息</li>
                <li>妥善保管您的账户凭据</li>
                <li>对您账户下的所有活动负责</li>
                <li>不得将服务用于任何非法目的</li>
                <li>不得尝试未经授权访问他人数据</li>
              </ul>
            </section>

            {/* 4. Data and Privacy */}
            <section>
              <h3 className="font-semibold mb-2 text-base">4. 数据与隐私</h3>
              <p className="text-muted-foreground leading-relaxed">
                您的数据存储在您的私有账户中，我们采用行业标准的安全措施保护您的信息。详细的隐私政策请参阅{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  隐私政策
                </Link>
                。
              </p>
            </section>

            {/* 5. Intellectual Property */}
            <section>
              <h3 className="font-semibold mb-2 text-base">5. 知识产权</h3>
              <p className="text-muted-foreground leading-relaxed">
                本服务的所有内容、功能和特性，包括但不限于文本、图形、标识、图像和软件，均归 noheir 或其许可方所有，受版权法和其他知识产权法保护。
              </p>
            </section>

            {/* 6. Limitation of Liability */}
            <section>
              <h3 className="font-semibold mb-2 text-base">6. 责任限制</h3>
              <p className="text-muted-foreground leading-relaxed">
                在法律允许的最大范围内，noheir 不对因使用或无法使用本服务而导致的任何直接、间接、附带、特殊或后果性损害承担责任。
              </p>
            </section>

            {/* 7. Service Modifications */}
            <section>
              <h3 className="font-semibold mb-2 text-base">7. 服务修改</h3>
              <p className="text-muted-foreground leading-relaxed">
                我们保留随时修改或终止服务的权利，恕不另行通知。我们不对本服务的任何用户或第三方承担修改或暂停服务的责任。
              </p>
            </section>

            {/* 8. Termination */}
            <section>
              <h3 className="font-semibold mb-2 text-base">8. 服务终止</h3>
              <p className="text-muted-foreground leading-relaxed">
                我们可能因任何原因（包括但不限于违反这些条款）立即终止或暂停您的账户和服务访问权限。
              </p>
            </section>

            {/* 9. Governing Law */}
            <section>
              <h3 className="font-semibold mb-2 text-base">9. 适用法律</h3>
              <p className="text-muted-foreground leading-relaxed">
                这些条款受您所在司法管辖区的法律管辖并依其解释。
              </p>
            </section>

            {/* 10. Contact Information */}
            <section>
              <h3 className="font-semibold mb-2 text-base">10. 联系我们</h3>
              <p className="text-muted-foreground leading-relaxed">
                本项目为开源项目，如有任何问题或建议，请通过{' '}
                <a href="https://github.com/nocoo/noheir/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  GitHub Issues
                </a>
                {' '}提交反馈。
              </p>
            </section>

            {/* Agreement Statement */}
            <div className="pt-4 border-t">
              <p className="text-muted-foreground text-xs">
                通过使用 noheir 服务，您确认您已阅读、理解并同意遵守这些服务条款。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
