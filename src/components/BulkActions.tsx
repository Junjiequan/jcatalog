import { Fragment, useState, type ReactElement } from "react";
import { useNavigate } from "react-router";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem, MenuLabel, MenuSep } from "@/components/ui/Overlay";
import { GENERAL_ACTIONS, actionsFor, partFor, type BulkAction } from "@/features/datasets/bulkActions";
import { KIND_LABEL, byKind, selectionList, useSelection, type SelItem, type SelKind } from "@/store/selection";

// The one place bulk actions are built. Anything that holds some items (the selection bar, the selection sheet, a table, a row) uses these.

// How an action runs: on the part of the items it belongs to, never on the rest
export function useBulkRunner(afterRun?: () => void) {
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (a: BulkAction, part: SelItem[] = partFor(a, selectionList(useSelection.getState().items))) => {
    setBusy(a.id);
    try {
      await a.run(part, { nav });
      afterRun?.();
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

// the menu entries one kind (or one item) offers
export function ActionItems({ kind, part, runner }: { kind: SelKind; part: SelItem[]; runner: ReturnType<typeof useBulkRunner> }) {
  return <>{actionsFor(kind, part).map((a) => <MenuItem key={a.id} icon={a.icon} disabled={runner.busy === a.id} onSelect={() => runner.run(a, part)}>{a.label}</MenuItem>)}</>;
}

// The actions for any set of items, behind one button. A mixed set is grouped by kind.
export function BulkActionsMenu({ items, afterRun, trigger }: { items: SelItem[]; afterRun?: () => void; trigger?: ReactElement }) {
  const runner = useBulkRunner(afterRun);
  const kinds = byKind(items);
  const mixed = kinds.length > 1;
  return (
    <Menu trigger={trigger ?? <Button size="sm" variant="primary" aria-label="Actions">Actions<ChevronDown className="h-4 w-4" /></Button>}>
      {kinds.map(([k, l]) => (
        <Fragment key={k}>
          {mixed && <MenuLabel>{KIND_LABEL[k][1]} · {l.length}</MenuLabel>}
          <ActionItems kind={k} part={l} runner={runner} />
        </Fragment>
      ))}
      <MenuSep />
      {mixed && <MenuLabel>Everything · {items.length}</MenuLabel>}
      {GENERAL_ACTIONS().map((a) => <MenuItem key={a.id} icon={a.icon} disabled={runner.busy === a.id} onSelect={() => runner.run(a, items)}>{a.label}</MenuItem>)}
    </Menu>
  );
}
