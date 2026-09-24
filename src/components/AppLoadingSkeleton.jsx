import { Skeleton } from "@/components/ui/skeleton.jsx";

// Shown while AuthProvider's initial /me/ check (and any silent token
// refresh it triggers) is in flight — mirrors ProtectedLayout's own shell
// shape so it doesn't jump when the real sidebar/header swap in.
export default function AppLoadingSkeleton() {
  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <div className="hidden w-64 shrink-0 flex-col gap-2 border-r border-border p-3 md:flex">
        <Skeleton className="mb-3 h-8 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
