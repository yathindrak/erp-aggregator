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
import { createOrganization } from "@/actions/organization.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
}

interface Connection {
  erpName: string;
  hasToken: boolean;
}

interface Org {
  id: string;
  name: string;
}

interface WorkspaceContextValue {
  orgId: string;
  orgName: string;
  orgs: Org[];
  clientId: string;
  clients: Client[];
  setClientId: (id: string) => void;
  erpName: string;
  setErpName: (name: string) => void;
  connections: Connection[];
  refreshConnections: () => Promise<void>;
  setShowCreateModal: (show: boolean) => void;
  setShowCreateOrgModal: (show: boolean) => void;
  bootstrapped: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  orgId: "",
  orgName: "",
  orgs: [],
  clientId: "",
  clients: [],
  setClientId: () => undefined,
  erpName: "",
  setErpName: () => undefined,
  connections: [],
  refreshConnections: async () => undefined,
  setShowCreateModal: () => undefined,
  setShowCreateOrgModal: () => undefined,
  bootstrapped: false,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children, activeOrg, orgs }: { children: React.ReactNode; activeOrg: Org; orgs: Org[] }) {
  const { id: orgId, name: orgName } = activeOrg;
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientIdState] = useState("");
  const [erpName, setErpNameState] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const router = useRouter();

  const { execute: executeCreateOrg, isPending: isCreatingOrg } = useAction(createOrganization, {
    onSuccess: () => {
      setShowCreateOrgModal(false);
      setNewOrgName("");
      router.refresh();
    },
  });

  const { executeAsync: executeGetClients } = useAction(getClients);
  const { executeAsync: executeGetConnections } = useAction(getConnections);

  // Load clients on mount and whenever the active org changes
  useEffect(() => {
    setClients([]);
    setClientIdState("");
    setConnections([]);
    setErpNameState("");
    setShowCreateModal(false);
    setBootstrapped(false);

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
  }, [orgId]);

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
        orgId,
        orgName,
        orgs,
        clientId,
        clients,
        setClientId,
        erpName,
        setErpName,
        connections,
        refreshConnections,
        setShowCreateModal,
        setShowCreateOrgModal,
        bootstrapped,
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
      <Dialog open={showCreateOrgModal} onOpenChange={setShowCreateOrgModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 pt-2"
            onSubmit={(e) => { e.preventDefault(); executeCreateOrg({ name: newOrgName }); }}
          >
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Acme Accounting"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={isCreatingOrg || !newOrgName.trim()}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingOrg ? "Creating…" : "Create workspace"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      {children}
    </WorkspaceContext.Provider>
  );
}
