export const LoadingFallback = () => (
  <div className="min-h-screen bg-zinc-950 p-6 md:p-10">
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 skel-breath">
        <div className="w-12 h-12 bg-zinc-800 rounded-2xl" />
        <div>
          <div className="h-7 w-56 bg-zinc-800 rounded-xl mb-2" />
          <div className="h-3.5 w-36 bg-zinc-800/60 rounded-md" />
        </div>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className={`rounded-2xl p-5 border border-zinc-800 bg-zinc-900/50 skel-breath skel-d${(i%4)+1}`}>
            <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
            <div className="h-7 w-28 bg-zinc-800 rounded-lg" />
          </div>
        ))}
      </div>
      {/* Content area */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 skel-breath skel-d2">
        <div className="h-[300px] bg-zinc-800/30 rounded-xl" />
      </div>
      {/* Table area */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden skel-breath skel-d3">
        <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
          <div className="h-5 w-32 bg-zinc-700 rounded-lg" />
        </div>
        <div className="p-6 space-y-3">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="h-10 bg-zinc-800/40 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const SkeletonLoader = () => (
  <div className="space-y-4 p-6 bg-zinc-950">
    <div className="h-8 bg-zinc-800 rounded w-3/4 skel-breath"></div>
    <div className="space-y-3 skel-breath skel-d1">
      <div className="h-4 bg-zinc-800 rounded"></div>
      <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
    </div>
    <div className="grid grid-cols-3 gap-4 mt-6 skel-breath skel-d2">
      <div className="h-32 bg-zinc-800 rounded"></div>
      <div className="h-32 bg-zinc-800 rounded"></div>
      <div className="h-32 bg-zinc-800 rounded"></div>
    </div>
  </div>
);
