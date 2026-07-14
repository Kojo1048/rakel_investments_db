'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Building2, LayoutDashboard, Users, FileText, Settings, LogOut,
  Upload, Building, ChevronRight, FolderOpen, UserCheck, Crown,
  ClipboardList, Receipt, FileSignature, FileBarChart2, Database,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface DashboardSidebarProps {
  services?: unknown[];  // kept for backward compat — no longer rendered
}

export function DashboardSidebar({ services }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const adminNavItems: NavItem[] = [
    { label: 'Overview',      href: '/admin',                   icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Companies',     href: '/admin/companies',          icon: <Building       className="h-4 w-4" /> },
    { label: 'Users',         href: '/admin/users',              icon: <Users          className="h-4 w-4" /> },
    { label: 'Registrations', href: '/admin/registrations',      icon: <UserCheck      className="h-4 w-4" /> },
    { label: 'Contracts',     href: '/superadmin/contracts',     icon: <FileSignature  className="h-4 w-4" /> },
    { label: 'Operations',    href: '/superadmin/operations',    icon: <ClipboardList  className="h-4 w-4" /> },
    { label: 'Invoices',      href: '/superadmin/invoices',      icon: <Receipt        className="h-4 w-4" /> },
    { label: 'Documents',     href: '/superadmin/documents',     icon: <FolderOpen     className="h-4 w-4" /> },
    { label: 'Reports',       href: '/admin/reports',            icon: <FileBarChart2  className="h-4 w-4" /> },
    { label: 'Audit Logs',    href: '/admin/audit',              icon: <FileText       className="h-4 w-4" /> },
    { label: 'Settings',      href: '/superadmin/settings',      icon: <Settings       className="h-4 w-4" /> },
  ];

  const rakelAdminNavItems: NavItem[] = [
    { label: 'Overview',   href: '/admin',                   icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Companies',  href: '/admin/companies',          icon: <Building        className="h-4 w-4" /> },
    { label: 'Users',      href: '/admin/users',              icon: <Users           className="h-4 w-4" /> },
    { label: 'Contracts',  href: '/company/contracts',        icon: <FileSignature   className="h-4 w-4" /> },
    { label: 'Operations', href: '/rakel/operations',         icon: <ClipboardList   className="h-4 w-4" /> },
    { label: 'Invoices',   href: '/rakel/invoices',           icon: <Receipt         className="h-4 w-4" /> },
    { label: 'Documents',  href: '/admin/company-documents',  icon: <FolderOpen      className="h-4 w-4" /> },
    { label: 'Settings',   href: '/admin/settings',           icon: <Settings        className="h-4 w-4" /> },
  ];

  const ceoNavItems: NavItem[] = [
    { label: 'Overview',    href: '/ceo',                   icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Contracts',   href: '/company/contracts',     icon: <FileSignature   className="h-4 w-4" /> },
    { label: 'Operations',  href: '/ceo/operations',        icon: <ClipboardList   className="h-4 w-4" /> },
    { label: 'Invoices',    href: '/ceo/invoices',          icon: <Receipt         className="h-4 w-4" /> },
    { label: 'Documents',   href: '/ceo/documents',         icon: <FolderOpen      className="h-4 w-4" /> },
  ];

  // Full module list for COMPANY_ADMIN and non-STAFF roles
  const ALL_COMPANY_NAV: NavItem[] = [
    { label: 'Overview',    href: '/company',            icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Operations',  href: '/company/operations', icon: <ClipboardList   className="h-4 w-4" /> },
    { label: 'Contracts',   href: '/company/contracts',  icon: <FileSignature   className="h-4 w-4" /> },
    { label: 'Invoices',    href: '/company/invoices',   icon: <Receipt         className="h-4 w-4" /> },
    { label: 'Documents',   href: '/company/documents',  icon: <FolderOpen      className="h-4 w-4" /> },
    { label: 'Upload Data', href: '/company/upload',     icon: <Upload          className="h-4 w-4" /> },
    { label: 'Staff',       href: '/company/staff',      icon: <Users           className="h-4 w-4" /> },
  ];

  // Company Admin: dedicated, simplified nav scoped to their own company's data.
  const companyAdminNavItems: NavItem[] = [
    { label: 'Overview',    href: '/company',            icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Operations',  href: '/company/operations', icon: <ClipboardList   className="h-4 w-4" /> },
    { label: 'Contracts',   href: '/company/contracts',  icon: <FileSignature   className="h-4 w-4" /> },
    { label: 'Invoices',    href: '/company/invoices',   icon: <Receipt         className="h-4 w-4" /> },
    { label: 'Documents',   href: '/company/documents',  icon: <FolderOpen      className="h-4 w-4" /> },
  ];

  // ── Staff nav: ALL Staff users share the same simplified navigation ─────────
  // Staff interact exclusively through the Upload Data Hub.
  // No individual module links, no analytics, no admin controls.
  const staffNavItems: NavItem[] = [
    { label: 'Overview',    href: '/company',            icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Upload Data', href: '/company/upload-hub', icon: <Database        className="h-4 w-4" /> },
  ];

  // For regular STAFF users: show only the modules they selected during registration.
  // Overview is always included. If staffModules is empty/null show everything.
  const staffModules: string[] = (user?.role === 'STAFF' && (user as any).staffModules)
    ? (user as any).staffModules as string[]
    : [];

  const MODULE_HREFS: Record<string, string> = {
    contracts:  '/company/contracts',
    invoices:   '/company/invoices',
    documents:  '/company/documents',
    operations: '/company/operations',
  };

  const companyNavItems: NavItem[] =
    user?.role === 'STAFF' && staffModules.length > 0
      ? ALL_COMPANY_NAV.filter(item =>
          item.href === '/company' ||           // always show Overview
          item.href === '/company/upload' ||    // always allow uploads
          Object.entries(MODULE_HREFS).some(
            ([mod, href]) => href === item.href && staffModules.includes(mod)
          )
        )
      : ALL_COMPANY_NAV;

  const navItems =
    user?.role === 'SUPER_ADMIN'    ? adminNavItems
    : user?.role === 'RAKEL_ADMIN'  ? rakelAdminNavItems
    : user?.role === 'CEO'          ? ceoNavItems
    : user?.role === 'STAFF'        ? staffNavItems       // ALL Staff → Upload Hub only
    : user?.role === 'COMPANY_ADMIN' ? companyAdminNavItems
    : companyNavItems;

  const roleLabel =
    user?.role === 'SUPER_ADMIN'    ? 'Super Administrator'
    : user?.role === 'RAKEL_ADMIN'  ? 'Rakel Admin'
    : user?.role === 'CEO'          ? 'Chief Executive Officer'
    : user?.role === 'STAFF'        ? (user.companyName ?? 'Staff')
    : user?.role === 'COMPANY_ADMIN' ? (user.companyName ?? 'Company Admin')
    : user?.role ?? '';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              {user?.role === 'CEO' ? (
                <Crown className="h-5 w-5 text-primary" />
              ) : (
                <Building2 className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-sidebar-foreground">Rakel Investments</h1>
              <p className="text-xs text-muted-foreground">
                {user?.role === 'CEO' ? 'Executive Portal' : 'Operations DBMS'}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="mb-2">
            <span className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Main Menu
            </span>
          </div>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  pathname === item.href && 'bg-sidebar-accent text-sidebar-primary'
                )}
              >
                {item.icon}
                {item.label}
                {pathname === item.href && (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </Button>
            </Link>
          ))}

        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-3 rounded-lg bg-sidebar-accent/50 p-3">
            <p className="text-sm font-medium text-sidebar-foreground">
              {user?.fullName || user?.username}
            </p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </aside>
  );
}
