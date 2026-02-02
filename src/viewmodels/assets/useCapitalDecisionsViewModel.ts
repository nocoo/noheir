import { useMemo, useState } from 'react';
import { useUnitsDisplay, useProducts, useUpdateUnit, useDeployUnit, useRecallUnit } from '@/hooks/useAssets';
import type { DeployUnitInput, UpdateCapitalUnitInput, UnitDisplayInfo } from '@/types/assets';
import { buildFilterCounts, classifyDecisions, sortDecisions, SortColumn, SortDirection } from '@/domain/assets/capitalDecisions';

export function useCapitalDecisionsViewModel() {
  const { data: units, isLoading } = useUnitsDisplay();
  const { data: products } = useProducts();
  const updateMutation = useUpdateUnit();
  const deployMutation = useDeployUnit();
  const recallMutation = useRecallUnit();

  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const [editDeployDialog, setEditDeployDialog] = useState<{ open: boolean; unit?: UnitDisplayInfo }>({ open: false });

  const decisions = useMemo(() => {
    if (!units) return [];
    return classifyDecisions(units as UnitDisplayInfo[]);
  }, [units]);

  const filteredDecisions = useMemo(() => {
    const base = activeFilter === 'all' ? decisions : decisions.filter(d => d.urgency === activeFilter);
    return sortDecisions(base, sortColumn, sortDirection);
  }, [decisions, activeFilter, sortColumn, sortDirection]);

  const counts = useMemo(() => buildFilterCounts(decisions), [decisions]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleEditDeploy = (unitData: UpdateCapitalUnitInput, deployData?: DeployUnitInput) => {
    if (!editDeployDialog.unit) return;

    if (deployData && deployData.product_id) {
      const deployInput = {
        ...deployData,
        strategy: unitData.strategy,
        tactics: unitData.tactics,
      } as unknown as DeployUnitInput;

      deployMutation.mutate(
        { unitId: editDeployDialog.unit.id, input: deployInput },
        { onSuccess: () => setEditDeployDialog({ open: false }) }
      );
      return;
    }

    updateMutation.mutate(
      { id: editDeployDialog.unit.id, input: unitData },
      { onSuccess: () => setEditDeployDialog({ open: false }) }
    );
  };

  const handleRecallFromDialog = () => {
    if (!editDeployDialog.unit) return;
    recallMutation.mutate(editDeployDialog.unit.id, {
      onSuccess: () => setEditDeployDialog({ open: false }),
    });
  };

  return {
    units,
    products,
    isLoading,
    decisions,
    filteredDecisions,
    counts,
    activeFilter,
    setActiveFilter,
    sortColumn,
    sortDirection,
    handleSort,
    editDeployDialog,
    setEditDeployDialog,
    handleEditDeploy,
    handleRecallFromDialog,
    updateMutation,
    deployMutation,
  };
}
