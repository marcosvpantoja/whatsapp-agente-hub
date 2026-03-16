import {
  LayoutDashboard, CalendarDays, DoorOpen, MessageCircle, Settings,
  TicketCheck, Users, User, LogOut,
} from "lucide-react";
import syntraLogo from "@/assets/syntra-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const clientItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Salas", url: "/salas", icon: DoorOpen },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const masterItems = [
  { title: "Dashboard Master", url: "/master", icon: LayoutDashboard },
  { title: "Clientes", url: "/master/clientes", icon: Users },
  { title: "Chamados", url: "/master/chamados", icon: TicketCheck },
];

const clientSupportItem = { title: "Chamados", url: "/chamados", icon: TicketCheck };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, role, logout } = useAuth();

  const navigationGroups = role === "master"
    ? [
        { label: "Master", items: masterItems },
        { label: "Operacao", items: [...clientItems, clientSupportItem] },
      ]
    : [
        { label: "Menu", items: [...clientItems, clientSupportItem] },
      ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className={`flex w-full min-w-0 items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <img
            src={syntraLogo}
            alt="Syntra Spaces"
            className="h-9 w-9 rounded-full object-contain shrink-0"
          />
          {!collapsed && (
            <span className="text-sidebar-foreground font-semibold text-lg tracking-tight">Syntra Spaces</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = location.pathname === item.url ||
                    (item.url !== "/" && item.url !== "/master" && location.pathname.startsWith(item.url));

                  return (
                    <SidebarMenuItem key={`${group.label}-${item.url}`}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        className={active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}
                      >
                        <NavLink to={item.url} end={item.url === "/" || item.url === "/master"} activeClassName="">
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {user && (
          <div className="space-y-2">
            {!collapsed && <Separator className="bg-sidebar-border" />}
            {!collapsed ? (
              <>
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-sidebar-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                    <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground text-xs" onClick={logout}>
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
                </Button>
              </>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip={user.name} className="text-sidebar-foreground/70">
                    <User className="h-5 w-5 shrink-0" />
                    <span>{user.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Sair" className="text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={logout}>
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span>Sair</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
