export interface DeviceInfo {
  browser: string;
  os: string;
  cores: number | null;
  deviceMemoryGb: number | null;
  webgpu: boolean;
  userAgent: string;
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Chromium/.test(ua)) return "Chromium";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  return "Unknown browser";
}

function detectOs(ua: string): string {
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/(iPhone|iPad|iPod)/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown OS";
}

/** Returns true only if a real WebGPU adapter can be acquired. */
export async function detectWebGpu(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } })
      .gpu;
    const adapter = await gpu?.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const ua = navigator.userAgent;
  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    cores: navigator.hardwareConcurrency ?? null,
    deviceMemoryGb:
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    webgpu: await detectWebGpu(),
    userAgent: ua,
  };
}
