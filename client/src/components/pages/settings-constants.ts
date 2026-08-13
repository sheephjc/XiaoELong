import { type PetDisplayMode } from "../../utils/pet-animation";

export const PET_DISPLAY_MODE_LABELS: Record<PetDisplayMode, string> = {
  dynamic: "当前：动态",
  static: "当前：静态",
  image: "当前：仅形象"
};

export const PET_DISPLAY_MODE_SHORT: Record<PetDisplayMode, string> = {
  dynamic: "动态",
  static: "静态",
  image: "仅形象"
};

export const PET_DISPLAY_MODE_ORDER: PetDisplayMode[] = [
  "dynamic",
  "static",
  "image"
];
