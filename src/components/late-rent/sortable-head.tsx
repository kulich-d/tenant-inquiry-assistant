import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TableHead } from "@/components/ui/table";
import type { SortDirection } from "@/domain/sort";

type Props = {
  direction: SortDirection;
  onToggle: () => void;
  children: ReactNode;
};

export function SortableHead({ direction, onToggle, children }: Props) {
  const Icon = direction === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <TableHead aria-sort={direction === "asc" ? "ascending" : "descending"}>
      <button
        type="button"
        onClick={onToggle}
        className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"
      >
        {children}
        <Icon aria-hidden="true" className="size-3.5" />
      </button>
    </TableHead>
  );
}
