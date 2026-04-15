/** Investigator identity persisted on `public.profiles` + Wall card shape. */

export type InvestigatorWallCard = {
  id: string;
  investigator_alias: string | null;
  investigator_avatar_url: string | null;
  investigator_tagline: string | null;
};

export type InvestigatorIdentityProfile = InvestigatorWallCard & {
  investigator_opt_in: boolean;
};
