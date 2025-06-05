const CAPTCHA_PATTERNS = {
  GUARD_CHECK: [
    "we have to check you are actually playing",
    "**epic guard**: stop there",
    "suspicious activity",
    "please verify you're human",
    "are you a real person",
    "**epic guard**: wait a minute",
    "**epic guard**: hold on",
    "bot-like behavior",
    "automated actions detected",
    "you're doing things too quickly"
  ],
  GUARD_CLEAR: [
    "**epic guard**: everything seems fine",
    "**epic guard**: fine, i will let you go",
    "verification successful",
    "you may continue",
    "thanks for verifying",
    "you're good to go",
    "**epic guard**: you can continue"
  ]
};

class CaptchaDetector {
  constructor() {
    this.consecutiveFailures = 0;
    this.lastCaptchaTime = null;
    this.captchaHistory = [];
    this.patternMatches = new Map(); // Track which patterns are triggering most often
  }

  isCaptchaMessage(content) {
    const normalizedContent = content.toLowerCase();
    
    // Check each pattern and track which ones match
    const matches = CAPTCHA_PATTERNS.GUARD_CHECK.filter(pattern => {
      const matches = normalizedContent.includes(pattern.toLowerCase());
      if (matches) {
        const count = this.patternMatches.get(pattern) || 0;
        this.patternMatches.set(pattern, count + 1);
      }
      return matches;
    });

    return matches.length > 0;
  }

  isCaptchaClearMessage(content) {
    return CAPTCHA_PATTERNS.GUARD_CLEAR.some(pattern =>
      content.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  recordCaptcha() {
    const now = Date.now();
    this.captchaHistory.push({
      timestamp: now,
      patterns: Array.from(this.patternMatches.entries())
        .filter(([_, count]) => count > 0)
        .map(([pattern]) => pattern)
    });
    
    this.lastCaptchaTime = now;
    this.consecutiveFailures++;
    
    // Clean up old history (older than 24h)
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    this.captchaHistory = this.captchaHistory.filter(entry => entry.timestamp > oneDayAgo);
  }

  getCaptchaFrequency() {
    return this.captchaHistory.length;
  }

  getTimeSinceLastCaptcha() {
    if (!this.lastCaptchaTime) return null;
    return Date.now() - this.lastCaptchaTime;
  }

  getMostTriggeredPatterns() {
    return Array.from(this.patternMatches.entries())
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3); // Get top 3 most triggered patterns
  }

  shouldReduceActivity() {
    const frequency = this.getCaptchaFrequency();
    const timeSinceLastCaptcha = this.getTimeSinceLastCaptcha();
    
    // Reduce activity if:
    // 1. 3 or more consecutive failures
    // 2. 5 or more captchas in 24h
    // 3. Less than 30 minutes since last captcha and already had 2+ captchas
    return this.consecutiveFailures >= 3 || 
           frequency >= 5 ||
           (timeSinceLastCaptcha && timeSinceLastCaptcha < 30 * 60 * 1000 && frequency >= 2);
  }

  reset() {
    this.consecutiveFailures = 0;
    this.patternMatches.clear();
  }

  getDetectionStats() {
    return {
      totalCaptchas: this.captchaHistory.length,
      consecutiveFailures: this.consecutiveFailures,
      lastCaptchaTime: this.lastCaptchaTime,
      mostTriggeredPatterns: this.getMostTriggeredPatterns(),
      shouldReduceActivity: this.shouldReduceActivity()
    };
  }
}

module.exports = CaptchaDetector; 