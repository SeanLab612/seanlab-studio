const parseJsonContent = (content) => {
  let value = content.trim();
  if (value.startsWith("```"))
    value = value
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  return JSON.parse(value);
};

export const createMimoJsonAdapter = ({
  config,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
}) => ({
  async completeJson({ system, user }) {
    const keyName = config.apiKeyEnv ?? "MIMO_API_KEY";
    const apiKey = process.env[keyName];
    if (!apiKey) throw new Error(`Missing ${keyName}; load it from the shell environment`);
    const attempts = (config.maxRetries ?? 2) + 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), (config.timeoutSeconds ?? 90) * 1000);
      try {
        const response = await fetchImpl(
          `${(config.baseUrl ?? "https://token-plan-cn.xiaomimimo.com/v1").replace(/\/$/, "")}/chat/completions`,
          {
            method: "POST",
            signal: controller.signal,
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: config.model ?? "mimo-v2.5",
              temperature: 0,
              messages: [
                { role: "system", content: system },
                { role: "user", content: user },
              ],
            }),
          },
        );
        if (!response.ok) throw new Error(`MiMo HTTP ${response.status}`);
        const payload = await response.json();
        return parseJsonContent(payload.choices[0].message.content);
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts) await sleep(Math.min(2 ** attempt * 500, 2000));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(`MiMo semantic planning failed after ${attempts} attempts: ${lastError?.name ?? "Error"}`);
  },
});

export const groupCaptionSegments = (captions, { minimumSegmentSeconds = 7, maximumSegmentSeconds = 14 } = {}) => {
  const segments = [];
  let current = [];
  for (const cue of captions) {
    current.push(cue);
    const duration = cue.end - current[0].start;
    const sentenceEnd = /[。！？!?]$/.test(cue.zh);
    if (duration >= maximumSegmentSeconds || (duration >= minimumSegmentSeconds && sentenceEnd)) {
      segments.push({
        id: `segment-${segments.length + 1}`,
        start: current[0].start,
        end: cue.end,
        text: current.map((item) => item.zh).join(""),
      });
      current = [];
    }
  }
  if (current.length) {
    const tail = {
      id: `segment-${segments.length + 1}`,
      start: current[0].start,
      end: current.at(-1).end,
      text: current.map((item) => item.zh).join(""),
    };
    if (segments.length && tail.end - tail.start < minimumSegmentSeconds / 2) {
      const previous = segments.at(-1);
      previous.end = tail.end;
      previous.text += tail.text;
    } else segments.push(tail);
  }
  return segments;
};
