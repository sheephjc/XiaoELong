import type { DeityRank } from "@xiaoelong/shared";

export interface DeityRankVisuals {
  showEnergyWings: boolean;
  showParticles: boolean;
  useIdentityPlate: boolean;
}

const DEITY_RANK_VISUALS: Record<DeityRank, DeityRankVisuals> = {
  mortal: {
    showEnergyWings: false,
    showParticles: false,
    useIdentityPlate: false
  },
  demigod: {
    showEnergyWings: false,
    showParticles: false,
    useIdentityPlate: false
  },
  true_god: {
    showEnergyWings: false,
    showParticles: true,
    useIdentityPlate: true
  },
  main_god: {
    showEnergyWings: true,
    showParticles: true,
    useIdentityPlate: true
  },
  creator_god: {
    showEnergyWings: true,
    showParticles: true,
    useIdentityPlate: true
  }
};

export function getDeityRankVisuals(rank: DeityRank): DeityRankVisuals {
  return DEITY_RANK_VISUALS[rank];
}
