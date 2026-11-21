// The arcade engine: lifetime XP, levels, achievements, daily quests,
// GameStat records, the rubber-band rival and the streak forge. Every hook
// the app already had (review grades, exam grades, essays, monologues, chat
// turns, placement) now flows through here, so one currency and one ladder
// connect all surfaces. Deterministic everywhere: no cron, no background jobs.
//
// The implementations live in sibling modules under arcade/ (topic files);
// this entry is the public surface - it re-exports every name this module
// exported before, so importers keep their exact import paths. rewards.ts
// holds momentum + XP + quests together because their call graph is a cycle.

export {
  HEAT_TIERS,
  heatOf,
  getChain,
  registerHit,
  registerMiss,
  type XpResult,
  awardXp,
  GAME_XP_CAPS,
  gameXpEarnedToday,
  type GameXpResult,
  awardGameXp,
  QUEST_TEMPLATES,
  ensureQuests,
  progressQuest,
} from "./arcade/rewards";
export {
  type PerkDef,
  PERKS,
  hasPerk,
  learnerPerks,
  type PerksView,
  getPerksView,
  buyPerk,
} from "./arcade/talents";
export {
  xpToReach,
  levelFromXp,
  levelName,
  type LevelView,
  levelView,
} from "./arcade/levels";
export {
  type AchievementDef,
  ACHIEVEMENTS,
  evaluateAchievements,
} from "./arcade/achievements";
export {
  DIVISIONS,
  type LeagueStanding,
  type LeagueView,
  getLeagueView,
} from "./arcade/league";
export { bumpStat } from "./arcade/gamestat";
export { type RivalView, getRivalView } from "./arcade/rival";
export { type GameView, getGameView } from "./arcade/view";
