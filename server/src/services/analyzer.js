import OpenAI from "openai";

const sectionPatterns = {
  "Contact details": /\b(email|@|phone|linkedin|github)\b/i,
  "Professional summary": /\b(summary|profile|objective)\b/i,
  "Work experience": /\b(experience|employment|professional experience)\b/i,
  Education: /\b(education|university|college|degree|bachelor|master)\b/i,
  Skills: /\b(skills|technologies|technical skills|tools)\b/i,
  Projects: /\b(projects|portfolio)\b/i
};

const stopWords = new Set(
  "about above after again against all also and any are because been before being between both but can could did does doing down during each few for from further had has have having here how into its itself just more most other our out over own same she should some such than that the their them then there these they this those through under until very was were what when where which while who will with would your you job role team work experience required need".split(
    " "
  )
);

function keywordsFrom(text) {
  const words = (text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) ?? []).map((word) => word.replace(/[.-]+$/g, ""));
  return [...new Set(words.filter((word) => !stopWords.has(word)))];
}

function localAnalysis(resumeText, jobDescription) {
  const sections = Object.entries(sectionPatterns).map(([name, pattern]) => ({
    name,
    present: pattern.test(resumeText)
  }));
  const resumeWords = keywordsFrom(resumeText);
  const jobWords = keywordsFrom(jobDescription);
  const matchedKeywords = jobWords.filter((word) => resumeWords.includes(word)).slice(0, 20);
  const missingKeywords = jobWords.filter((word) => !resumeWords.includes(word)).slice(0, 12);
  const sectionScore = sections.filter((section) => section.present).length;
  const keywordScore = jobWords.length ? Math.round((matchedKeywords.length / Math.min(jobWords.length, 20)) * 100) : 65;
  const lengthScore = Math.min(100, Math.round((resumeText.trim().split(/\s+/).length / 450) * 100));
  const score = Math.max(
    10,
    Math.min(98, Math.round(sectionScore * 7 + keywordScore * 0.35 + lengthScore * 0.23))
  );
  const suggestions = [];

  if (!sections.find((section) => section.name === "Professional summary").present) {
    suggestions.push("Add a short professional summary tailored to the role you want.");
  }
  if (!sections.find((section) => section.name === "Work experience").present) {
    suggestions.push("Add a clearly labeled experience section with measurable outcomes.");
  }
  if (!sections.find((section) => section.name === "Skills").present) {
    suggestions.push("Create a skills section using relevant tools and technologies.");
  }
  if (resumeText.trim().split(/\s+/).length < 180) {
    suggestions.push("Add detail to your recent experience so recruiters can understand your impact.");
  }
  if (jobWords.length && missingKeywords.length) {
    suggestions.push(`Where accurate, reflect relevant job-description language such as ${missingKeywords.slice(0, 3).join(", ")}.`);
  }
  if (!suggestions.length) {
    suggestions.push("Use concise accomplishment bullets that pair strong action verbs with measurable results.");
  }

  return {
    score,
    summary: jobWords.length
      ? `Your resume currently matches ${matchedKeywords.length} of the most relevant job-description terms.`
      : "Add a job description for role-specific keyword matching. This score reflects resume structure and completeness.",
    sections,
    matchedKeywords,
    missingKeywords,
    strengths: [
      `${sectionScore} of ${sections.length} core resume sections were detected.`,
      `${resumeText.trim().split(/\s+/).length} words give recruiters useful context.`
    ],
    suggestions,
    source: "local"
  };
}

function parseAiResult(content) {
  const parsed = JSON.parse(content);
  const score = Number(parsed.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("The AI returned an invalid score. Please try again.");
  }
  return {
    score: Math.round(score),
    summary: String(parsed.summary ?? ""),
    sections: Array.isArray(parsed.sections)
      ? parsed.sections.slice(0, 10).map((section) => ({
          name: String(section?.name ?? "Section"),
          present: Boolean(section?.present)
        }))
      : [],
    matchedKeywords: Array.isArray(parsed.matchedKeywords)
      ? parsed.matchedKeywords.filter((item) => typeof item === "string").slice(0, 20)
      : [],
    missingKeywords: Array.isArray(parsed.missingKeywords)
      ? parsed.missingKeywords.filter((item) => typeof item === "string").slice(0, 20)
      : [],
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((item) => typeof item === "string").slice(0, 6)
      : [],
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((item) => typeof item === "string").slice(0, 8)
      : [],
    source: "openai"
  };
}

export async function analyzeResume(resumeText, jobDescription) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return localAnalysis(resumeText, jobDescription);

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a fair resume coach. Evaluate only job-related evidence; never infer protected traits. Do not invent qualifications. Give practical, kind feedback. Return JSON with score (0-100), summary, sections (array of {name,present}), matchedKeywords, missingKeywords, strengths, and suggestions."
      },
      {
        role: "user",
        content: `Review this resume against the job description. If no description is given, assess structure and completeness only.\n\nJOB DESCRIPTION:\n${jobDescription || "(not provided)"}\n\nRESUME:\n${resumeText}`
      }
    ]
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("The AI did not return an analysis. Please try again.");
  return parseAiResult(content);
}
