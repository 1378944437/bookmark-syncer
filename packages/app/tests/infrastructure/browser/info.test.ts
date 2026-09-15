import { describe, expect, it } from 'vitest'
import { isMobileBrowser } from '../../../src/infrastructure/browser/info'

describe('mobile page versus desktop popup sizing', () => {
  it.each([
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14) Chrome/153.0 Mobile', 5, true],
    ['Android Firefox', 'Mozilla/5.0 (Android 14; Mobile; rv:143.0) Firefox/143.0', 5, true],
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, true],
    ['iPad desktop agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5, true],
    ['desktop Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 0, false],
    ['Windows touch laptop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 10, false],
    ['desktop Linux', 'Mozilla/5.0 (X11; Linux x86_64)', 0, false],
  ])('%s uses the appropriate sizing mode', (_, userAgent, maxTouchPoints, expected) => {
    expect(isMobileBrowser({ userAgent, maxTouchPoints })).toBe(expected)
  })

  it('accepts mobile client hints even with a reduced user agent', () => {
    expect(isMobileBrowser({ userAgent: 'Browser', maxTouchPoints: 1, userAgentData: { mobile: true } })).toBe(true)
  })
})
