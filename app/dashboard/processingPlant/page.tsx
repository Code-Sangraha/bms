"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Beaker, ArrowRightLeft, Plus, X, ChevronRight } from "lucide-react";
import Pagination from "@/app/components/Pagination/Pagination";
import { useI18n } from "@/app/providers/I18nProvider";
import { paginate, usePagination } from "@/app/hooks/usePagination";
import {
  completeLivestockProcessing,
  editSendLivestockToProcessing,
  getCompletedLivestockProcessing,
  getPendingLivestockProcessing,
  getLivestockItemsByProduct,
  getProducts,
  getWasteProducts,
  transferProcessedStock,
  WASTE_PRODUCTS_QUERY_KEY,
  type CompletedLivestockProcessingItem,
  type PendingLivestockProcessingItem,
  sendLivestockToProcessing,
  type LivestockItem,
} from "@/handlers/product";
import {
  filterProcessedNonWasteProducts,
  getProcessedTypeIds,
  getWasteTypeIds,
} from "@/app/dashboard/product/lib/productTypeFilters";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { getUsers } from "@/handlers/user";
import {
  createProcessingPlant,
  getProcessingPlants,
  type ProcessingPlant,
} from "@/handlers/processingPlant";
import { useToast } from "@/app/providers/ToastProvider";
import { usePermissions } from "@/app/providers/AuthProvider";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import "./processingPlant.scss";

const PROCESSING_PLANTS_QUERY_KEY = ["processingPlants"];
const USERS_QUERY_KEY = ["users"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const PRODUCTS_QUERY_KEY = ["products"];
const OUTLETS_QUERY_KEY = ["outlets"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];
const PENDING_PROCESSING_QUERY_KEY = ["pendingLivestockProcessing"];
const COMPLETED_PROCESSING_QUERY_KEY = ["completedLivestockProcessing"];
const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];
const SEND_HISTORY_STORAGE_KEY = "processingPlantSendHistory";
const COMPLETE_PROCESSING_WEIGHT_TOLERANCE = 0.0001;

type CompleteOutputLineDraft = {
  id: string;
  outletId: string;
  productId: string;
  weight: string;
};

function newCompleteOutputLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `col-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createEmptyCompleteOutputLine(): CompleteOutputLineDraft {
  return { id: newCompleteOutputLineId(), outletId: "", productId: "", weight: "" };
}

type ProcessingSendHistoryItem = {
  id: string;
  batchId?: string;
  plantId: string;
  plantName: string;
  livestockItemId: string;
  livestockItemLabel: string;
  quantity: number;
  weight?: number;
  createdAt: string;
};

function resolveLivestockItemId(item: LivestockItem): string | null {
  const withUnderscore = item as unknown as { _id?: unknown };
  const withLivestockItemId = item as unknown as { livestockItemId?: unknown };
  const fromId = typeof item.id === "string" ? item.id : null;
  const fromUnderscore = typeof withUnderscore._id === "string" ? withUnderscore._id : null;
  const fromLivestockItemId =
    typeof withLivestockItemId.livestockItemId === "string" ? withLivestockItemId.livestockItemId : null;
  return fromId ?? fromUnderscore ?? fromLivestockItemId ?? null;
}

/** Head count / units from API `quantity` only — never body weight (kg). */
function resolveLivestockHeadCount(item: LivestockItem): number | null {
  if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
    return item.quantity;
  }
  return null;
}

export default function ProcessingPlantPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { capabilities, roleName } = usePermissions();
  const canTransferProcessedStock = roleName === "Admin" || roleName === "Manager";
  const { showToast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalStep, setCreateModalStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState(true);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [selectedLivestockItemId, setSelectedLivestockItemId] = useState("");
  const [sendQuantity, setSendQuantity] = useState("");
  const [sendWeight, setSendWeight] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [completeWasteWeight, setCompleteWasteWeight] = useState("");
  const [completeWasteProductId, setCompleteWasteProductId] = useState("");
  const [completeOutputLines, setCompleteOutputLines] = useState<CompleteOutputLineDraft[]>(() => [
    createEmptyCompleteOutputLine(),
  ]);
  const [transferSourceOutletId, setTransferSourceOutletId] = useState("");
  const [transferDestinationOutletId, setTransferDestinationOutletId] = useState("");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferWeight, setTransferWeight] = useState("");
  const [editingPendingBatch, setEditingPendingBatch] =
    useState<PendingLivestockProcessingItem | null>(null);
  const [editPendingQuantity, setEditPendingQuantity] = useState("");
  const [editPendingWeight, setEditPendingWeight] = useState("");
  const [sendHistory, setSendHistory] = useState<ProcessingSendHistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEND_HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProcessingSendHistoryItem[];
      if (Array.isArray(parsed)) setSendHistory(parsed);
    } catch {
      // ignore malformed local history
    }
  }, []);

  const {
    data: processingPlants = [],
    isLoading,
    isError,
    error: errorDetail,
  } = useQuery({
    queryKey: PROCESSING_PLANTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProcessingPlants();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const result = await getUsers();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: productTypes = [] } = useQuery({
    queryKey: PRODUCT_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const liveTypeIds = useMemo(() => {
    const ids = new Set<string>();
    productTypes.forEach((pt) => {
      if (LIVE_PRODUCT_TYPE_NAMES.includes(pt.name.toLowerCase())) ids.add(pt.id);
    });
    return ids;
  }, [productTypes]);

  const liveStockProducts = useMemo(
    () =>
      products.filter((p) => {
        const productTypeName =
          typeof p.productType === "object" && typeof p.productType?.name === "string"
            ? p.productType.name.toLowerCase()
            : "";
        return liveTypeIds.has(p.productTypeId) || LIVE_PRODUCT_TYPE_NAMES.includes(productTypeName);
      }),
    [products, liveTypeIds]
  );

  const processedTypeIds = useMemo(() => getProcessedTypeIds(productTypes), [productTypes]);
  const wasteTypeIds = useMemo(() => getWasteTypeIds(productTypes), [productTypes]);

  const processedProducts = useMemo(
    () => filterProcessedNonWasteProducts(products, processedTypeIds, wasteTypeIds),
    [products, processedTypeIds, wasteTypeIds]
  );

  const { data: wasteProducts = [] } = useQuery({
    queryKey: WASTE_PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getWasteProducts();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const liveStockProductIds = useMemo(
    () => liveStockProducts.map((product) => product.id).sort(),
    [liveStockProducts]
  );

  const { data: livestockItems = [] } = useQuery({
    queryKey: [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
    enabled: liveStockProductIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        liveStockProductIds.map((productId) => getLivestockItemsByProduct(productId))
      );
      const merged: LivestockItem[] = [];
      for (const result of results) {
        if (!result.ok) {
          if (result.status === 401) navigate("/login");
          throw new Error(result.error);
        }
        merged.push(...result.data);
      }
      const seen = new Set<string>();
      return merged.filter((item) => {
        const id = resolveLivestockItemId(item) ?? `${item.productId}-${item.itemId}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    },
  });

  const { data: pendingProcessing = [] } = useQuery({
    queryKey: PENDING_PROCESSING_QUERY_KEY,
    queryFn: async () => {
      const result = await getPendingLivestockProcessing();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: completedProcessing = [],
    isLoading: isCompletedProcessingLoading,
    isError: isCompletedProcessingError,
  } = useQuery<CompletedLivestockProcessingItem[]>({
    queryKey: COMPLETED_PROCESSING_QUERY_KEY,
    queryFn: async () => {
      const result = await getCompletedLivestockProcessing();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(processingPlants.length, { defaultPageSize: 10 });

  const paginatedProcessingPlants = useMemo(
    () => paginate(processingPlants, startIndex, endIndex),
    [processingPlants, startIndex, endIndex]
  );

  const sourceProcessedProducts = useMemo(
    () =>
      processedProducts.filter(
        (product) =>
          product.outletId === transferSourceOutletId &&
          (typeof product.weight === "number" ? product.weight : product.quantity) > 0
      ),
    [processedProducts, transferSourceOutletId]
  );

  const destinationProcessedProducts = useMemo(
    () => processedProducts.filter((product) => product.outletId === transferDestinationOutletId),
    [processedProducts, transferDestinationOutletId]
  );

  const selectedTransferProduct = useMemo(
    () => sourceProcessedProducts.find((product) => product.id === transferProductId) ?? null,
    [sourceProcessedProducts, transferProductId]
  );

  const selectedTransferProductWeight =
    selectedTransferProduct && typeof selectedTransferProduct.weight === "number"
      ? selectedTransferProduct.weight
      : selectedTransferProduct?.quantity ?? null;

  const processedProductsForOutlet = useCallback(
    (outletId: string) =>
      outletId ? processedProducts.filter((product) => product.outletId === outletId) : [],
    [processedProducts]
  );

  const selectedPendingBatch = useMemo(
    () => pendingProcessing.find((entry) => entry.batchId === selectedBatchId) ?? null,
    [pendingProcessing, selectedBatchId]
  );

  const selectedPendingBatchWeight = useMemo(() => {
    if (!selectedPendingBatch) return null;
    if (typeof selectedPendingBatch.weight === "number" && Number.isFinite(selectedPendingBatch.weight)) {
      return selectedPendingBatch.weight;
    }
    if (
      typeof selectedPendingBatch.sentWeight === "number" &&
      Number.isFinite(selectedPendingBatch.sentWeight)
    ) {
      return selectedPendingBatch.sentWeight;
    }
    const historyMatch = selectedPendingBatch.batchId
      ? sendHistory.find((entry) => entry.batchId === selectedPendingBatch.batchId)
      : null;
    return typeof historyMatch?.weight === "number" && Number.isFinite(historyMatch.weight)
      ? historyMatch.weight
      : null;
  }, [selectedPendingBatch, sendHistory]);

  const completeWeightValidationMessage = useMemo(() => {
    if (!selectedBatchId || selectedPendingBatchWeight == null) return "";
    const waste = Number(completeWasteWeight);
    if (!Number.isFinite(waste) || waste < 0) return "";

    let outputTotal = 0;
    let hasValidLine = false;
    for (const line of completeOutputLines) {
      const touched =
        Boolean(line.outletId) || Boolean(line.productId) || line.weight.trim() !== "";
      if (!touched) continue;
      const weight = Number(line.weight);
      if (!line.outletId || !line.productId || !Number.isFinite(weight) || weight < 0) {
        return "";
      }
      outputTotal += weight;
      hasValidLine = true;
    }
    if (!hasValidLine) return "";

    const total = waste + outputTotal;
    return Math.abs(total - selectedPendingBatchWeight) <= COMPLETE_PROCESSING_WEIGHT_TOLERANCE
      ? ""
      : t("Waste weight + output weight must equal the selected batch weight.");
  }, [
    selectedBatchId,
    selectedPendingBatchWeight,
    completeWasteWeight,
    completeOutputLines,
    t,
  ]);

  const completeFormCanSubmit = useMemo(() => {
    if (!selectedBatchId || !capabilities.canCompleteProcessing) return false;
    if (!completeWasteProductId.trim()) return false;
    const waste = Number(completeWasteWeight);
    if (!Number.isFinite(waste) || waste < 0) return false;
    let hasValidLine = false;
    for (const line of completeOutputLines) {
      const touched =
        Boolean(line.outletId) || Boolean(line.productId) || line.weight.trim() !== "";
      if (!touched) continue;
      const w = Number(line.weight);
      if (!line.outletId || !line.productId || !Number.isFinite(w) || w < 0) return false;
      hasValidLine = true;
    }
    return hasValidLine && !completeWeightValidationMessage;
  }, [
    selectedBatchId,
    capabilities.canCompleteProcessing,
    completeWasteWeight,
    completeWasteProductId,
    completeOutputLines,
    completeWeightValidationMessage,
  ]);

  const selectedLivestockItem = useMemo(
    () =>
      livestockItems.find(
        (item) => resolveLivestockItemId(item) === selectedLivestockItemId
      ) ?? null,
    [livestockItems, selectedLivestockItemId]
  );

  const createMutation = useMutation({
    mutationFn: createProcessingPlant,
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        showToast(result.error ?? t("Failed to create processing plant"));
        return;
      }
      setName("");
      setUserId("");
      setContact("");
      setStatus(true);
      setIsCreateModalOpen(false);
      setCreateModalStep(1);
      queryClient.invalidateQueries({ queryKey: PROCESSING_PLANTS_QUERY_KEY });
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."));
    },
  });

  const handleCreate = () => {
    const trimmedName = name.trim();
    const trimmedContact = contact.trim();
    if (!trimmedName) {
      showToast(t("Processing plant name is required."));
      return;
    }
    if (!trimmedContact) {
      showToast(t("Contact is required."));
      return;
    }
    if (!userId) {
      showToast(t("Please select user."));
      return;
    }

    createMutation.mutate({
      name: trimmedName,
      userId,
      contact: trimmedContact,
      status,
    });
  };

  const sendToProcessingMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(sendQuantity);
      const weight = Number(sendWeight);
      if (!selectedPlantId) {
        return { ok: false as const, error: t("Please select processing plant.") };
      }
      if (!selectedLivestockItemId) {
        return { ok: false as const, error: t("Please select livestock item.") };
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false as const, error: t("Quantity must be greater than 0.") };
      }
      if (!Number.isFinite(weight) || weight <= 0) {
        return { ok: false as const, error: t("Weight must be greater than 0.") };
      }

      const currentItem = selectedLivestockItem;
      if (!currentItem) {
        return { ok: false as const, error: t("Selected livestock item not found.") };
      }
      const availableHeads = resolveLivestockHeadCount(currentItem);
      if (
        availableHeads !== null &&
        availableHeads >= 0 &&
        qty > availableHeads
      ) {
        return {
          ok: false as const,
          error: t("Insufficient livestock quantity for selected item."),
        };
      }

      return sendLivestockToProcessing({
        livestockItemId: selectedLivestockItemId,
        plantId: selectedPlantId,
        quantity: qty,
        weight,
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        showToast(result.error ?? t("Failed to send livestock to processing plant."));
        return;
      }
      const selectedPlant = processingPlants.find((plant) => plant.id === selectedPlantId);
      const selectedItem = livestockItems.find(
        (item) => resolveLivestockItemId(item) === selectedLivestockItemId
      );
      const resultData = "data" in result ? result.data : undefined;
      const batchId =
        (resultData && typeof resultData === "object" && typeof resultData.batchId === "string" && resultData.batchId) ||
        (resultData && typeof resultData === "object" && typeof resultData.id === "string" && resultData.id) ||
        undefined;
      const newHistory: ProcessingSendHistoryItem = {
        id: `${Date.now()}-${selectedLivestockItemId}`,
        batchId,
        plantId: selectedPlantId,
        plantName: selectedPlant?.name ?? selectedPlantId,
        livestockItemId: selectedLivestockItemId,
        livestockItemLabel: selectedItem
          ? `${selectedItem.itemId} - ${selectedItem.name}`
          : selectedLivestockItemId,
        quantity: Number(sendQuantity),
        weight: Number(sendWeight),
        createdAt: new Date().toISOString(),
      };
      setSendHistory((prev) => {
        const next = [newHistory, ...prev].slice(0, 100);
        localStorage.setItem(SEND_HISTORY_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setSelectedLivestockItemId("");
      setSelectedPlantId("");
      setSendQuantity("");
      setSendWeight("");
      if (batchId) setSelectedBatchId(batchId);
      queryClient.invalidateQueries({ queryKey: LIVESTOCK_ITEMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PENDING_PROCESSING_QUERY_KEY });
      showToast(t("Livestock sent to processing plant successfully."), "success");
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."));
    },
  });

  useEffect(() => {
    if (!selectedLivestockItem) return;
    const heads = resolveLivestockHeadCount(selectedLivestockItem);
    setSendQuantity(heads !== null && heads > 0 ? String(heads) : "");
  }, [selectedLivestockItem]);

  const pendingBatches = useMemo(
    () =>
      pendingProcessing.map((entry: PendingLivestockProcessingItem) => {
        const labelParts = [
          typeof entry.itemId === "string" ? entry.itemId : "",
          typeof entry.livestockItemName === "string" ? entry.livestockItemName : "",
          typeof entry.plantName === "string" ? entry.plantName : "",
        ].filter(Boolean);
        return {
          id: entry.batchId,
          label: labelParts.length > 0 ? labelParts.join(" - ") : entry.batchId,
        };
      }),
    [pendingProcessing]
  );

  const openEditPendingBatchModal = useCallback((entry: PendingLivestockProcessingItem) => {
    setEditingPendingBatch(entry);
    setEditPendingQuantity(typeof entry.quantity === "number" ? String(entry.quantity) : "");
    setEditPendingWeight(typeof entry.weight === "number" ? String(entry.weight) : "");
  }, []);

  const closeEditPendingBatchModal = useCallback(() => {
    setEditingPendingBatch(null);
    setEditPendingQuantity("");
    setEditPendingWeight("");
  }, []);

  const editPendingProcessingMutation = useMutation({
    mutationFn: async () => {
      if (!editingPendingBatch?.batchId) {
        return { ok: false as const, error: t("Batch is required."), status: 400 };
      }
      const livestockItemId = editingPendingBatch.livestockItemId;
      if (!livestockItemId) {
        return { ok: false as const, error: t("Livestock item is required."), status: 400 };
      }
      const quantity = Number(editPendingQuantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false as const, error: t("Quantity must be greater than 0."), status: 400 };
      }
      const weight = Number(editPendingWeight);
      if (!Number.isFinite(weight) || weight <= 0) {
        return { ok: false as const, error: t("Weight must be greater than 0."), status: 400 };
      }

      return editSendLivestockToProcessing({
        batchId: editingPendingBatch.batchId,
        livestockItemId,
        quantity,
        weight,
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        showToast(result.error ?? t("Failed to edit pending batch."));
        return;
      }
      closeEditPendingBatchModal();
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIVESTOCK_ITEMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PENDING_PROCESSING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["livestockInventoryHistory"] });
      showToast(t("Pending batch updated successfully."), "success");
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."));
    },
  });

  const completeProcessingMutation = useMutation({
    mutationFn: async () => {
      const wasteWeight = Number(completeWasteWeight);
      if (!selectedBatchId) {
        return { ok: false as const, error: t("Please select batch.") };
      }
      if (!Number.isFinite(wasteWeight) || wasteWeight < 0) {
        return { ok: false as const, error: t("Waste weight must be 0 or greater.") };
      }
      if (!completeWasteProductId.trim()) {
        return {
          ok: false as const,
          error: t("Waste product is required."),
        };
      }

      const outputs: { productId: string; weight: number; outletId: string }[] = [];
      for (const line of completeOutputLines) {
        const touched =
          Boolean(line.outletId) || Boolean(line.productId) || line.weight.trim() !== "";
        if (!touched) continue;
        const w = Number(line.weight);
        if (!line.outletId || !line.productId) {
          return {
            ok: false as const,
            error: t("Each output line needs outlet and product, or remove empty rows."),
          };
        }
        if (!Number.isFinite(w) || w < 0) {
          return { ok: false as const, error: t("Output weight must be 0 or greater.") };
        }
        outputs.push({
          outletId: line.outletId,
          productId: line.productId,
          weight: w,
        });
      }
      if (outputs.length === 0) {
        return { ok: false as const, error: t("Add at least one valid output line.") };
      }
      if (selectedPendingBatchWeight == null) {
        return { ok: false as const, error: t("Selected batch weight is unavailable.") };
      }
      const totalCompletedWeight =
        wasteWeight + outputs.reduce((sum, output) => sum + output.weight, 0);
      if (
        Math.abs(totalCompletedWeight - selectedPendingBatchWeight) >
        COMPLETE_PROCESSING_WEIGHT_TOLERANCE
      ) {
        return {
          ok: false as const,
          error: t("Waste weight + output weight must equal the selected batch weight."),
        };
      }

      return completeLivestockProcessing({
        batchId: selectedBatchId,
        wasteWeight,
        wasteProductId: completeWasteProductId.trim(),
        outputs,
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        showToast(result.error ?? t("Failed to complete processing."));
        return;
      }
      showToast(t("Processing completed successfully."), "success");
      setSelectedBatchId("");
      setCompleteWasteWeight("");
      setCompleteWasteProductId("");
      setCompleteOutputLines([createEmptyCompleteOutputLine()]);
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: WASTE_PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIVESTOCK_ITEMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PENDING_PROCESSING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: COMPLETED_PROCESSING_QUERY_KEY });
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."));
    },
  });

  const transferProcessedMutation = useMutation({
    mutationFn: async () => {
      if (!canTransferProcessedStock) {
        return {
          ok: false as const,
          error: t("Only authorized users can transfer processed stock between outlets."),
        };
      }
      const parsedWeight = Number(transferWeight);
      if (!transferSourceOutletId) {
        return { ok: false as const, error: t("Please select source outlet.") };
      }
      if (!transferDestinationOutletId) {
        return { ok: false as const, error: t("Please select destination outlet.") };
      }
      if (transferSourceOutletId === transferDestinationOutletId) {
        return { ok: false as const, error: t("Source and destination outlet cannot be same.") };
      }
      if (!transferProductId) {
        return { ok: false as const, error: t("Please select processed product.") };
      }
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        return { ok: false as const, error: t("Transfer weight must be greater than 0.") };
      }

      const sourceProduct = sourceProcessedProducts.find((product) => product.id === transferProductId);
      if (!sourceProduct) {
        return { ok: false as const, error: t("Selected source product was not found.") };
      }
      const destinationProduct = destinationProcessedProducts.find(
        (product) => product.name.trim().toLowerCase() === sourceProduct.name.trim().toLowerCase()
      );
      if (!destinationProduct) {
        return {
          ok: false as const,
          error: t("Destination outlet does not have this processed product. Create it first."),
        };
      }
      const sourceWeight =
        typeof sourceProduct.weight === "number" ? sourceProduct.weight : sourceProduct.quantity;
      if (sourceWeight < parsedWeight) {
        return { ok: false as const, error: t("Insufficient stock in source outlet.") };
      }

      return transferProcessedStock({
        productId: sourceProduct.id,
        fromOutletId: transferSourceOutletId,
        toOutletId: transferDestinationOutletId,
        weight: parsedWeight,
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        showToast(result.error ?? t("Failed to transfer processed stock."));
        return;
      }
      setTransferSourceOutletId("");
      setTransferDestinationOutletId("");
      setTransferProductId("");
      setTransferWeight("");
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["processedInventoryHistory"] });
      showToast(t("Processed stock transferred successfully."), "success");
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."));
    },
  });

  return (
    <section className="processingPlantPage">
      <div className="ppBreadcrumb">
        <span className="ppBreadcrumbMuted">{t("Dashboard")}</span>
        <span className="ppBreadcrumbSep" aria-hidden>
          {" / "}
        </span>
        <span className="ppBreadcrumbCurrent">{t("Processing Plant")}</span>
      </div>

      <header className="ppHeader">
        <div className="ppHeaderText">
          <h1 className="pageTitle">{t("Processing Plant")}</h1>
          <p className="pageSubtitle">{t("Create and manage processing plants")}</p>
        </div>
        {capabilities.canCreateProcessingPlants && (
        <Button
          type="button"
          variant="default"
          size="lg"
          className="ppHeaderAction"
          onClick={() => {
            setIsCreateModalOpen(true);
            setCreateModalStep(1);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("Add Processing Plant")}
        </Button>
        )}
      </header>

      <Dialog
        open={isCreateModalOpen && capabilities.canCreateProcessingPlants}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setCreateModalStep(1);
            setName("");
            setUserId("");
            setContact("");
            setStatus(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("Add Processing Plant")}</DialogTitle>
            <DialogDescription>
              {createModalStep === 1
                ? t("Enter the plant details and contact information.")
                : t("Assign a responsible user and set the plant status.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={
                  createModalStep === 1
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }
              >
                1. {t("Details")}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={
                  createModalStep === 2
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }
              >
                2. {t("Assignment")}
              </span>
            </div>

            {createModalStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pp-modal-plant-name">{t("Plant Name")}</Label>
                  <Input
                    id="pp-modal-plant-name"
                    autoComplete="organization"
                    placeholder={t("Enter processing plant name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-modal-plant-contact">{t("Contact")}</Label>
                  <Input
                    id="pp-modal-plant-contact"
                    autoComplete="tel"
                    placeholder={t("Enter contact number")}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </div>
              </div>
            )}

            {createModalStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pp-modal-plant-user">{t("Responsible User")}</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger id="pp-modal-plant-user">
                      <SelectValue placeholder={t("Select user")} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-modal-plant-status">{t("Status")}</Label>
                  <Select
                    value={status ? "active" : "inactive"}
                    onValueChange={(v) => setStatus(v === "active")}
                  >
                    <SelectTrigger id="pp-modal-plant-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t("Active")}</SelectItem>
                      <SelectItem value="inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {createModalStep === 1 ? (
              <Button
                onClick={() => setCreateModalStep(2)}
                disabled={!name.trim() || !contact.trim()}
              >
                {t("Next")}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateModalStep(1)}>
                  {t("Back")}
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending || !userId}>
                  {createMutation.isPending ? t("Saving...") : t("Create")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingPendingBatch !== null} onOpenChange={(open) => !open && closeEditPendingBatchModal()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("Edit Pending Batch")}</DialogTitle>
            <DialogDescription>
              {t("Update quantity and weight while the batch is still pending.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <span className="text-xs font-medium text-muted-foreground">{t("Batch ID")}</span>
                <p className="mt-1 font-mono text-sm">{editingPendingBatch?.batchId ?? "-"}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <span className="text-xs font-medium text-muted-foreground">{t("Livestock Item")}</span>
                <p className="mt-1 text-sm">
                  {editingPendingBatch?.livestockItemName ?? editingPendingBatch?.itemId ?? "-"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pending-quantity">{t("Quantity")}</Label>
              <Input
                id="edit-pending-quantity"
                type="number"
                min={1}
                step="any"
                value={editPendingQuantity}
                onChange={(e) => setEditPendingQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pending-weight">{t("Weight")}</Label>
              <Input
                id="edit-pending-weight"
                type="number"
                min={1}
                step="any"
                value={editPendingWeight}
                onChange={(e) => setEditPendingWeight(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditPendingBatchModal} disabled={editPendingProcessingMutation.isPending}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => editPendingProcessingMutation.mutate()}
              disabled={
                editPendingProcessingMutation.isPending ||
                !editingPendingBatch?.batchId ||
                !editingPendingBatch?.livestockItemId ||
                Number(editPendingQuantity) <= 0 ||
                Number(editPendingWeight) <= 0
              }
            >
              {editPendingProcessingMutation.isPending ? t("Saving...") : t("Save changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="ppSection" aria-labelledby="pp-section-operations-heading">
        <h2 id="pp-section-operations-heading" className="ppSectionTitle">
          {t("Operations workflow")}
        </h2>
        <p className="ppSectionLead">{t("Send, complete, and move stock through processing.")}</p>
        <div className="ppSectionGrid">
      {/* Send Card - Amber */}
      <Card className="ppCard ppCardWorkflow ppCardSend">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="ppCardIcon ppCardIcon--amber" aria-hidden>
              <Truck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle id="pp-card-send-title">{t("Send Livestock To Processing Plant")}</CardTitle>
              <CardDescription>{t("Queue livestock from inventory to a processing plant.")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!capabilities.canSendToProcessing && (
            <p className="ppNotice ppNotice--warning" role="status">
              {t("Only authorized users can send livestock to processing.")}
            </p>
          )}
          <div className="ppFormGrid" role="group" aria-labelledby="pp-card-send-title">
            <div className="ppField">
              <Label htmlFor="send-plant">{t("Processing Plant")}</Label>
              <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                <SelectTrigger id="send-plant">
                  <SelectValue placeholder={t("Select processing plant")} />
                </SelectTrigger>
                <SelectContent>
                  {processingPlants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ppField">
              <Label htmlFor="send-livestock">{t("Livestock Item")}</Label>
              <Select
                value={selectedLivestockItemId}
                onValueChange={setSelectedLivestockItemId}
              >
                <SelectTrigger id="send-livestock">
                  <SelectValue placeholder={t("Select livestock item")} />
                </SelectTrigger>
                <SelectContent>
                  {livestockItems.map((item) => {
                    const resolvedId = resolveLivestockItemId(item);
                    if (!resolvedId) return null;
                    const heads = resolveLivestockHeadCount(item);
                    const qtyLabel = heads !== null ? String(heads) : "\u2014";
                    return (
                      <SelectItem key={`${item.productId}-${resolvedId}`} value={resolvedId}>
                        {`${item.itemId} - ${item.name} (${qtyLabel})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="ppField ppFieldNarrow">
              <Label htmlFor="send-quantity">{t("Quantity")}</Label>
              <Input
                id="send-quantity"
                type="number"
                min={1}
                step="any"
                value={sendQuantity}
                onChange={(e) => setSendQuantity(e.target.value)}
              />
            </div>
            <div className="ppField ppFieldNarrow">
              <Label htmlFor="send-weight">{t("Weight")}</Label>
              <Input
                id="send-weight"
                type="number"
                min={1}
                step="any"
                value={sendWeight}
                onChange={(e) => setSendWeight(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => sendToProcessingMutation.mutate()}
              disabled={
                sendToProcessingMutation.isPending ||
                !capabilities.canSendToProcessing ||
                !selectedPlantId ||
                !selectedLivestockItemId ||
                Number(sendQuantity) <= 0 ||
                Number(sendWeight) <= 0
              }
            >
              {sendToProcessingMutation.isPending ? t("Sending...") : t("Send")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Complete Card - Green */}
      <Card className="ppCard ppCardWorkflow ppCardComplete">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="ppCardIcon ppCardIcon--green" aria-hidden>
              <Beaker className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle id="pp-card-complete-title">{t("Complete Processing")}</CardTitle>
              <CardDescription>
                {t("Record output, waste, and post stock to one or more outlets.")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!capabilities.canCompleteProcessing && (
            <p className="ppNotice ppNotice--warning" role="status">
              {t("Only authorized users can complete processing.")}
            </p>
          )}
          <div className="ppCompleteForm" role="group" aria-labelledby="pp-card-complete-title">
            <div className="ppCompleteFormTop">
              <div className="ppField">
                <Label htmlFor="complete-batch">{t("Batch")}</Label>
                <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                  <SelectTrigger id="complete-batch">
                    <SelectValue placeholder={t("Select batch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingBatches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ppField ppFieldNarrow">
                <Label htmlFor="complete-waste-weight">{t("Waste Weight")}</Label>
                <Input
                  id="complete-waste-weight"
                  type="number"
                  min={0}
                  step="any"
                  value={completeWasteWeight}
                  onChange={(e) => setCompleteWasteWeight(e.target.value)}
                />
              </div>
              <div className="ppField">
                <Label htmlFor="complete-waste-product">{t("Waste product")}</Label>
                <Select
                  value={completeWasteProductId}
                  onValueChange={setCompleteWasteProductId}
                >
                  <SelectTrigger id="complete-waste-product">
                    <SelectValue placeholder={t("Select waste product")} />
                  </SelectTrigger>
                  <SelectContent>
                    {wasteProducts.map((product) => {
                      const stock =
                        typeof product.weight === "number" && Number.isFinite(product.weight)
                          ? product.weight
                          : product.quantity;
                      const stockLabel =
                        typeof stock === "number" && Number.isFinite(stock) ? ` (${stock} kg)` : "";
                      return (
                        <SelectItem key={product.id} value={product.id}>
                          {`${product.name}${stockLabel}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="ppOutputLinesHeading">{t("Output lines")}</p>
            <div className="ppOutputLines">
              {completeOutputLines.map((line) => (
                <div key={line.id} className="ppOutputLineRow">
                  <div className="ppField">
                    <Label htmlFor={`outlet-${line.id}`}>{t("Outlet")}</Label>
                    <Select
                      value={line.outletId}
                      onValueChange={(nextOutlet) => {
                        setCompleteOutputLines((prev) =>
                          prev.map((row) =>
                            row.id === line.id
                              ? {
                                  ...row,
                                  outletId: nextOutlet,
                                  productId: processedProductsForOutlet(nextOutlet).some(
                                    (p) => p.id === row.productId
                                  )
                                    ? row.productId
                                    : "",
                                }
                              : row
                          )
                        );
                      }}
                    >
                      <SelectTrigger id={`outlet-${line.id}`}>
                        <SelectValue placeholder={t("Select outlet")} />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((outlet) => (
                          <SelectItem key={outlet.id} value={outlet.id}>
                            {outlet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="ppField">
                    <Label htmlFor={`product-${line.id}`}>{t("Output Product")}</Label>
                    <Select
                      value={line.productId}
                      onValueChange={(val) =>
                        setCompleteOutputLines((prev) =>
                          prev.map((row) =>
                            row.id === line.id ? { ...row, productId: val } : row
                          )
                        )
                      }
                      disabled={!line.outletId}
                    >
                      <SelectTrigger id={`product-${line.id}`}>
                        <SelectValue placeholder={t("Select processed product")} />
                      </SelectTrigger>
                      <SelectContent>
                        {processedProductsForOutlet(line.outletId).map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="ppField ppFieldNarrow">
                    <Label htmlFor={`weight-${line.id}`}>{t("Weight")}</Label>
                    <Input
                      id={`weight-${line.id}`}
                      type="number"
                      min={0}
                      step="any"
                      value={line.weight}
                      onChange={(e) =>
                        setCompleteOutputLines((prev) =>
                          prev.map((row) =>
                            row.id === line.id ? { ...row, weight: e.target.value } : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="ppOutputLineActions">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCompleteOutputLines((prev) => {
                          if (prev.length <= 1) {
                            return [createEmptyCompleteOutputLine()];
                          }
                          return prev.filter((row) => row.id !== line.id);
                        })
                      }
                      aria-label={t("Remove line")}
                      title={t("Remove line")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="ppCompleteFormFooter">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setCompleteOutputLines((prev) => [...prev, createEmptyCompleteOutputLine()])
                }
              >
                <Plus className="h-4 w-4" />
                {t("Add output line")}
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => completeProcessingMutation.mutate()}
                disabled={completeProcessingMutation.isPending || !completeFormCanSubmit}
              >
                {completeProcessingMutation.isPending ? t("Saving...") : t("Complete")}
              </Button>
              {completeWeightValidationMessage && (
                <p className="ppNotice ppCompleteFormError" role="alert">
                  {completeWeightValidationMessage}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Card - Sky */}
      {canTransferProcessedStock && (
        <Card className="ppCard ppCardWorkflow ppCardTransfer">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="ppCardIcon ppCardIcon--sky" aria-hidden>
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle id="pp-card-transfer-title">
                  {t("Transfer Processed Stock Between Outlets")}
                </CardTitle>
                <CardDescription>{t("Move processed inventory from one outlet to another.")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="ppFormGrid" role="group" aria-labelledby="pp-card-transfer-title">
              <div className="ppField">
                <Label htmlFor="transfer-from">{t("From Outlet")}</Label>
                <Select
                  value={transferSourceOutletId}
                  onValueChange={(val) => {
                    setTransferSourceOutletId(val);
                    setTransferProductId("");
                    setTransferWeight("");
                  }}
                >
                  <SelectTrigger id="transfer-from">
                    <SelectValue placeholder={t("Select source outlet")} />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ppField">
                <Label htmlFor="transfer-product">{t("Processed Product")}</Label>
                <Select value={transferProductId} onValueChange={setTransferProductId}>
                  <SelectTrigger id="transfer-product">
                    <SelectValue placeholder={t("Select processed product")} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceProcessedProducts.map((product) => {
                      const productWeight =
                        typeof product.weight === "number" ? product.weight : product.quantity;
                      return (
                        <SelectItem key={product.id} value={product.id}>
                          {`${product.name} (${productWeight} kg)`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="ppField">
                <Label htmlFor="transfer-to">{t("To Outlet")}</Label>
                <Select
                  value={transferDestinationOutletId}
                  onValueChange={setTransferDestinationOutletId}
                >
                  <SelectTrigger id="transfer-to">
                    <SelectValue placeholder={t("Select destination outlet")} />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ppField ppFieldNarrow">
                <Label htmlFor="transfer-weight">{t("Weight")}</Label>
                <Input
                  id="transfer-weight"
                  type="number"
                  min={1}
                  step="any"
                  value={transferWeight}
                  onChange={(e) => setTransferWeight(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="default"
                onClick={() => transferProcessedMutation.mutate()}
                disabled={
                  transferProcessedMutation.isPending ||
                  !canTransferProcessedStock ||
                  !transferSourceOutletId ||
                  !transferDestinationOutletId ||
                  !transferProductId ||
                  Number(transferWeight) <= 0 ||
                  (selectedTransferProductWeight !== null && selectedTransferProductWeight < Number(transferWeight))
                }
              >
                {transferProcessedMutation.isPending ? t("Transferring...") : t("Transfer")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
        </div>
      </section>

      {/* Data Tabs Section */}
      <section className="ppSection" aria-labelledby="pp-section-registers-heading">
        <h2 id="pp-section-registers-heading" className="ppSectionTitle">
          {t("Registers and activity")}
        </h2>
        <p className="ppSectionLead">{t("Monitor queues, plants, and recent sends.")}</p>
        <Tabs defaultValue="pending" className="ppTabs">
          <TabsList className="ppTabsList">
            <TabsTrigger value="pending">{t("Pending Batches")}</TabsTrigger>
            <TabsTrigger value="completed">{t("Completed")}</TabsTrigger>
            <TabsTrigger value="plants">{t("Registered Plants")}</TabsTrigger>
            <TabsTrigger value="history">{t("Send History")}</TabsTrigger>
          </TabsList>

          {/* Pending Batches Tab */}
          <TabsContent value="pending" className="ppTabContent">
            <Card>
              <CardHeader>
                <CardTitle>{t("Pending processing")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="ppTableWrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Batch ID")}</TableHead>
                        <TableHead>{t("Processing Plant")}</TableHead>
                        <TableHead>{t("Livestock Item")}</TableHead>
                        <TableHead>{t("Quantity")}</TableHead>
                        <TableHead>{t("Weight")}</TableHead>
                        {capabilities.canEditProcessingBatches && (
                          <TableHead>{t("Actions")}</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingProcessing.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={capabilities.canEditProcessingBatches ? 6 : 5}
                            className="ppTableEmpty"
                          >
                            {t("No pending processing batches.")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendingProcessing.map((entry) => {
                          const historyMatch = entry.batchId
                            ? sendHistory.find((historyItem) => historyItem.batchId === entry.batchId)
                            : undefined;
                          const quantityValue =
                            typeof entry.quantity === "number" ? entry.quantity : historyMatch?.quantity;
                          const weightValue =
                            typeof entry.weight === "number" ? entry.weight : historyMatch?.weight;

                          return (
                            <TableRow key={entry.batchId}>
                              <TableCell className="ppTableMono">{entry.batchId}</TableCell>
                              <TableCell>{entry.plantName ?? historyMatch?.plantName ?? "-"}</TableCell>
                              <TableCell>
                                {entry.livestockItemName ??
                                  entry.itemId ??
                                  historyMatch?.livestockItemLabel ??
                                  "-"}
                              </TableCell>
                              <TableCell>{typeof quantityValue === "number" ? quantityValue : "-"}</TableCell>
                              <TableCell>{typeof weightValue === "number" ? weightValue : "-"}</TableCell>
                              {capabilities.canEditProcessingBatches && (
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditPendingBatchModal(entry)}
                                    disabled={!entry.livestockItemId}
                                  >
                                    {t("Edit")}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Completed Processing Tab */}
          <TabsContent value="completed" className="ppTabContent">
            <Card>
              <CardHeader>
                <CardTitle>{t("Completed processing batches")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="ppTableWrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Batch ID")}</TableHead>
                        <TableHead>{t("Processing Plant")}</TableHead>
                        <TableHead>{t("Livestock Item")}</TableHead>
                        <TableHead>{t("Input quantity")}</TableHead>
                        <TableHead>{t("Input weight")}</TableHead>
                        <TableHead>{t("Waste weight")}</TableHead>
                        <TableHead>{t("Status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isCompletedProcessingLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="ppTableEmpty">
                            {t("Loading…")}
                          </TableCell>
                        </TableRow>
                      ) : isCompletedProcessingError ? (
                        <TableRow>
                          <TableCell colSpan={7} className="ppTableEmpty">
                            {t("Failed to load completed processing batches.")}
                          </TableCell>
                        </TableRow>
                      ) : completedProcessing.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="ppTableEmpty">
                            {t("No completed processing batches yet.")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        completedProcessing.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="ppTableMono">{entry.id}</TableCell>
                            <TableCell>{entry.plantName ?? "-"}</TableCell>
                            <TableCell>{entry.livestockItemName ?? "-"}</TableCell>
                            <TableCell>
                              {typeof entry.inputQuantity === "number" ? entry.inputQuantity : "-"}
                            </TableCell>
                            <TableCell>{typeof entry.inputWeight === "number" ? entry.inputWeight : "-"}</TableCell>
                            <TableCell>{typeof entry.wasteWeight === "number" ? entry.wasteWeight : "-"}</TableCell>
                            <TableCell>
                              <span className="ppCompletedBadge">
                                {t(entry.status ?? "COMPLETED")}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Registered Plants Tab */}
          <TabsContent value="plants" className="ppTabContent">
            <Card>
              <CardHeader>
                <CardTitle>{t("Registered plants")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="ppTableWrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Name")}</TableHead>
                        <TableHead>{t("User ID")}</TableHead>
                        <TableHead>{t("Contact")}</TableHead>
                        <TableHead>{t("Status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading && (
                        <TableRow>
                          <TableCell colSpan={4} className="ppTableEmpty">
                            {t("Loading...")}
                          </TableCell>
                        </TableRow>
                      )}
                      {isError && (
                        <TableRow>
                          <TableCell colSpan={4} className="ppTableEmpty">
                            {errorDetail instanceof Error
                              ? errorDetail.message
                              : t("Failed to load processing plants")}
                          </TableCell>
                        </TableRow>
                      )}
                      {!isLoading && !isError && processingPlants.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="ppTableEmpty">
                            {t("No processing plants yet.")}
                          </TableCell>
                        </TableRow>
                      )}
                      {!isLoading &&
                        !isError &&
                        paginatedProcessingPlants.map((plant: ProcessingPlant) => (
                          <TableRow key={plant.id}>
                            <TableCell>{plant.name}</TableCell>
                            <TableCell className="ppTableMono">{plant.userId}</TableCell>
                            <TableCell>{plant.contact}</TableCell>
                            <TableCell>
                              <span className={plant.status ? "ppBadge ppBadgeActive" : "ppBadge"}>
                                {plant.status ? t("Active") : t("Inactive")}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                {!isLoading && !isError && processingPlants.length > 0 && (
                  <div className="ppPaginationSlot">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={processingPlants.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      pageSizeOptions={[10, 20, 50]}
                      onPageSizeChange={setPageSize}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Send History Tab */}
          <TabsContent value="history" className="ppTabContent">
            <Card>
              <CardHeader>
                <CardTitle>{t("Send History")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="ppTableWrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Processing Plant")}</TableHead>
                        <TableHead>{t("Livestock Item")}</TableHead>
                        <TableHead>{t("Quantity")}</TableHead>
                        <TableHead>{t("Weight")}</TableHead>
                        <TableHead>{t("Date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sendHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="ppTableEmpty">
                            {t("No send history yet.")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        sendHistory.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.plantName}</TableCell>
                            <TableCell>{entry.livestockItemLabel}</TableCell>
                            <TableCell>{entry.quantity}</TableCell>
                            <TableCell>{typeof entry.weight === "number" ? entry.weight : "-"}</TableCell>
                            <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </section>
  );
}
