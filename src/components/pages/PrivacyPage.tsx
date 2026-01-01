import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Eye, Database, Trash2 } from 'lucide-react';

export function PrivacyPage() {
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
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-6 w-6" />
                隐私政策
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              最后更新日期：2026年1月1日
            </p>
          </CardHeader>

          <CardContent className="space-y-6 text-sm">
            {/* Introduction */}
            <section>
              <p className="text-muted-foreground leading-relaxed">
                在 noheir，我们非常重视您的隐私。noheir 是一个开源项目，源代码托管在{' '}
                <a href="https://github.com/nocoo/noheir" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  GitHub
                </a>
                。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。
              </p>
            </section>

            {/* 1. Information We Collect */}
            <section>
              <h3 className="font-semibold mb-3 text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                1. 我们收集的信息
              </h3>
              <div className="space-y-3 text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground mb-1">1.1 账户信息</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Google 账户基本信息（姓名、邮箱地址）</li>
                    <li>登录时间和设备信息</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">1.2 财务数据</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>收支记录</li>
                    <li>资产配置信息</li>
                    <li>财务目标和设定</li>
                    <li>产品与投资信息</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">1.3 使用数据</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>功能使用情况</li>
                    <li>性能和错误日志</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 2. How We Use Your Information */}
            <section>
              <h3 className="font-semibold mb-3 text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                2. 我们如何使用您的信息
              </h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
                <li><span className="font-medium text-foreground">提供服务：</span>存储和管理您的财务数据</li>
                <li><span className="font-medium text-foreground">数据分析：</span>生成财务洞察和建议</li>
                <li><span className="font-medium text-foreground">身份验证：</span>验证您的身份以保护账户安全</li>
                <li><span className="font-medium text-foreground">服务改进：</span>优化功能和用户体验</li>
                <li><span className="font-medium text-foreground">技术支持：</span>解决您遇到的问题</li>
              </ul>
            </section>

            {/* 3. Data Storage and Security */}
            <section>
              <h3 className="font-semibold mb-3 text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                3. 数据存储与安全
              </h3>
              <div className="space-y-2 text-muted-foreground">
                <p><span className="font-medium text-foreground">存储位置：</span>您的数据存储在 Supabase 云数据库中，位于安全的托管环境。</p>
                <p><span className="font-medium text-foreground">数据隔离：</span>所有用户数据通过行级安全策略（RLS）严格隔离，您只能访问自己的数据。</p>
                <p><span className="font-medium text-foreground">加密保护：</span>数据传输采用 HTTPS 加密，数据库连接使用加密通道。</p>
                <p><span className="font-medium text-foreground">访问控制：</span>仅经过授权的人员才能访问系统，且仅限于必要的技术支持。</p>
                <p><span className="font-medium text-foreground">身份验证：</span>使用 Google OAuth 进行安全登录，支持双因素认证。</p>
              </div>
            </section>

            {/* 4. Data Sharing */}
            <section>
              <h3 className="font-semibold mb-3 text-base">4. 信息共享</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                我们<strong className="text-foreground">不会出售</strong>您的个人信息。我们仅在以下情况下共享您的信息：
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li><span className="font-medium text-foreground">服务提供商：</span>Supabase（数据存储服务）</li>
                <li><span className="font-medium text-foreground">法律要求：</span>响应法律程序或政府要求</li>
                <li><span className="font-medium text-foreground">保护权利：</span>保护我们的权利、财产或安全</li>
              </ul>
            </section>

            {/* 5. Your Rights */}
            <section>
              <h3 className="font-semibold mb-3 text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-primary" />
                5. 您的权利
              </h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
                <li><span className="font-medium text-foreground">访问权：</span>随时查看您的所有数据</li>
                <li><span className="font-medium text-foreground">更正权：</span>更新或修改不准确的信息</li>
                <li><span className="font-medium text-foreground">删除权：</span>请求删除您的账户和所有相关数据</li>
                <li><span className="font-medium text-foreground">导出权：</span>导出您的数据以供备份</li>
                <li><span className="font-medium text-foreground">反对权：</span>反对特定的数据处理活动</li>
              </ul>
              <p className="text-muted-foreground mt-2 text-xs">
                如需行使上述权利，请通过{' '}
                <a href="https://github.com/nocoo/noheir/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  GitHub Issues
                </a>
                {' '}联系我们。
              </p>
            </section>

            {/* 6. Data Retention */}
            <section>
              <h3 className="font-semibold mb-2 text-base">6. 数据保留</h3>
              <p className="text-muted-foreground leading-relaxed">
                我们会在您使用服务的期间保留您的数据。当您删除账户时，您的所有个人数据将被永久删除，除非法律要求我们必须保留某些记录。
              </p>
            </section>

            {/* 7. Third-Party Services */}
            <section>
              <h3 className="font-semibold mb-2 text-base">7. 第三方服务</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                我们使用以下第三方服务：
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li><span className="font-medium text-foreground">Google OAuth：</span>用于用户身份验证</li>
                <li><span className="font-medium text-foreground">Supabase：</span>用于数据存储和托管</li>
              </ul>
              <p className="text-muted-foreground text-xs mt-2">
                这些服务提供商有自己的隐私政策，我们建议您仔细阅读。
              </p>
            </section>

            {/* 8. Children's Privacy */}
            <section>
              <h3 className="font-semibold mb-2 text-base">8. 儿童隐私</h3>
              <p className="text-muted-foreground leading-relaxed">
                本服务不面向 13 岁以下儿童。我们不会故意收集儿童的个人信息。如果您发现我们无意中收集了儿童的信息，请立即联系我们，我们将及时删除。
              </p>
            </section>

            {/* 9. Changes to This Policy */}
            <section>
              <h3 className="font-semibold mb-2 text-base">9. 政策变更</h3>
              <p className="text-muted-foreground leading-relaxed">
                我们可能会不时更新本隐私政策。重大变更时，我们会通过应用内通知或邮件告知您。继续使用服务即表示您接受修订后的政策。
              </p>
            </section>

            {/* 10. Contact Information */}
            <section>
              <h3 className="font-semibold mb-2 text-base">10. 联系我们</h3>
              <p className="text-muted-foreground leading-relaxed">
                本项目为开源项目，如对本隐私政策有任何疑问或建议，请通过{' '}
                <a href="https://github.com/nocoo/noheir/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  GitHub Issues
                </a>
                {' '}提交反馈。
              </p>
            </section>

            {/* Commitment Statement */}
            <div className="pt-4 border-t">
              <p className="text-muted-foreground text-xs">
                我们承诺保护您的隐私并安全地处理您的数据。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
