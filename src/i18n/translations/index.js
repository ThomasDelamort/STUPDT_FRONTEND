import { accessibilityCatalog } from "./catalog/accessibility.js";
import { assuranceCatalog } from "./catalog/assurance.js";
import { bureaucracyCatalog } from "./catalog/bureaucracy.js";
import { departmentsCatalog } from "./catalog/departments.js";
import { featuresCatalog } from "./catalog/features.js";
import { officeCatalog } from "./catalog/office.js";
import { uiCatalog } from "./catalog/ui.js";
import { visionCatalog } from "./catalog/vision.js";

const catalogs = [
  accessibilityCatalog,
  assuranceCatalog,
  bureaucracyCatalog,
  departmentsCatalog,
  featuresCatalog,
  officeCatalog,
  uiCatalog,
  visionCatalog,
];

// Authors keep each English key and its translations together. Runtime lookups
// are indexed by language, with absent entries handled by translate().
export const DICTIONARIES = Object.create(null);

for (const catalog of catalogs) {
  for (const [text, translations] of Object.entries(catalog)) {
    for (const [language, translation] of Object.entries(translations)) {
      const dictionary = (DICTIONARIES[language] ??= Object.create(null));
      dictionary[text] = translation;
    }
  }
}
