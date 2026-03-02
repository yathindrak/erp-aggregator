"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useWorkspace } from "@/providers/workspace-provider";
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

export function AppSidebar() {
  const pathname = usePathname();

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
  ];

  return (
    <Sidebar animate={false} open={true}>
      <SidebarBody className="flex flex-col">
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <Logo />

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
      </SidebarBody>
    </Sidebar>
  );
}
