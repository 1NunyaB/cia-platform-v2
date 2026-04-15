/** Internal folder / DB names — must match `image_categories.name` and storage segment under `images/`. */
export const IMAGE_CATEGORY_NAMES = ["location", "furnishings", "misc", "transport", "people"] as const;
export type ImageCategoryName = (typeof IMAGE_CATEGORY_NAMES)[number];

export function isImageCategoryName(s: string): s is ImageCategoryName {
  return (IMAGE_CATEGORY_NAMES as readonly string[]).includes(s);
}

/** Normalize form/query value; returns null if empty or invalid. */
export function parseImageCategoryParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  return isImageCategoryName(n) ? n : null;
}

/** FormData `image_category` field — null if absent/empty; throws if present but invalid. */
export function parseImageCategoryFromForm(formData: FormData): string | null {
  const raw = formData.get("image_category");
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("Invalid image_category");
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  if (!isImageCategoryName(n)) throw new Error("Invalid image_category");
  return n;
}
