export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        {/* Animated Logo */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping opacity-20">
            <img src="/logo/logo-64.png" alt="Logo" className="h-16 w-16" />
          </div>
          <div className="relative">
            <img src="/logo/logo-64.png" alt="Logo" className="h-16 w-16" />
          </div>
        </div>

        {/* Loading Text */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">个人财务管理</h1>
        </div>

        {/* Progress Bar */}
        <div className="w-64 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary animate-[loading_1.5s_ease-in-out_infinite] rounded-full" />
        </div>
      </div>
    </div>
  );
}
