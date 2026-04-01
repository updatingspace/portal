/**
 * Hook for managing homepage modals in admin panel
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  fetchModals,
  fetchModal,
  createModal,
  updateModal,
  deleteModal,
  restoreModal,
  bulkActionModals,
} from '../api/contentApi';
import type {
  HomePageModal,
  HomePageModalInput,
  ModalListFilters,
  BulkAction,
} from '../types';

const MODALS_QUERY_KEY = 'admin-modals';

/**
 * Hook for fetching and managing homepage modals
 */
export function useModals(initialFilters?: ModalListFilters) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ModalListFilters>(initialFilters || {});

  // Fetch modals with filters
  const {
    data: modals = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [MODALS_QUERY_KEY, filters],
    queryFn: () => fetchModals(filters),
  });

  // Create modal mutation
  const createMutation = useMutation({
    mutationFn: createModal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODALS_QUERY_KEY] });
    },
  });

  // Update modal mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: HomePageModalInput }) =>
      updateModal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODALS_QUERY_KEY] });
    },
  });

  // Delete modal mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id, hard = false }: { id: number; hard?: boolean }) =>
      deleteModal(id, hard),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODALS_QUERY_KEY] });
    },
  });

  // Restore modal mutation
  const restoreMutation = useMutation({
    mutationFn: restoreModal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODALS_QUERY_KEY] });
    },
  });

  // Bulk action mutation
  const bulkMutation = useMutation({
    mutationFn: bulkActionModals,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MODALS_QUERY_KEY] });
    },
  });

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<ModalListFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Bulk action helper
  const performBulkAction = useCallback(
    async (modalIds: number[], action: BulkAction) => {
      return bulkMutation.mutateAsync({ modalIds, action });
    },
    [bulkMutation]
  );

  return {
    // Data
    modals,
    filters,
    
    // Loading states
    isLoading,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isBulkActioning: bulkMutation.isPending,
    
    // Errors
    error,
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
    
    // Actions
    refetch,
    updateFilters,
    clearFilters,
    create: createMutation.mutateAsync,
    update: (id: number, data: HomePageModalInput) =>
      updateMutation.mutateAsync({ id, data }),
    remove: (id: number, hard?: boolean) =>
      deleteMutation.mutateAsync({ id, hard }),
    restore: restoreMutation.mutateAsync,
    bulkAction: performBulkAction,
  };
}

/**
 * Hook for fetching a single modal
 */
export function useModal(modalId: number | null) {
  const {
    data: modal,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [MODALS_QUERY_KEY, 'single', modalId],
    queryFn: () => (modalId ? fetchModal(modalId) : null),
    enabled: modalId !== null,
  });

  return {
    modal,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for modal selection (multi-select for bulk actions)
 */
export function useModalSelection(modals: HomePageModal[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(modals.map((m) => m.id)));
  }, [modals]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: number) => selectedIds.has(id),
    [selectedIds]
  );

  const isAllSelected =
    modals.length > 0 && selectedIds.size === modals.length;

  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleSelection,
    selectAll,
    clearSelection,
  };
}
