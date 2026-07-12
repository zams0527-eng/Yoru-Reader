/**
 * Free Spaced Repetition Scheduler (FSRS) Version 6
 * Standalone, dependency-free TypeScript implementation.
 */

export enum State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum Rating {
  Manual = 0,
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface FSRSCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: Date;
}

export interface FSRSParameters {
  request_retention: number;
  maximum_interval: number;
  w: number[];
  enable_fuzz: boolean;
}

// Default FSRS 6 weights
export const FSRS6_DEFAULT_W = [
  0.212,    // w0 (Again initial stability)
  1.2931,   // w1 (Hard initial stability)
  2.3065,   // w2 (Good initial stability)
  8.2956,   // w3 (Easy initial stability)
  6.4133,   // w4 (Hard initial difficulty)
  0.8334,   // w5 (Good initial difficulty)
  3.0194,   // w6 (Easy initial difficulty)
  0.001,    // w7
  1.8722,   // w8
  0.1666,   // w9
  0.796,    // w10
  1.4835,   // w11
  0.0614,   // w12
  0.2629,   // w13
  1.6483,   // w14
  0.6014,   // w15 (Hard penalty)
  1.8729,   // w16 (Easy bound)
  0.5425,   // w17
  0.0912,   // w18
  0.0658,   // w19
  0.1542,   // w20 (Decay parameter)
];

const S_MIN = 0.001;
const S_MAX = 36500;

export class FSRS6 {
  private params: FSRSParameters;
  private intervalModifier: number;

  constructor(customParams?: Partial<FSRSParameters>) {
    this.params = {
      request_retention: customParams?.request_retention ?? 0.90,
      maximum_interval: customParams?.maximum_interval ?? 36500,
      w: customParams?.w ?? [...FSRS6_DEFAULT_W],
      enable_fuzz: customParams?.enable_fuzz ?? true,
    };
    this.intervalModifier = this.calculateIntervalModifier(this.params.request_retention);
  }

  private getDecayAndFactor(): { decay: number; factor: number } {
    const w = this.params.w;
    const decay = -w[20];
    const factor = Math.exp(Math.log(0.9) / decay) - 1; // 0.9^(1/decay) - 1
    return { decay, factor };
  }

  private calculateIntervalModifier(retention: number): number {
    const { decay, factor } = this.getDecayAndFactor();
    return (Math.pow(retention, 1 / decay) - 1) / factor;
  }

  public getRetrievability(card: FSRSCard, now: Date): number {
    if (card.state === State.New) return 0;
    const elapsed = this.getElapsedDays(card, now);
    const { decay, factor } = this.getDecayAndFactor();
    return Math.pow(1 + factor * elapsed / card.stability, decay);
  }

  private getElapsedDays(card: FSRSCard, now: Date): number {
    if (!card.last_review) return 0;
    const diffTime = now.getTime() - new Date(card.last_review).getTime();
    return Math.max(0, diffTime / (1000 * 60 * 60 * 24));
  }

  private initStability(g: Rating): number {
    return Math.max(this.params.w[g - 1], 0.1);
  }

  private initDifficulty(g: Rating): number {
    const w = this.params.w;
    const d = w[4] - Math.exp((g - 1) * w[5]) + 1;
    return Math.min(Math.max(d, 1), 10);
  }

  private nextDifficulty(d: number, g: Rating): number {
    const w = this.params.w;
    const delta_d = -w[6] * (g - 3);
    const linear_damping = delta_d * (10 - d) / 9;
    const next_d = d + linear_damping;
    const init_d = this.initDifficulty(Rating.Good);
    const reverted_d = w[7] * init_d + (1 - w[7]) * next_d;
    return Math.min(Math.max(reverted_d, 1), 10);
  }

