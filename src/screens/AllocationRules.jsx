import { useEffect, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { GripVertical } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent } from "@/components/ui/card.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { ScopeBanner } from "@/components/ScopeBanner.jsx";
import { cn } from "@/lib/utils.js";
import { useGetAllocationRulesQuery, useSaveAllocationRulesMutation } from "../api/services/allocation.js";
import { useToast } from "../hooks/useToast.js";

function SortableRuleCard({ rule, index, onToggle }) {
  const { ref, handleRef, isDragging } = useSortable({ id: rule.id, index });

  return (
    <div ref={ref} className={cn("touch-none", isDragging && "opacity-50")}>
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <button
            ref={handleRef}
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label={`Reorder ${rule.label}`}
          >
            <GripVertical className="size-4" />
          </button>
          <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
          <Checkbox checked={rule.enabled} onCheckedChange={() => onToggle(rule.id)} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{rule.label}</p>
            <p className="text-xs text-muted-foreground">{rule.detail}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AllocationRules() {
  const { showToast } = useToast();
  const { data, isFetching } = useGetAllocationRulesQuery();
  const [saveRules, { isLoading: isSaving }] = useSaveAllocationRulesMutation();
  const [rules, setRules] = useState([]);

  useEffect(() => {
    if (data?.rules) setRules(data.rules);
  }, [data]);

  const toggle = (id) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleSave = async () => {
    await saveRules(rules).unwrap();
    showToast("Allocation rules saved.");
  };

  return (
    <div>
      <ScopeBanner>
        Serial-level allocation — recommending which exact unit POS 2.0 should reserve when an item
        code has multiple units — is not in the current OMS proposal. This builder previews the
        priority cascade Rishab Jain outlined over WhatsApp.
      </ScopeBanner>

      <p className="mb-4 text-sm text-muted-foreground">
        Order matters: the first enabled rule that tells two units apart wins. Drag a rule by its
        handle to reorder, or turn one off to skip it entirely.
      </p>

      {isFetching && rules.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <DragDropProvider onDragEnd={(event) => setRules((prev) => move(prev, event))}>
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <SortableRuleCard key={rule.id} rule={rule} index={i} onToggle={toggle} />
            ))}
          </div>
        </DragDropProvider>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving || rules.length === 0}>
          {isSaving ? "Saving…" : "Save rule order"}
        </Button>
        <Link to="/allocation/preview" className="text-sm text-primary hover:underline">
          Preview a recommendation →
        </Link>
      </div>
    </div>
  );
}
