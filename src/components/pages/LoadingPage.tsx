export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300" style={{ backgroundColor: '#3b5792' }}>
      <div className="flex flex-col items-center gap-8">
        {/* Logo - 2x larger, no rounded corners */}
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden">
            <img src="/logo/logo-64.png" alt="Logo" className="h-28 w-28" />
          </div>
        </div>

        {/* Spinning Indicator - white */}
        <div className="relative">
          <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
