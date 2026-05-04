export type UserRole = 'SUPER_ADMIN' | 'RAKEL_ADMIN' | 'CEO' | 'COMPANY_ADMIN' | 'STAFF';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'DECLINED';
export type ContractStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  companyId?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  email?: string | null;
  status: UserStatus;
  createdAt: Date | string;
  /** Modules a STAFF user selected during registration. Null for all other roles. */
  staffModules?: string[] | null;
}

export interface PendingRegistration {
  id: string;
  username: string;
  email: string;
  fullName: string;
  requestedRole: UserRole;
  companyId?: string | null;
  companyName?: string | null;
  reason: string;
  createdAt: Date | string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  isActive?: boolean;
  createdAt: Date | string;
  services?: Service[];
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  isActive?: boolean;
}

export interface AnalyticsRecord {
  id: string;
  companyId: string;
  serviceId: string;
  date: Date | string;
  revenue: number;
  orders: number;
  deliveries: number;
  performance: number;
}

export interface Contract {
  id: string;
  companyId: string;
  title: string;
  contractNumber?: string | null;
  client?: string | null;
  status: ContractStatus;
  startDate?: Date | string | null;
  expiryDate?: Date | string | null;
  description?: string | null;
  isArchived: boolean;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  company?: { name: string } | null;
  creator?: { username: string; fullName?: string | null } | null;
}

export interface OperationsRecord {
  id: string;
  companyId: string;
  contractId?: string | null;
  date: Date | string;
  department: string;
  manpowerCount: number;
  equipmentTotal: number;
  equipmentOperational: number;
  activityType: string;
  activityDescription?: string | null;
  performanceScore: number;
  notes?: string | null;
  isArchived: boolean;
  recordedBy: string;
  createdAt: Date | string;
  recorder?: { username: string; fullName?: string | null } | null;
  contract?: { title: string; contractNumber?: string | null } | null;
}

export interface Invoice {
  id: string;
  companyId: string;
  contractId?: string | null;
  invoiceNumber: string;
  client: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  paidDate?: Date | string | null;
  notes?: string | null;
  isArchived: boolean;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  company?: { name: string } | null;
  contract?: { title: string; contractNumber?: string | null } | null;
  creator?: { username: string } | null;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  createdAt: Date | string;
  ipAddress?: string | null;
  targetEntity?: string | null;
  companyId?: string | null;
}

export type ReminderInterval = '1_MONTH' | '2_WEEKS' | '1_WEEK' | '2_DAYS' | '3_HOURS';

export const REMINDER_INTERVAL_LABELS: Record<ReminderInterval, string> = {
  '1_MONTH':  '1 Month Before',
  '2_WEEKS':  '2 Weeks Before',
  '1_WEEK':   '1 Week Before',
  '2_DAYS':   '2 Days Before',
  '3_HOURS':  '3 Hours Before',
};

export interface Document {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  companyId?: string | null;
  serviceId?: string | null;
  contractId?: string | null;
  category: string;
  uploadedBy: string;
  uploadedAt: Date | string;
  description?: string | null;
  isArchived?: boolean;
  dateReceived?: Date | string | null;
  expiryDate?: Date | string | null;
  reminderSettings?: ReminderInterval[] | null;
  reminderSent?: Record<ReminderInterval, string> | null;
  storageKey?: string | null;
  company?: { name: string } | null;
  service?: { name: string } | null;
  contract?: { title: string } | null;
  uploader?: { username: string } | null;
}

// 'loading'         — initial state, waiting for server
// 'authenticated'   — API confirmed a valid session
// 'unauthenticated' — API confirmed no valid session → safe to redirect to login
// 'error'           — network timeout or server unreachable → do NOT redirect (would loop)
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthContextType {
  user: User | null;
  authStatus: AuthStatus;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => void;
}
