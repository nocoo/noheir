export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-center">
            <img
              src="/logo-loading.png"
              alt="Logo"
              className="h-64 w-64"
              style={{ width: '256px', height: '256px' }}
            />
          </div>
        </div>

        {/* Spinner */}
        <div className="relative">
          <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
