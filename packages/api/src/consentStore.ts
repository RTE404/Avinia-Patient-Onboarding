const consented = new Set<string>();

export function grantConsent(patientId: string): void {
  consented.add(patientId);
}

export function hasConsent(patientId: string): boolean {
  return consented.has(patientId);
}

export function resetConsentForTests(): void {
  consented.clear();
}
