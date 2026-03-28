/**
 * Bridge to InstaWebView native plugin.
 * Wraps Capacitor plugin calls for type safety.
 */

function getPlugin(): any {
  if ((window as any).Capacitor?.Plugins?.InstaWebView) {
    return (window as any).Capacitor.Plugins.InstaWebView;
  }
  // Mock for browser dev
  console.warn('[ECHA] InstaWebView plugin not available (browser mode)');
  return {
    openInstagram: async () => ({ status: 'mock' }),
    closeInstagram: async () => ({ status: 'mock' }),
    showInstagram: async () => ({ status: 'mock' }),
    hideInstagram: async () => ({ status: 'mock' }),
    isInstagramOpen: async () => ({ open: false, visible: false }),
    exportSession: async () => ({ path: '', data: '{}' }),
    getCollectedData: async () => ({ count: 0, data: '[]' }),
    addListener: async () => ({ remove: async () => {} }),
    removeAllListeners: async () => {},
  };
}

export async function openInstagram(): Promise<{ status: string }> {
  return getPlugin().openInstagram();
}

export async function closeInstagram(): Promise<{ status: string }> {
  return getPlugin().closeInstagram();
}

export async function showInstagram(): Promise<{ status: string }> {
  return getPlugin().showInstagram();
}

export async function hideInstagram(): Promise<{ status: string }> {
  return getPlugin().hideInstagram();
}

export async function isInstagramOpen(): Promise<{ open: boolean; visible: boolean }> {
  return getPlugin().isInstagramOpen();
}

export async function exportSession(): Promise<{ path: string; data: string }> {
  const result = await getPlugin().exportSession();
  return {
    path: result.path,
    data: typeof result.data === 'string' ? JSON.parse(result.data) : result.data,
  };
}

export async function onTrackerData(callback: (data: any) => void): Promise<{ remove: () => Promise<void> }> {
  return getPlugin().addListener('trackerData', callback);
}
