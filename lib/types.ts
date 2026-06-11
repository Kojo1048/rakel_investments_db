// lib/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Replaces ALL imports from '@prisma/client'.
// Find-replace across codebase: from '@prisma/client' → from '@/lib/types'
// ─────────────────────────────────────────────────────────────────────────────

// ── Enum types ────────────────────────────────────────────────────────────────
export type UserRole       = 'SUPER_ADMIN' | 'RAKEL_ADMIN' | 'CEO' | 'COMPANY_ADMIN' | 'STAFF';
export type UserStatus     = 'ACTIVE' | 'PENDING' | 'DECLINED' | 'INACTIVE';
export type FileType       = 'PDF' | 'DOC' | 'DOCX' | 'XLSX' | 'CSV';
export type ContractStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
export type InvoiceStatus  = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type ReminderInterval = '1_MONTH' | '2_WEEKS' | '1_WEEK' | '2_DAYS' | '3_HOURS';

export const REMINDER_INTERVAL_LABELS: Record<ReminderInterval, string> = {
  '1_MONTH': '1 month before',
  '2_WEEKS': '2 weeks before',
  '1_WEEK':  '1 week before',
  '2_DAYS':  '2 days before',
  '3_HOURS': '3 hours before',
};

export type AuditAction =
  | 'LOGIN' | 'LOGOUT'
  | 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_APPROVE' | 'USER_DECLINE'
  | 'COMPANY_CREATE' | 'COMPANY_UPDATE'
  | 'DOCUMENT_UPLOAD' | 'DOCUMENT_DELETE'
  | 'DATA_IMPORT' | 'SETTINGS_UPDATE' | 'ANALYTICS_EXPORT'
  | 'REGISTRATION_SUBMIT' | 'OPERATIONS_ENTRY'
  | 'CONTRACT_CREATE' | 'CONTRACT_UPDATE'
  | 'INVOICE_CREATE' | 'INVOICE_UPDATE'
  | 'DOCUMENT_EXPIRY_REMINDER';

// ── Model interfaces ──────────────────────────────────────────────────────────
// These replace Prisma's generated model types.
// Dates are strings (ISO) since Supabase returns JSON — convert with new Date() where needed.

export interface Service {
  id:          string;
  name:        string;
  slug:        string;
  icon:        string;
  description: string | null;
  isActive:    boolean;
}

export interface CompanyService {
  assignedAt: string;
  service:    Pick<Service, 'id' | 'name' | 'slug' | 'icon' | 'description'>;
}

export interface Company {
  id:             string;
  name:           string;
  slug:           string;
  description:    string | null;
  isActive:       boolean;
  colorPrimary:   string;
  colorSecondary: string;
  createdAt:      string;
  updatedAt:      string;
  services?:      CompanyService[];
}

export interface User {
  id:           string;
  username:     string;
  email:        string | null;
  role:         UserRole;
  status:       UserStatus;
  fullName:     string | null;
  companyId:    string | null;
  staffModules: unknown | null;
  createdAt:    string;
  updatedAt:    string;
  company?:     Pick<Company, 'id' | 'name' | 'slug'> | null;
}

export interface Contract {
  id:             string;
  companyId:      string;
  title:          string;
  contractNumber: string | null;
  client:         string | null;
  status:         ContractStatus;
  startDate:      string | null;
  expiryDate:     string | null;
  description:    string | null;
  isArchived:     boolean;
  createdBy:      string;
  createdAt:      string;
  updatedAt:      string;
  company?:       Pick<Company, 'name'> | null;
  creator?:       Pick<User, 'username' | 'fullName'> | null;
}

export interface Invoice {
  id:            string;
  companyId:     string;
  contractId:    string | null;
  invoiceNumber: string;
  client:        string;
  amount:        number;
  currency:      string;
  status:        InvoiceStatus;
  issueDate:     string;
  dueDate:       string | null;
  paidDate:      string | null;
  notes:         string | null;
  isArchived:    boolean;
  createdBy:     string;
  createdAt:     string;
  updatedAt:     string;
  company?:      Pick<Company, 'name'> | null;
  contract?:     Pick<Contract, 'title' | 'contractNumber'> | null;
  creator?:      Pick<User, 'username'> | null;
}

export interface Document {
  id:               string;
  title:            string;
  filename:         string;
  fileType:         FileType;
  fileSize:         number;
  storageKey:       string | null;
  category:         string;
  description:      string | null;
  companyId:        string | null;
  serviceId:        string | null;
  contractId:       string | null;
  uploadedBy:       string;
  isArchived:       boolean;
  uploadedAt:       string;
  dateReceived:     string | null;
  expiryDate:       string | null;
  reminderSettings: ReminderInterval[] | null;
  reminderSent:     Partial<Record<ReminderInterval, string>> | null;
  company?:         Pick<Company, 'id' | 'name'> | null;
  service?:         Pick<Service, 'id' | 'name' | 'slug'> | null;
  uploader?:        Pick<User, 'id' | 'username' | 'fullName'> | null;
}

export interface AnalyticsRecord {
  id:          string;
  companyId:   string;
  serviceId:   string;
  date:        string;
  revenue:     number;
  orders:      number;
  deliveries:  number;
  performance: number;
}

export interface AuditLog {
  id:           string;
  userId:       string;
  username:     string;
  action:       AuditAction;
  details:      string | null;
  targetEntity: string | null;
  ipAddress:    string | null;
  companyId:    string | null;
  createdAt:    string;
  company?:     Pick<Company, 'name'> | null;
}

export interface PendingRegistration {
  id:            string;
  username:      string;
  email:         string;
  fullName:      string;
  requestedRole: UserRole;
  companyId:     string | null;
  reason:        string | null;
  staffModules:  unknown | null;
  createdAt:     string;
  company?:      Pick<Company, 'id' | 'name' | 'slug'> | null;
}

export interface UserSession {
  id:        string;
  userId:    string;
  tokenHash: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface OperationsRecord {
  id:                   string;
  companyId:            string;
  contractId:           string | null;
  date:                 string;
  department:           string;
  manpowerCount:        number;
  equipmentTotal:       number;
  equipmentOperational: number;
  activityType:         string;
  activityDescription:  string | null;
  performanceScore:     number;
  notes:                string | null;
  isArchived:           boolean;
  recordedBy:           string;
  createdAt:            string;
  updatedAt:            string;
}

export interface SystemSetting {
  id:        string;
  key:       string;
  value:     string;
  companyId: string | null;
  updatedAt: string;
  updatedBy: string | null;
}
