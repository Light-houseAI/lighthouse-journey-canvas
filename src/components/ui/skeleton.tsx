import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md bg-gradient-to-r from-gray-200/50 via-gray-300/70 to-gray-200/50 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]", className)}
      {...props}
    />
  )
}

export { Skeleton }
