export default function LoadingDealDetail() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <div className="skeleton h-6 w-24 rounded-full" />
          <div className="skeleton h-5 w-28 rounded-full" />
        </div>
      </nav>

      <main className="mx-auto max-w-[760px] px-5 py-10">
        <div className="skeleton mb-6 h-[320px] rounded-[24px]" />

        <div className="mb-6 space-y-2">
          <div className="skeleton h-4 w-40 rounded-full" />
          <div className="skeleton h-8 w-3/4 rounded-[8px]" />
          <div className="skeleton h-4 w-48 rounded-full" />
        </div>

        <div className="mb-6 rounded-[16px] bg-[color:var(--surface)] p-6">
          <div className="skeleton h-11 w-36 rounded-[8px]" />
          <div className="skeleton mt-2 h-4 w-52 rounded-full" />
        </div>

        <div className="mb-8">
          <div className="skeleton mb-2 h-3 w-32 rounded-full" />
          <div className="grid grid-cols-4 gap-[6px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-[8px]" />
            ))}
          </div>
        </div>

        <div className="mb-8 rounded-[16px] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <div className="skeleton mb-4 h-6 w-40 rounded-[8px]" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-3 w-16 rounded-full" />
                <div className="skeleton h-7 w-20 rounded-[8px]" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[16px] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <div className="skeleton mb-4 h-6 w-44 rounded-[8px]" />
          <div className="skeleton h-[80px] w-full rounded-[8px]" />
          <div className="skeleton mt-3 h-3 w-64 rounded-full" />
        </div>
      </main>
    </div>
  )
}
