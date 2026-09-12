import { describe, expect, it } from 'vitest';
import { buildConversationQuestions, buildFollowerWelcomeMessages } from '../../packages/social/src/drafting';

describe('social engagement drafting', () => {
  const input = { topic: 'AI for payroll', niche: 'small business', audience: 'operators', tone: 'professional' };

  it('creates open-ended conversation prompts', () => {
    const prompts = buildConversationQuestions(input);
    expect(prompts).toHaveLength(5);
    expect(prompts.every((prompt) => !/^do |^is |^are |^can /i.test(prompt))).toBe(true);
  });

  it('creates three differentiated follower welcomes', () => {
    expect(buildFollowerWelcomeMessages(input)).toEqual(expect.objectContaining({
      casual: expect.any(String),
      valueFirst: expect.any(String),
      questionLed: expect.any(String)
    }));
  });
});
