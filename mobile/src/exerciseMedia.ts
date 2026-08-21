export const EXERCISE_MEDIA = {
  chairSquat: require("../assets/exercise-chair-squat-sequence-v1.png"),
  wallPushup: require("../assets/exercise-wall-pushup-sequence-v1.png"),
  supportedBalance: require("../assets/exercise-supported-balance-sequence-v1.png"),
  calfRaise: require("../assets/exercise-calf-raise-sequence-v1.png"),
  seatedRotation: require("../assets/exercise-seated-rotation-sequence-v1.png"),
  hipHinge: require("../assets/exercise-hip-hinge-sequence-v1.png"),
  supportedMarch: require("../assets/exercise-supported-march-sequence-v1.png"),
  wallSlide: require("../assets/exercise-wall-slide-sequence-v1.png"),
} as const;

export function exerciseMediaFor(name: string) {
  const value = name.toLowerCase();
  if (value.includes("wall push")) return EXERCISE_MEDIA.wallPushup;
  if (value.includes("balance")) return EXERCISE_MEDIA.supportedBalance;
  if (value.includes("calf") || value.includes("heel raise")) return EXERCISE_MEDIA.calfRaise;
  if (value.includes("rotation") || value.includes("twist")) return EXERCISE_MEDIA.seatedRotation;
  if (value.includes("hinge")) return EXERCISE_MEDIA.hipHinge;
  if (value.includes("march")) return EXERCISE_MEDIA.supportedMarch;
  if (value.includes("wall slide") || value.includes("shoulder")) return EXERCISE_MEDIA.wallSlide;
  return EXERCISE_MEDIA.chairSquat;
}
