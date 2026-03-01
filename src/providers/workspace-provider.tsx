"use client";

import type React from "react";
import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { ClientCreationModal } from "@/components/client-creation-modal";
import { useAction } from "next-safe-action/hooks";
import { getClients } from "@/actions/client.actions";
import { getConnections } from "@/actions/connections.actions";

interface Client {
  id: string;
  name: string;
}

interface Connection {
  erpName: string;
  hasToken: boolean;
}

interface WorkspaceContextValue {
  clientId: string;
  clients: Client[];
  setClientId: (id: string) => void;
  erpName: string;
  setErpName: (name: string) => void;
  connections: Connection[];
  refreshConnections: () => Promise<void>;
  setShowCreateModal: (show: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  clientId: "",
  clients: [],
  setClientId: () => undefined,
  erpName: "",
  setErpName: () => undefined,
  connections: [],
  refreshConnections: async () => undefined,
  setShowCreateModal: () => undefined,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientIdState] = useState("");
  const [erpName, setErpNameState] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const { executeAsync: executeGetClients } = useAction(getClients);
  const { executeAsync: executeGetConnections } = useAction(getConnections);

  // Load clients on mount
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await executeGetClients();
        if (res?.data) {
          const data = res.data as Client[];
          setClients(data);
          if (data.length === 0) {
            setShowCreateModal(true);
          } else {
            const savedId = localStorage.getItem("taxxa_client_id");
            const found = data.find((c) => c.id === savedId);
            setClientIdState(found ? found.id : data[0]!.id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setBootstrapped(true);
      }
    }
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executeGetClients]);

  const refreshConnections = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await executeGetConnections({ clientId });
      if (res?.data) {
        const data = res.data as Connection[];
        const active = data.filter((c) => c.hasToken);
        setConnections(active);
        if (active.length > 0 && !active.find((c) => c.erpName === erpName)) {
          setErpNameState(active[0]!.erpName);
        }
        if (active.length === 0) setErpNameState("");
      } else {
        setConnections([]);
      }
    } catch {
      setConnections([]);
    }
  }, [clientId, erpName, executeGetConnections]);

  const setClientId = useCallback((id: string) => {
    setClientIdState(id);
    localStorage.setItem("taxxa_client_id", id);
    setConnections([]);
    setErpNameState("");
  }, []);

  const setErpName = useCallback((name: string) => {
    setErpNameState(name);
  }, []);

  // Fetch connections whenever clientId changes
  useEffect(() => {
    void refreshConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleClientCreated = (client: Client) => {
    setClients((prev) => [...prev, client]);
    setClientIdState(client.id);
    localStorage.setItem("taxxa_client_id", client.id);
    setShowCreateModal(false);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        clientId,
        clients,
        setClientId,
        erpName,
        setErpName,
        connections,
        refreshConnections,
        setShowCreateModal,
      }}
    >
      {bootstrapped && (
        <ClientCreationModal
          cancellable={clients.length > 0}
          onCreated={handleClientCreated}
          onOpenChange={setShowCreateModal}
          open={showCreateModal}
        />
      )}
      {children}
    </WorkspaceContext.Provider>
  );
}
