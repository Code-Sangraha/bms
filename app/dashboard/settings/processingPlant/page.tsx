"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { paginate, usePagination } from "@/app/hooks/usePagination";
import {
  getLivestockItemsByProduct,
  getProducts,
  sendLivestockToProcessing,
  type LivestockItem,
} from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import { getUsers } from "@/handlers/user";
import {
  createProcessingPlant,
  getProcessingPlants,
  type ProcessingPlant,
} from "@/handlers/processingPlant";
import "./processingPlant.scss";

const PROCESSING_PLANTS_QUERY_KEY = ["processingPlants"];
const USERS_QUERY_KEY = ["users"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const PRODUCTS_QUERY_KEY = ["products"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];
const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];
const SEND_HISTORY_STORAGE_KEY = "processingPlantSendHistory";

type ProcessingSendHistoryItem = {
  id: string;
  plantId: string;
  plantName: string;
  livestockItemId: string;
  livestockItemLabel: string;
  quantity: number;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState(true);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [selectedLivestockItemId, setSelectedLivestockItemId] = useState("");
  const [sendQuantity, setSendQuantity] = useState("");
  const [sendHistory, setSendHistory] = useState<ProcessingSendHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: createProcessingPlant,
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setError(result.error ?? t("Failed to create processing plant"));
        return;
      }
      setError(null);
      setName("");
      setUserId("");
      setContact("");
      setStatus(true);
      setIsCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: PROCESSING_PLANTS_QUERY_KEY });
    },
    onError: () => {
      setError(t("Something went wrong. Please try again."));
    },
  });

  const handleCreate = () => {
    const trimmedName = name.trim();
    const trimmedContact = contact.trim();
    if (!trimmedName) return setError(t("Processing plant name is required."));
    if (!userId) return setError(t("Please select user."));
    if (!trimmedContact) return setError(t("Contact is required."));

    setError(null);
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
      if (!selectedPlantId) {
        return { ok: false as const, error: t("Please select processing plant.") };
      }
      if (!selectedLivestockItemId) {
        return { ok: false as const, error: t("Please select livestock item.") };
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false as const, error: t("Quantity must be greater than 0.") };
      }

      const currentItem = livestockItems.find((item) => item.itemId === selectedLivestockItemId);
      if (!currentItem) {
        return { ok: false as const, error: t("Selected livestock item not found.") };
      }
      return sendLivestockToProcessing({
        livestockItemId: selectedLivestockItemId,
        quantity: String(qty),
        weight: String(qty),
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.error ?? t("Failed to send livestock to processing plant."));
        return;
      }
      const selectedPlant = processingPlants.find((plant) => plant.id === selectedPlantId);
      const selectedItem = livestockItems.find((item) => resolveLivestockItemId(item) === selectedLivestockItemId);
      const newHistory: ProcessingSendHistoryItem = {
        id: `${Date.now()}-${selectedLivestockItemId}`,
        plantId: selectedPlantId,
        plantName: selectedPlant?.name ?? selectedPlantId,
        livestockItemId: selectedLivestockItemId,
        livestockItemLabel: selectedItem
          ? `${selectedItem.itemId} - ${selectedItem.name}`
          : selectedLivestockItemId,
        quantity: Number(sendQuantity),
        createdAt: new Date().toISOString(),
      };
      setSendHistory((prev) => {
        const next = [newHistory, ...prev].slice(0, 100);
        localStorage.setItem(SEND_HISTORY_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setError(null);
      setSelectedLivestockItemId("");
      setSelectedPlantId("");
      setSendQuantity("");
      queryClient.invalidateQueries({ queryKey: LIVESTOCK_ITEMS_QUERY_KEY });
    },
    onError: () => {
      setError(t("Something went wrong. Please try again."));
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
            setError(null);
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
          setError(null);
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
                setError(null);
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

      {error && <p className="error">{error}</p>}

      <div className="sendCard">
        <h2 className="cardTitle">{t("Send Livestock To Processing Plant")}</h2>
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
                return (
                  <option key={`${item.productId}-${item.itemId}`} value={item.itemId}>
                    {`${item.itemId} - ${item.name} (${item.itemQuantityOrWeight ?? item.weight})`}
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
              min={0}
              step="any"
              value={sendQuantity}
              onChange={(e) => setSendQuantity(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="saveBtn"
            onClick={() => sendToProcessingMutation.mutate()}
            disabled={
              sendToProcessingMutation.isPending ||
              !selectedPlantId ||
              !selectedLivestockItemId ||
              Number(sendQuantity) <= 0
            }
          >
            {sendToProcessingMutation.isPending ? t("Sending...") : t("Send")}
          </button>
        </div>
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
