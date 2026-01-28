export const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-zinc-950">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-6"></div>
      <p className="text-white text-xl font-medium mb-2">Chargement de l'application...</p>
      <p className="text-zinc-400 text-sm">Cela peut prendre quelques secondes</p>
    </div>
  </div>
);

export const SkeletonLoader = () => (
  <div className="animate-pulse space-y-4 p-6 bg-zinc-950">
    <div className="h-8 bg-zinc-800 rounded w-3/4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-zinc-800 rounded"></div>
      <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
    </div>
    <div className="grid grid-cols-3 gap-4 mt-6">
      <div className="h-32 bg-zinc-800 rounded"></div>
      <div className="h-32 bg-zinc-800 rounded"></div>
      <div className="h-32 bg-zinc-800 rounded"></div>
    </div>
  </div>
);
