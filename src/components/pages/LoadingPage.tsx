export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300" style={{ backgroundColor: '#38548c' }}>
      <div className="flex flex-col items-center gap-8">
        {/* High-resolution logo - 256x256 display */}
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-center">
            <img src="/logo-loading.png" alt="Logo" className="h-64 w-64" style={{ width: '256px', height: '256px' }} />
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
