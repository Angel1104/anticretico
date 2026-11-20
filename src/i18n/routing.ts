import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es-BO", "en"],
  defaultLocale: "es-BO",
  localePrefix: "as-needed",
});
