import { COLORS, FINISHES, MATERIALS, MODELS } from "@/constants";

export type TPhoneCaseOption = {
  color: (typeof COLORS)[number];
  model: (typeof MODELS.options)[number];
  material: (typeof MATERIALS.options)[number];
  finish: (typeof FINISHES.options)[number];
};
