export function shouldSignOutAfterPermissionUpdate(
  updatedRoleId: string | null | undefined,
  currentRoleId: string | null | undefined
): boolean {
  return Boolean(updatedRoleId && currentRoleId && updatedRoleId === currentRoleId);
}