export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-8">
        {/* Logo - 200% size */}
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
          <img src="/logo/logo-128.png" alt="Logo" className="h-32 w-32" />
        </div>

        {/* Spinning Indicator */}
        <div className="relative">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
