/**
 * Heuristic cluster linkage thresholds (overlap scoring, not LLM).
 * Kept in lib/ so UI and services can share without importing server services.
 */
export const CLUSTER_AUTO_LINK_SCORE_THRESHOLD = 0.68;
export const CLUSTER_RECOMMEND_SCORE_THRESHOLD = 0.42;
export const CLUSTER_MENTION_SCORE_THRESHOLD = 0.18;
export const CLUSTER_AUTO_LINK_MIN_SIGNALS = 2;
