import type { User } from "@supabase/supabase-js";

export const PLATFORM_DELETE_ADMIN_EMAIL = "kesmall7712@gmail.com";
export const ADMIN_DELETE_CONFIRM_CODE = "0201";

export function isPlatformDeleteAdmin(user: Pick<User, "email"> | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  return email === PLATFORM_DELETE_ADMIN_EMAIL;
}

export function assertPlatformDeleteAdmin(user: Pick<User, "email"> | null | undefined): void {
  if (!isPlatformDeleteAdmin(user)) {
    throw new Error("Unauthorized: admin account required for delete actions.");
  }
}

export function assertPlatformAdmin(user: Pick<User, "email"> | null | undefined): void {
  if (!isPlatformDeleteAdmin(user)) {
    throw new Error("Unauthorized: admin account required.");
  }
}

