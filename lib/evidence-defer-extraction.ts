/** Form field `defer_extraction` from intake UI — when set, file is stored but extraction is deferred. */
export function deferExtractionFromFormData(formData: FormData): boolean {
  const v = formData.get("defer_extraction");
  return v === "true" || v === "1" || v === "on";
}

export function deferExtractionFromJsonBody(body: Record<string, unknown>): boolean {
  return body.defer_extraction === true || body.defer_extraction === "true";
}
