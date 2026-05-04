/**
 * Rakel Investments staff detection.
 *
 * A user is a "Rakel staff" (extended-mode staff) when they are a STAFF
 * member whose company is Rakel Investments. They may upload data on behalf
 * of any company in the system but have no admin privileges.
 */

interface PartialUser {
  role?: string;
  companyName?: string | null;
}

/** True when the user is a STAFF member assigned to Rakel Investments. */
export function isRakelInvestmentsStaff(user: PartialUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === 'STAFF' &&
    !!user.companyName?.toLowerCase().includes('rakel')
  );
}

/**
 * True when the user should see the "Select Company" dropdown in upload forms.
 * Covers Super Admin, Rakel Admin, and Rakel Investments staff.
 */
export function canSelectAnyCompany(user: PartialUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === 'SUPER_ADMIN' ||
    user.role === 'RAKEL_ADMIN' ||
    isRakelInvestmentsStaff(user)
  );
}
