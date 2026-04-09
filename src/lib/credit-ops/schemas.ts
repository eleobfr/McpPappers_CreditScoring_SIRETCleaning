import { z } from "zod";

import { RECOMMENDED_ACTIONS } from "@/lib/credit-ops/types";

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim().replace(/\s+/g, " ");
      return trimmed.length ? trimmed : undefined;
    },
    z.string().max(maxLength).optional(),
  );

const optionalIdentifier = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const digits = value.replace(/\D/g, "");
    return digits.length ? digits : undefined;
  },
  z
    .string()
    .regex(/^(?:\d{9}|\d{14})$/, "Saisissez un SIREN ou un SIRET valide.")
    .optional(),
);

const requiredAmount = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      return Number.parseFloat(
        value.replace(/\s+/g, "").replace(",", "."),
      );
    }

    return Number.NaN;
  },
  z.number().finite().positive("Le montant demandé doit être supérieur à 0."),
);

const requestedPaymentTermDays = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return 45;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      return Number.parseInt(value, 10);
    }

    return Number.NaN;
  },
  z
    .number()
    .int("Le délai doit être un nombre entier.")
    .min(0)
    .max(120),
);

export const verificationInputSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "La raison sociale est obligatoire.")
    .max(120),
  sirenOrSiret: optionalIdentifier,
  address: optionalText(120),
  postalCode: optionalText(10),
  city: optionalText(80),
  requestedAmount: requiredAmount,
  requestedPaymentTermDays,
  commercialEntity: optionalText(120),
  internalNotes: optionalText(1000),
});

export const manualOverrideSchema = z.object({
  action: z.enum(RECOMMENDED_ACTIONS),
  reason: z
    .string()
    .trim()
    .min(5, "Le motif d'override doit être explicite.")
    .max(500),
});

export function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