  private nextRecallStability(d: number, s: number, r: number, g: Rating): number {
    const w = this.params.w;
    const hard_penalty = g === Rating.Hard ? w[15] : 1;
    const easy_bound = g === Rating.Easy ? w[16] : 1;
    const new_s = s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard_penalty * easy_bound);
    return Math.min(Math.max(new_s, S_MIN), S_MAX);
  }

  private nextForgetStability(d: number, s: number, r: number): number {
    const w = this.params.w;
    const new_s = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
    return Math.min(Math.max(new_s, S_MIN), S_MAX);
  }

  private nextShortTermStability(s: number, g: Rating): number {
    const w = this.params.w;
    const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
    const maskedSinc = g >= Rating.Hard ? Math.max(sinc, 1) : sinc;
    return Math.min(Math.max(s * maskedSinc, S_MIN), S_MAX);
  }

  private applyFuzz(interval: number): number {
    if (!this.params.enable_fuzz || interval < 2.5) {
      return Math.max(1, Math.round(interval));
    }
    // simple uniform distribution ±10% fuzz
    const min_ivl = Math.max(2, Math.round(interval * 0.9));
    const max_ivl = Math.round(interval * 1.1);
    const fuzzed = Math.floor(Math.random() * (max_ivl - min_ivl + 1) + min_ivl);
    return Math.min(Math.max(fuzzed, 1), this.params.maximum_interval);
  }

  private calculateInterval(stability: number): number {
    const interval = stability * this.intervalModifier;
    return Math.min(Math.max(1, Math.round(interval)), this.params.maximum_interval);
  }

  public createEmptyCard(now: Date = new Date()): FSRSCard {
    return {
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
    };
  }

  public repeat(card: FSRSCard, now: Date = new Date()): Record<Rating, FSRSCard> {
    const elapsed = this.getElapsedDays(card, now);
    const r = this.getRetrievability(card, now);

    const nextStateForRating = (g: Rating): State => {
      if (card.state === State.New) {
        return g === Rating.Again ? State.Learning : State.Review;
      }
      if (card.state === State.Learning || card.state === State.Relearning) {
        return g === Rating.Again ? card.state : State.Review;
      }
      return g === Rating.Again ? State.Relearning : State.Review;
    };

    const calculateNewState = (g: Rating): { stability: number; difficulty: number; state: State; scheduled_days: number; due: Date } => {
      const nextState = nextStateForRating(g);
      let newStability = 0;
      let newDifficulty = 0;

      if (card.state === State.New) {
        newStability = this.initStability(g);
        newDifficulty = this.initDifficulty(g);
      } else {
        newDifficulty = this.nextDifficulty(card.difficulty, g);
        if (g === Rating.Again) {
          newStability = this.nextForgetStability(card.difficulty, card.stability, r);
        } else {
          newStability = this.nextRecallStability(card.difficulty, card.stability, r, g);
        }
      }

      let scheduled_days = 0;
      let due = new Date(now);

      if (nextState === State.Learning || nextState === State.Relearning) {
        // short term steps: Again is 10 minutes, Hard is 12 hours (0.5 days), Good is 1 day, Easy is 4 days
        if (g === Rating.Again) {
          due = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
          scheduled_days = 0;
        } else if (g === Rating.Hard) {
          due = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours
          scheduled_days = 0;
        } else {
          scheduled_days = this.applyFuzz(this.calculateInterval(newStability));
          due.setDate(due.getDate() + scheduled_days);
        }
      } else {
        // Review state
        scheduled_days = this.applyFuzz(this.calculateInterval(newStability));
        due.setDate(due.getDate() + scheduled_days);
      }

      return {
        stability: newStability,
        difficulty: newDifficulty,
        state: nextState,
        scheduled_days,
        due,
      };
    };

    const updateCard = (g: Rating): FSRSCard => {
      const { stability, difficulty, state, scheduled_days, due } = calculateNewState(g);
      return {
        due,
        stability,
        difficulty,
        elapsed_days: elapsed,
        scheduled_days,
        reps: card.reps + 1,
        lapses: g === Rating.Again ? card.lapses + 1 : card.lapses,
        state,
        last_review: now,
      };
    };

    return {
      [Rating.Manual]: { ...card },
      [Rating.Again]: updateCard(Rating.Again),
      [Rating.Hard]: updateCard(Rating.Hard),
      [Rating.Good]: updateCard(Rating.Good),
      [Rating.Easy]: updateCard(Rating.Easy),
    };
  }
}
