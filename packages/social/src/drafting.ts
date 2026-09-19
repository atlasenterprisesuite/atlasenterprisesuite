export type EngagementDraftInput = {
  topic: string;
  niche: string;
  audience: string;
  tone: string;
};

export type FollowerWelcomeMessages = {
  casual: string;
  valueFirst: string;
  questionLed: string;
};

function normalized(input: EngagementDraftInput) {
  return {
    topic: input.topic.trim(),
    niche: input.niche.trim(),
    audience: input.audience.trim(),
    tone: input.tone.trim() || 'natural'
  };
}

export function buildConversationQuestions(input: EngagementDraftInput): string[] {
  const value = normalized(input);
  if (!value.topic || !value.niche || !value.audience) return [];
  return [
    `What part of ${value.topic} creates the biggest challenge for ${value.audience} in ${value.niche}?`,
    `Which result would make ${value.topic} most valuable to ${value.audience}?`,
    `How are ${value.audience} handling ${value.topic} today inside ${value.niche}?`,
    `Where do you see the biggest opportunity to improve ${value.topic} for ${value.audience}?`,
    `Tell me what you would change first about ${value.topic} if you were optimizing it for ${value.niche}.`
  ];
}

export function buildFollowerWelcomeMessages(input: EngagementDraftInput): FollowerWelcomeMessages {
  const value = normalized(input);
  if (!value.topic || !value.niche || !value.audience) {
    return { casual: '', valueFirst: '', questionLed: '' };
  }
  return {
    casual: `Glad you’re here. I share ${value.tone} ideas about ${value.topic} for ${value.audience} in ${value.niche}.`,
    valueFirst: `Welcome. My goal here is to make ${value.topic} more useful for ${value.audience} in ${value.niche} with practical takeaways you can apply.`,
    questionLed: `Thanks for following. What would be most useful for you to improve right now around ${value.topic} in ${value.niche}?`
  };
}
