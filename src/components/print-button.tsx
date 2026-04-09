"use client";

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <button className="button button-secondary" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
