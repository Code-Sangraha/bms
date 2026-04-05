"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  restockProduct,
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
  const [completeOutputWeight, setCompleteOutputWeight] = useState("");
  const [completeWasteWeight, setCompleteWasteWeight] = useState("");
  const [completeOutletId, setCompleteOutletId] = useState("");
  const [completeOutputProductId, setCompleteOutputProductId] = useState("");
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

  const completeOutletProcessedProducts = useMemo(() => {
    if (!completeOutletId) return processedProducts;
    return processedProducts.filter((product) => product.outletId === completeOutletId);
  }, [processedProducts, completeOutletId]);

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
      const availableAmount = Number(currentItem.itemQuantityOrWeight ?? currentItem.weight ?? 0);
      if (
        currentItem.isBulk &&
        Number.isFinite(availableAmount) &&
        availableAmount > 0 &&
        qty > availableAmount
      ) {
        return {
          ok: false as const,
          error: t("Insufficient livestock quantity for selected item."),
        };
      }

      return sendLivestockToProcessing({
        livestockItemId: selectedLivestockItemId,
        plantId: selectedPlantId,
        quantity: currentItem.isBulk ? qty : 1,
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
        quantity: selectedLivestockItem?.isBulk ? Number(sendQuantity) : 1,
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
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."));
    },
  });

  useEffect(() => {
    if (!selectedLivestockItem) return;
    if (selectedLivestockItem.isBulk) {
      const available = Number(
        selectedLivestockItem.itemQuantityOrWeight ?? selectedLivestockItem.weight ?? 0
      );
      setSendQuantity(available > 0 ? String(available) : "");
    } else {
      setSendQuantity("1");
    }
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
      const outputWeight = Number(completeOutputWeight);
      const wasteWeight = Number(completeWasteWeight);
      if (!selectedBatchId) {
        return { ok: false as const, error: t("Please select batch.") };
      }
      if (!completeOutletId) {
        return { ok: false as const, error: t("Please select outlet.") };
      }
      if (!completeOutputProductId) {
        return { ok: false as const, error: t("Please select output product.") };
      }
      if (!Number.isFinite(outputWeight) || outputWeight < 0) {
        return { ok: false as const, error: t("Output weight must be 0 or greater.") };
      }
      if (!Number.isFinite(wasteWeight) || wasteWeight < 0) {
        return { ok: false as const, error: t("Waste weight must be 0 or greater.") };
      }

      const completeResult = await completeLivestockProcessing({
        batchId: selectedBatchId,
        outputWeight,
        wasteWeight,
        outletId: completeOutletId,
        outputProductId: completeOutputProductId,
      });
      if (!completeResult.ok) return completeResult;

      // Some deployments mark batch complete but do not reliably add output
      // stock to the processed product record. We map it explicitly here.
      if (outputWeight > 0) {
        const restockResult = await restockProduct({
          id: completeOutputProductId,
          outletId: completeOutletId,
          weight: outputWeight,
          quantity: outputWeight,
        });
        if (!restockResult.ok) {
          return {
            ok: false as const,
            status: restockResult.status,
            error:
              restockResult.error ??
              t("Processing completed, but failed to update processed stock weight."),
          };
        }
      }

      return completeResult;
    },
    onSuccess: (result) => {
      if (!result.ok) {
        showToast(result.error ?? t("Failed to complete processing."));
        return;
      }
      setSelectedBatchId("");
      setCompleteOutputWeight("");
      setCompleteWasteWeight("");
      setCompleteOutletId("");
      setCompleteOutputProductId("");
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
      <div className="breadcrumb">
        <span>{t("Settings")}</span> {" > "} {t("Processing Plant")}
      </div>

      <div className="header">
        <div className="headerText">
          <h1 className="pageTitle">{t("Processing Plant")}</h1>
          <p className="pageSubtitle">{t("Create and manage processing plants")}</p>
        </div>
        <button
          type="button"
          className="addBtn"
          onClick={() => {
            setIsCreateModalOpen(true);
          }}
        >
          {t("Add Processing Plant")}
        </button>
      </div>

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
          <div className="modalFooter">
            <button
              type="button"
              className="cancelBtn"
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
              className="saveBtn"
              onClick={handleCreate}
              disabled={createMutation.isPending || !name.trim() || !userId || !contact.trim()}
            >
              {createMutation.isPending ? t("Saving...") : t("Create")}
            </button>
          </div>
        }
      >
        <div className="createRowModal">
          <input
            className="input"
            placeholder={t("Enter processing plant name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="input"
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
          <input
            className="input"
            placeholder={t("Enter contact")}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <select
            className="input"
            value={status ? "active" : "inactive"}
            onChange={(e) => setStatus(e.target.value === "active")}
          >
            <option value="active">{t("Active")}</option>
            <option value="inactive">{t("Inactive")}</option>
          </select>
        </div>
      </Modal>

      <div className="sendCard">
        <h2 className="cardTitle">{t("Send Livestock To Processing Plant")}</h2>
        {!canManageMainFlow && (
          <p className="error">
            {t("Only Main Outlet can send livestock to processing and complete processing.")}
          </p>
        )}
        <div className="sendGrid">
          <label className="field">
            <span>{t("Processing Plant")}</span>
            <select
              className="input"
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
          <label className="field">
            <span>{t("Livestock Item")}</span>
            <select
              className="input"
              value={selectedLivestockItemId}
              onChange={(e) => setSelectedLivestockItemId(e.target.value)}
            >
              <option value="">{t("Select livestock item")}</option>
              {livestockItems.map((item) => {
                const resolvedId = resolveLivestockItemId(item);
                if (!resolvedId) return null;
                const available = Number(item.itemQuantityOrWeight ?? item.weight ?? 0);
                return (
                  <option key={`${item.productId}-${resolvedId}`} value={resolvedId}>
                    {`${item.itemId} - ${item.name} (${Number.isFinite(available) ? available : 0})`}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="field fieldSm">
            <span>{t("Quantity")}</span>
            <input
              className="input"
              type="number"
              min={1}
              step="any"
              value={sendQuantity}
              onChange={(e) => setSendQuantity(e.target.value)}
              disabled={!!selectedLivestockItem && !selectedLivestockItem.isBulk}
            />
          </label>
          <label className="field fieldSm">
            <span>{t("Weight")}</span>
            <input
              className="input"
              type="number"
              min={1}
              step="any"
              value={sendWeight}
              onChange={(e) => setSendWeight(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="saveBtn"
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

      <div className="sendCard">
        <h2 className="cardTitle">{t("Complete Processing")}</h2>
        <div className="sendGrid completeGrid">
          <label className="field">
            <span>{t("Batch")}</span>
            <select
              className="input"
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
          <label className="field fieldSm">
            <span>{t("Output Weight")}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={completeOutputWeight}
              onChange={(e) => setCompleteOutputWeight(e.target.value)}
            />
          </label>
          <label className="field fieldSm">
            <span>{t("Waste Weight")}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={completeWasteWeight}
              onChange={(e) => setCompleteWasteWeight(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t("Outlet")}</span>
            <select
              className="input"
              value={completeOutletId}
              onChange={(e) => setCompleteOutletId(e.target.value)}
            >
              <option value="">{t("Select outlet")}</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("Output Product")}</span>
            <select
              className="input"
              value={completeOutputProductId}
              onChange={(e) => setCompleteOutputProductId(e.target.value)}
            >
              <option value="">{t("Select processed product")}</option>
              {completeOutletProcessedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="saveBtn"
            onClick={() => completeProcessingMutation.mutate()}
            disabled={
              completeProcessingMutation.isPending ||
              !canManageMainFlow ||
              !selectedBatchId ||
              !completeOutletId ||
              !completeOutputProductId
            }
          >
            {completeProcessingMutation.isPending ? t("Saving...") : t("Complete")}
          </button>
        </div>
      </div>

      <div className="sendCard">
        <h2 className="cardTitle">{t("Transfer Processed Stock Between Outlets")}</h2>
        {!canManageMainFlow && (
          <p className="error">
            {t("Only Main Outlet can transfer processed stock between outlets.")}
          </p>
        )}
        <div className="sendGrid">
          <label className="field">
            <span>{t("From Outlet")}</span>
            <select
              className="input"
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
          <label className="field">
            <span>{t("Processed Product")}</span>
            <select
              className="input"
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
          <label className="field">
            <span>{t("To Outlet")}</span>
            <select
              className="input"
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
          <label className="field fieldSm">
            <span>{t("Weight")}</span>
            <input
              className="input"
              type="number"
              min={1}
              step="any"
              value={transferWeight}
              onChange={(e) => setTransferWeight(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="saveBtn"
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

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Batch ID")}</th>
              <th>{t("Processing Plant")}</th>
              <th>{t("Livestock Item")}</th>
              <th>{t("Quantity")}</th>
              <th>{t("Weight")}</th>
            </tr>
          </thead>
          <tbody>
            {pendingProcessing.length === 0 ? (
              <tr>
                <td colSpan={5} className="emptyCell">{t("No pending processing batches.")}</td>
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
                    <td className="mono">{entry.batchId}</td>
                    <td>{entry.plantName ?? historyMatch?.plantName ?? "-"}</td>
                    <td>{entry.livestockItemName ?? entry.itemId ?? historyMatch?.livestockItemLabel ?? "-"}</td>
                    <td>{typeof quantityValue === "number" ? quantityValue : "-"}</td>
                    <td>{typeof weightValue === "number" ? weightValue : "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Name")}</th>
              <th>{t("User ID")}</th>
              <th>{t("Contact")}</th>
              <th>{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="emptyCell">{t("Loading...")}</td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="emptyCell">
                  {errorDetail instanceof Error ? errorDetail.message : t("Failed to load processing plants")}
                </td>
              </tr>
            )}
            {!isLoading && !isError && processingPlants.length === 0 && (
              <tr>
                <td colSpan={4} className="emptyCell">{t("No processing plants yet.")}</td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              paginatedProcessingPlants.map((plant: ProcessingPlant) => (
                <tr key={plant.id}>
                  <td>{plant.name}</td>
                  <td className="mono">{plant.userId}</td>
                  <td>{plant.contact}</td>
                  <td>
                    <span className={plant.status ? "badge badgeActive" : "badge"}>
                      {plant.status ? t("Active") : t("Inactive")}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!isLoading && !isError && processingPlants.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={processingPlants.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <div className="historyCard">
        <h2 className="cardTitle">{t("Send History")}</h2>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Processing Plant")}</th>
                <th>{t("Livestock Item")}</th>
                <th>{t("Quantity")}</th>
                <th>{t("Date")}</th>
              </tr>
            </thead>
            <tbody>
              {sendHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="emptyCell">{t("No send history yet.")}</td>
                </tr>
              ) : (
                sendHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.plantName}</td>
                    <td>{entry.livestockItemLabel}</td>
                    <td>{entry.quantity}</td>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
