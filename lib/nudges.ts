/**
 * The whole vocabulary of encouragement.
 *
 * A fixed list rather than free text: a nudge cannot become a channel for
 * anything unkind, and nobody has to think of what to write. None of them
 * reference performance, so none can be read as a comment on how much someone
 * has or has not done.
 *
 * Lives here rather than in the route because a Next.js route file may only
 * export its handlers.
 */
export const NUDGE_KINDS: Record<string, string> = {
  thinking_of_you: "Thinking of you today",
  well_done: "Well done",
  keep_going: "Keep going",
  missed_you: "Good to see you back",
  proud: "Proud of you",
};

/** How many one member may send another in a day. */
export const MAX_NUDGES_PER_DAY = 3;
