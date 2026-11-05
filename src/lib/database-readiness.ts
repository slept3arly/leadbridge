export async function isDatabaseReady(checkConnection: () => Promise<unknown>): Promise<boolean> {
  try {
    await checkConnection();
    return true;
  } catch {
    return false;
  }
}
