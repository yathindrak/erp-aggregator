"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useWorkspace } from "@/providers/workspace-provider";
import { signOut, authClient } from "@/lib/auth-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconLayoutDashboard,
  IconFileInvoice,
  IconUsers,
  IconBook2,
  IconNotes,
  IconPlugConnected,
  IconBolt,
  IconPlus,
  IconCash,
  IconLogout,
  IconUsersGroup,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const Logo = () => (
  <Link className="group flex items-center gap-2.5 py-1" href="/">
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-blue-500/25 shadow-lg transition-shadow group-hover:shadow-blue-500/40">
      <IconBolt className="h-4 w-4 text-white" stroke={2.5} />
    </div>
    <div className="flex flex-col">
      <span className="font-bold text-base text-foreground leading-tight tracking-tight">
        Taxxa
      </span>
      <span className="font-medium text-[10px] text-muted-foreground uppercase leading-tight tracking-widest">
        ERP Workspace
      </span>
    </div>
  </Link>
);

function ClientSelector() {
  const { clients, clientId, setClientId, setShowCreateModal } = useWorkspace();

  if (clients.length === 0) return null;

  return (
    <div className="px-2 mb-4">
      <p className="mb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
        Client Space
      </p>
      <Select
        value={clientId}
        onValueChange={(val) => {
          if (val === "new") {
            setShowCreateModal(true);
          } else {
            setClientId(val);
          }
        }}
      >
        <SelectTrigger className="w-full bg-sidebar-accent/50 border-sidebar-accent hover:bg-sidebar-accent transition-colors">
          <SelectValue placeholder="Select a client" />
        </SelectTrigger>
        <SelectContent>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem
            value="new"
            className="text-blue-500 hover:text-blue-600 focus:text-blue-600 focus:bg-blue-500/10 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <IconPlus className="h-4 w-4" />
              <span className="font-medium">Create client</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function TenantSwitcher() {
  const { orgId, orgName, orgs, setShowCreateOrgModal, bootstrapped } = useWorkspace();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (bootstrapped) setSwitching(false);
  }, [bootstrapped]);

  if (!orgName) return null;

  const isLoading = switching || isPending;

  async function handleSwitch(id: string) {
    if (id === "new") { setShowCreateOrgModal(true); return; }
    if (id === orgId) return;
    setSwitching(true);
    await authClient.organization.setActive({ organizationId: id });
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-3 mb-1">
      <Select value={orgId} onValueChange={handleSwitch} disabled={isLoading}>
        <SelectTrigger className="w-full border-sidebar-accent bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors disabled:opacity-70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/20 text-[10px] font-bold text-blue-400">
              {isLoading ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
              ) : (
                orgName[0]?.toUpperCase()
              )}
            </div>
            <span className="truncate text-xs font-medium text-foreground">{orgName}</span>
          </div>
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          {orgs.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value="new" className="text-blue-500 focus:text-blue-600 focus:bg-blue-500/10 cursor-pointer">
            <div className="flex items-center gap-2">
              <IconPlus className="h-4 w-4" />
              <span className="font-medium">New workspace</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navLinks = [
    {
      label: "Dashboard",
      href: "/",
      icon: (
        <IconLayoutDashboard
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/" ? "text-blue-400" : "text-muted-foreground",
          )}
        />
      ),
    },
    {
      label: "Invoices",
      href: "/invoices",
      icon: (
        <IconFileInvoice
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/invoices"
              ? "text-blue-400"
              : "text-muted-foreground",
          )}
        />
      ),
    },
    {
      label: "Payments",
      href: "/payments",
      icon: (
        <IconCash
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/payments"
              ? "text-blue-400"
              : "text-muted-foreground",
          )}
        />
      ),
    },
    {
      label: "Contacts",
      href: "/contacts",
      icon: (
        <IconUsers
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/contacts"
              ? "text-blue-400"
              : "text-muted-foreground",
          )}
        />
      ),
    },
    {
      label: "Accounts",
      href: "/accounts",
      icon: (
        <IconBook2
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/accounts"
              ? "text-blue-400"
              : "text-muted-foreground",
          )}
        />
      ),
    },
    {
      label: "Journals",
      href: "/journals",
      icon: (
        <IconNotes
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/journals"
              ? "text-blue-400"
              : "text-muted-foreground",
          )}
        />
      ),
    },
    {
      label: "Connections",
      href: "/connections",
      icon: (
        <IconPlugConnected
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/connections"
              ? "text-blue-400"
              : "text-muted-foreground",
          )}
        />
      ),
    },
    {
      label: "Members",
      href: "/members",
      icon: (
        <IconUsersGroup
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/members"
              ? "text-blue-400"
              : "text-muted-foreground",
          )}
        />
      ),
    },
  ];

  return (
    <Sidebar animate={false} open={true}>
      <SidebarBody className="flex flex-col">
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <Logo />
          <TenantSwitcher />

          <div className="mt-6 flex flex-col gap-0.5">
            <ClientSelector />

            <p className="mb-2 px-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
              Workspace
            </p>
            {navLinks.slice(0, 6).map((link) => (
              <SidebarLink
                className={cn(
                  "rounded-lg transition-colors",
                  pathname === link.href
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
                key={link.href}
                link={link}
              />
            ))}

            <p className="mt-4 mb-2 px-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
              Settings
            </p>
            {navLinks.slice(6).map((link) => (
              <SidebarLink
                className={cn(
                  "rounded-lg transition-colors",
                  pathname === link.href
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
                key={link.href}
                link={link}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <IconLogout className="h-5 w-5 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
