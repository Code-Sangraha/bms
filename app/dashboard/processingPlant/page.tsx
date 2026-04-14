"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { paginate, usePagination } from "@/app/hooks/usePagination";
import {
  completeLivestockProcessing,
  getPendingLivestockProcessing,
  getLivestockItemsByProduct,
  getProducts,
  transferProcessedStock,
  type PendingLivestockProcessingItem,
  sendLivestockToProcessing,
  type LivestockItem,
} from "@/handlers/product";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { getUsers } from "@/handlers/user";
import {
  createProcessingPlant,
  getProcessingPlants,
  type ProcessingPlant,
} from "@/handlers/processingPlant";
import { getStoredOutletId } from "@/lib/auth/user";
import { useToast } from "@/app/providers/ToastProvider";
import "./processingPlant.scss";

const PROCESSING_PLANTS_QUERY_KEY = ["processingPlants"];
const USERS_QUERY_KEY = ["users"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const PRODUCTS_QUERY_KEY = ["products"];
const OUTLETS_QUERY_KEY = ["outlets"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];
const PENDING_PROCESSING_QUERY_KEY = ["pendingLivestockProcessing"];
const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];
const PROCESSED_PRODUCT_TYPE_NAMES = ["processed"];
const SEND_HISTORY_STORAGE_KEY = "processingPlantSendHistory";

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
  const { showToast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
  const [completeOutputLines, setCompleteOutputLines] = useState<CompleteOutputLineDraft[]>(() => [
    createEmptyCompleteOutputLine(),
  ]);
  const [transferSourceOutletId, setTransferSourceOutletId] = useState("");
  const [transferDestinationOutletId, setTransferDestinationOutletId] = useState("");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferWeight, setTransferWeight] = useState("");
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

  const processedTypeIds = useMemo(() => {
    const ids = new Set<string>();
    productTypes.forEach((pt) => {
      if (PROCESSED_PRODUCT_TYPE_NAMES.includes(pt.name.toLowerCase())) ids.add(pt.id);
    });
    return ids;
  }, [productTypes]);

  const processedProducts = useMemo(
    () =>
      products.filter((p) => {
        const productTypeName =
          typeof p.productType === "object" && typeof p.productType?.name === "string"
            ? p.productType.name.toLowerCase()
            : "";
        return processedTypeIds.has(p.productTypeId) || PROCESSED_PRODUCT_TYPE_NAMES.includes(productTypeName);
      }),
    [products, processedTypeIds]
  );

  const storedOutletId = getStoredOutletId();
  const mainOutlet = useMemo(
    () => outlets.find((o) => o.name.trim().toLowerCase() === "main outlet") ?? null,
    [outlets]
  );
  const canManageMainFlow = !storedOutletId || !mainOutlet || storedOutletId === mainOutlet.id;

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

  const processedProductsForOutlet = useCallback(
    (outletId: string) =>
      outletId ? processedProducts.filter((product) => product.outletId === outletId) : [],
    [processedProducts]
  );

  const completeFormCanSubmit = useMemo(() => {
    if (!selectedBatchId || !canManageMainFlow) return false;
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
    return hasValidLine;
  }, [selectedBatchId, canManageMainFlow, completeWasteWeight, completeOutputLines]);

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
    if (!userId) {
      showToast(t("Please select user."));
      return;
    }
    if (!trimmedContact) {
      showToast(t("Contact is required."));
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

  const completeProcessingMutation = useMutation({
    mutationFn: async () => {
      const wasteWeight = Number(completeWasteWeight);
      if (!selectedBatchId) {
        return { ok: false as const, error: t("Please select batch.") };
      }
      if (!Number.isFinite(wasteWeight) || wasteWeight < 0) {
        return { ok: false as const, error: t("Waste weight must be 0 or greater.") };
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

      return completeLivestockProcessing({
        batchId: selectedBatchId,
        wasteWeight,
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
      setCompleteOutputLines([createEmptyCompleteOutputLine()]);
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIVESTOCK_ITEMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PENDING_PROCESSING_QUERY_KEY });
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."));
    },
  });

  const transferProcessedMutation = useMutation({
    mutationFn: async () => {
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

      return transferProcessedStock({
        sourceProductId: sourceProduct.id,
        destinationProductId: destinationProduct.id,
        sourceOutletId: transferSourceOutletId,
        destinationOutletId: transferDestinationOutletId,
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
        <button
          type="button"
          className="ppBtnPrimary ppHeaderAction"
          onClick={() => {
            setIsCreateModalOpen(true);
          }}
        >
          {t("Add Processing Plant")}
        </button>
      </header>

      <Modal
        isOpen={isCreateModalOpen}
        title={t("Add Processing Plant")}
        subtitle={t("Create a new processing plant")}
        onClose={() => {
          setIsCreateModalOpen(false);
          setName("");
          setUserId("");
          setContact("");
          setStatus(true);
        }}
        footer={
          <>
            <button
              type="button"
              className="ppBtnSecondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setName("");
                setUserId("");
                setContact("");
                setStatus(true);
              }}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="ppBtnPrimary"
              onClick={handleCreate}
              disabled={createMutation.isPending || !name.trim() || !userId || !contact.trim()}
            >
              {createMutation.isPending ? t("Saving...") : t("Create")}
            </button>
          </>
        }
      >
        <div className="ppModalFields">
          <div className="ppField">
            <label className="ppLabel" htmlFor="pp-modal-plant-name">
              {t("Name")}
            </label>
            <input
              id="pp-modal-plant-name"
              className="ppInput"
              autoComplete="organization"
              placeholder={t("Enter processing plant name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="ppField">
            <label className="ppLabel" htmlFor="pp-modal-plant-user">
              {t("User")}
            </label>
            <select
              id="pp-modal-plant-user"
              className="ppInput"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">{t("Select user")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="ppField">
            <label className="ppLabel" htmlFor="pp-modal-plant-contact">
              {t("Contact")}
            </label>
            <input
              id="pp-modal-plant-contact"
              className="ppInput"
              autoComplete="tel"
              placeholder={t("Enter contact")}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <div className="ppField">
            <label className="ppLabel" htmlFor="pp-modal-plant-status">
              {t("Status")}
            </label>
            <select
              id="pp-modal-plant-status"
              className="ppInput"
              value={status ? "active" : "inactive"}
              onChange={(e) => setStatus(e.target.value === "active")}
            >
              <option value="active">{t("Active")}</option>
              <option value="inactive">{t("Inactive")}</option>
            </select>
          </div>
        </div>
      </Modal>

      <section className="ppSection" aria-labelledby="pp-section-operations-heading">
        <h2 id="pp-section-operations-heading" className="ppSectionTitle">
          {t("Operations workflow")}
        </h2>
        <p className="ppSectionLead">{t("Send, complete, and move stock through processing.")}</p>
        <div className="ppSectionGrid">
      <div className="ppCard ppCardWorkflow">
        <div className="ppCardHead">
          <span className="ppStepBadge" aria-hidden>
            1
          </span>
          <div className="ppCardHeadText">
            <h3 className="ppCardTitle" id="pp-card-send-title">
              {t("Send Livestock To Processing Plant")}
            </h3>
            <p className="ppCardDesc">{t("Queue livestock from inventory to a processing plant.")}</p>
          </div>
        </div>
        {!canManageMainFlow && (
          <p className="ppNotice ppNotice--warning" role="status">
            {t("Only Main Outlet can send livestock to processing and complete processing.")}
          </p>
        )}
        <div className="ppFormGrid" role="group" aria-labelledby="pp-card-send-title">
          <label className="ppField">
            <span className="ppLabel">{t("Processing Plant")}</span>
            <select
              className="ppInput"
              value={selectedPlantId}
              onChange={(e) => setSelectedPlantId(e.target.value)}
            >
              <option value="">{t("Select processing plant")}</option>
              {processingPlants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ppField">
            <span className="ppLabel">{t("Livestock Item")}</span>
            <select
              className="ppInput"
              value={selectedLivestockItemId}
              onChange={(e) => setSelectedLivestockItemId(e.target.value)}
            >
              <option value="">{t("Select livestock item")}</option>
              {livestockItems.map((item) => {
                const resolvedId = resolveLivestockItemId(item);
                if (!resolvedId) return null;
                const heads = resolveLivestockHeadCount(item);
                const qtyLabel = heads !== null ? String(heads) : "\u2014";
                return (
                  <option key={`${item.productId}-${resolvedId}`} value={resolvedId}>
                    {`${item.itemId} - ${item.name} (${qtyLabel})`}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="ppField ppFieldNarrow">
            <span className="ppLabel">{t("Quantity")}</span>
            <input
              className="ppInput"
              type="number"
              min={1}
              step="any"
              value={sendQuantity}
              onChange={(e) => setSendQuantity(e.target.value)}
            />
          </label>
          <label className="ppField ppFieldNarrow">
            <span className="ppLabel">{t("Weight")}</span>
            <input
              className="ppInput"
              type="number"
              min={1}
              step="any"
              value={sendWeight}
              onChange={(e) => setSendWeight(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ppBtnPrimary"
            onClick={() => sendToProcessingMutation.mutate()}
            disabled={
              sendToProcessingMutation.isPending ||
              !canManageMainFlow ||
              !selectedPlantId ||
              !selectedLivestockItemId ||
              Number(sendQuantity) <= 0 ||
              Number(sendWeight) <= 0
            }
          >
            {sendToProcessingMutation.isPending ? t("Sending...") : t("Send")}
          </button>
        </div>
      </div>

      <div className="ppCard ppCardWorkflow">
        <div className="ppCardHead">
          <span className="ppStepBadge" aria-hidden>
            2
          </span>
          <div className="ppCardHeadText">
            <h3 className="ppCardTitle" id="pp-card-complete-title">
              {t("Complete Processing")}
            </h3>
            <p className="ppCardDesc">
              {t("Record output, waste, and post stock to one or more outlets.")}
            </p>
          </div>
        </div>
        {!canManageMainFlow && (
          <p className="ppNotice ppNotice--warning" role="status">
            {t("Only Main Outlet can send livestock to processing and complete processing.")}
          </p>
        )}
        <div className="ppCompleteForm" role="group" aria-labelledby="pp-card-complete-title">
          <div className="ppCompleteFormTop">
            <label className="ppField">
              <span className="ppLabel">{t("Batch")}</span>
              <select
                className="ppInput"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
              >
                <option value="">{t("Select batch")}</option>
                {pendingBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ppField ppFieldNarrow">
              <span className="ppLabel">{t("Waste Weight")}</span>
              <input
                className="ppInput"
                type="number"
                min={0}
                step="any"
                value={completeWasteWeight}
                onChange={(e) => setCompleteWasteWeight(e.target.value)}
              />
            </label>
          </div>

          <p className="ppOutputLinesHeading">{t("Output lines")}</p>
          <div className="ppOutputLines">
            {completeOutputLines.map((line) => (
              <div key={line.id} className="ppOutputLineRow">
                <label className="ppField">
                  <span className="ppLabel">{t("Outlet")}</span>
                  <select
                    className="ppInput"
                    value={line.outletId}
                    onChange={(e) => {
                      const nextOutlet = e.target.value;
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
                    <option value="">{t("Select outlet")}</option>
                    {outlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ppField">
                  <span className="ppLabel">{t("Output Product")}</span>
                  <select
                    className="ppInput"
                    value={line.productId}
                    onChange={(e) =>
                      setCompleteOutputLines((prev) =>
                        prev.map((row) =>
                          row.id === line.id ? { ...row, productId: e.target.value } : row
                        )
                      )
                    }
                    disabled={!line.outletId}
                  >
                    <option value="">{t("Select processed product")}</option>
                    {processedProductsForOutlet(line.outletId).map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ppField ppFieldNarrow">
                  <span className="ppLabel">{t("Weight")}</span>
                  <input
                    className="ppInput"
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
                </label>
                <div className="ppOutputLineActions">
                  <button
                    type="button"
                    className="ppBtnSecondary ppBtnIconish"
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
                    {t("Remove line")}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="ppCompleteFormFooter">
            <button
              type="button"
              className="ppBtnSecondary"
              onClick={() =>
                setCompleteOutputLines((prev) => [...prev, createEmptyCompleteOutputLine()])
              }
            >
              {t("Add output line")}
            </button>
            <button
              type="button"
              className="ppBtnPrimary"
              onClick={() => completeProcessingMutation.mutate()}
              disabled={completeProcessingMutation.isPending || !completeFormCanSubmit}
            >
              {completeProcessingMutation.isPending ? t("Saving...") : t("Complete")}
            </button>
          </div>
        </div>
      </div>

      {/*
      Transfer Processed Stock Between Outlets — UI disabled; restore by replacing the block below with this card.
      <div className="ppCard ppCardWorkflow"> ... </div>
      */}
      {false && (
      <div className="ppCard ppCardWorkflow">
        <div className="ppCardHead">
          <span className="ppStepBadge" aria-hidden>
            3
          </span>
          <div className="ppCardHeadText">
            <h3 className="ppCardTitle" id="pp-card-transfer-title">
              {t("Transfer Processed Stock Between Outlets")}
            </h3>
            <p className="ppCardDesc">{t("Move processed inventory from one outlet to another.")}</p>
          </div>
        </div>
        {!canManageMainFlow && (
          <p className="ppNotice ppNotice--warning" role="status">
            {t("Only Main Outlet can transfer processed stock between outlets.")}
          </p>
        )}
        <div className="ppFormGrid" role="group" aria-labelledby="pp-card-transfer-title">
          <label className="ppField">
            <span className="ppLabel">{t("From Outlet")}</span>
            <select
              className="ppInput"
              value={transferSourceOutletId}
              onChange={(e) => {
                setTransferSourceOutletId(e.target.value);
                setTransferProductId("");
              }}
            >
              <option value="">{t("Select source outlet")}</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ppField">
            <span className="ppLabel">{t("Processed Product")}</span>
            <select
              className="ppInput"
              value={transferProductId}
              onChange={(e) => setTransferProductId(e.target.value)}
            >
              <option value="">{t("Select processed product")}</option>
              {sourceProcessedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ppField">
            <span className="ppLabel">{t("To Outlet")}</span>
            <select
              className="ppInput"
              value={transferDestinationOutletId}
              onChange={(e) => setTransferDestinationOutletId(e.target.value)}
            >
              <option value="">{t("Select destination outlet")}</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ppField ppFieldNarrow">
            <span className="ppLabel">{t("Weight")}</span>
            <input
              className="ppInput"
              type="number"
              min={1}
              step="any"
              value={transferWeight}
              onChange={(e) => setTransferWeight(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ppBtnPrimary"
            onClick={() => transferProcessedMutation.mutate()}
            disabled={
              transferProcessedMutation.isPending ||
              !canManageMainFlow ||
              !transferSourceOutletId ||
              !transferDestinationOutletId ||
              !transferProductId ||
              Number(transferWeight) <= 0
            }
          >
            {transferProcessedMutation.isPending ? t("Transferring...") : t("Transfer")}
          </button>
        </div>
      </div>
      )}
        </div>
      </section>

      <section className="ppSection" aria-labelledby="pp-section-registers-heading">
        <h2 id="pp-section-registers-heading" className="ppSectionTitle">
          {t("Registers and activity")}
        </h2>
        <p className="ppSectionLead">{t("Monitor queues, plants, and recent sends.")}</p>
        <div className="ppSectionGrid ppSectionGrid--loose">
      <div className="ppCard">
        <h3 className="ppCardTitle ppCardTitle--plain">{t("Pending processing")}</h3>
        <div className="ppTableWrap">
          <table className="ppTable">
            <thead>
              <tr>
                <th scope="col">{t("Batch ID")}</th>
                <th scope="col">{t("Processing Plant")}</th>
                <th scope="col">{t("Livestock Item")}</th>
                <th scope="col">{t("Quantity")}</th>
                <th scope="col">{t("Weight")}</th>
              </tr>
            </thead>
            <tbody>
              {pendingProcessing.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ppTableEmpty">
                    {t("No pending processing batches.")}
                  </td>
                </tr>
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
                    <tr key={entry.batchId}>
                      <td className="ppTableMono">{entry.batchId}</td>
                      <td>{entry.plantName ?? historyMatch?.plantName ?? "-"}</td>
                      <td>
                        {entry.livestockItemName ??
                          entry.itemId ??
                          historyMatch?.livestockItemLabel ??
                          "-"}
                      </td>
                      <td>{typeof quantityValue === "number" ? quantityValue : "-"}</td>
                      <td>{typeof weightValue === "number" ? weightValue : "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ppCard">
        <h3 className="ppCardTitle ppCardTitle--plain">{t("Registered plants")}</h3>
        <div className="ppTableWrap">
          <table className="ppTable">
            <thead>
              <tr>
                <th scope="col">{t("Name")}</th>
                <th scope="col">{t("User ID")}</th>
                <th scope="col">{t("Contact")}</th>
                <th scope="col">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="ppTableEmpty">
                    {t("Loading...")}
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={4} className="ppTableEmpty">
                    {errorDetail instanceof Error
                      ? errorDetail.message
                      : t("Failed to load processing plants")}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && processingPlants.length === 0 && (
                <tr>
                  <td colSpan={4} className="ppTableEmpty">
                    {t("No processing plants yet.")}
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                paginatedProcessingPlants.map((plant: ProcessingPlant) => (
                  <tr key={plant.id}>
                    <td>{plant.name}</td>
                    <td className="ppTableMono">{plant.userId}</td>
                    <td>{plant.contact}</td>
                    <td>
                      <span className={plant.status ? "ppBadge ppBadgeActive" : "ppBadge"}>
                        {plant.status ? t("Active") : t("Inactive")}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
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
      </div>

      <div className="ppCard">
        <h3 className="ppCardTitle ppCardTitle--plain">{t("Send History")}</h3>
        <div className="ppTableWrap">
          <table className="ppTable">
            <thead>
              <tr>
                <th scope="col">{t("Processing Plant")}</th>
                <th scope="col">{t("Livestock Item")}</th>
                <th scope="col">{t("Quantity")}</th>
                <th scope="col">{t("Weight")}</th>
                <th scope="col">{t("Date")}</th>
              </tr>
            </thead>
            <tbody>
              {sendHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ppTableEmpty">
                    {t("No send history yet.")}
                  </td>
                </tr>
              ) : (
                sendHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.plantName}</td>
                    <td>{entry.livestockItemLabel}</td>
                    <td>{entry.quantity}</td>
                    <td>{typeof entry.weight === "number" ? entry.weight : "-"}</td>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </section>
    </section>
  );
}
