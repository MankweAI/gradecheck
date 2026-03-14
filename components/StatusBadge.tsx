import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: "Active" | "Suspended" | "Expired";
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const className =
    status === "Active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Suspended"
        ? "bg-amber-100 text-amber-900"
        : "bg-rose-100 text-rose-800";

  return <Badge className={className}>{status}</Badge>;
}
