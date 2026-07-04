let labelsCache: string[] | null = null;

/** Loads the 1000 ImageNet class labels (cached after first fetch). */
export async function loadLabels(): Promise<string[]> {
  if (labelsCache) return labelsCache;
  const response = await fetch("/models/imagenet-labels.json");
  if (!response.ok) {
    throw new Error("Failed to load ImageNet labels.");
  }
  labelsCache = (await response.json()) as string[];
  return labelsCache;
}
