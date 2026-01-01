export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-8">
        {/* Logo - exactly same as login page */}
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary overflow-hidden">
            <img src="/logo/logo-64.png" alt="Logo" className="h-14 w-14" />
          </div>
        </div>

        {/* Spinning Indicator */}
        <div className="relative">
          <div className="w-6 h-6 border-4 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
