const sectionPatterns = {
  "Contact details": /\b(email|@|phone|linkedin|github)\b/i,
  "Professional summary": /\b(summary|profile|objective)\b/i,
  "Work experience": /\b(experience|employment|professional experience)\b/i,
  Education: /\b(education|university|college|degree|bachelor|master)\b/i,
  Skills: /\b(skills|technologies|technical skills|tools)\b/i,
  Projects: /\b(projects|portfolio)\b/i
};
const ignored = new Set("about above after again against all also any are because been before being between both but can could did does doing down during each few for from further had has have having here how into its itself just more most other our out over own same she should some such than that the their them then there these they this those through under until very was were what when where which while who will with would your you job role team work experience required need".split(" "));
const terms = (text) => [...new Set((text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) || []).map((word) => word.replace(/[.-]+$/g, "")).filter((word) => !ignored.has(word)))];

export function localAnalyze(resumeText, jobDescription) {
  const sections = Object.entries(sectionPatterns).map(([name, pattern]) => ({ name, present: pattern.test(resumeText) }));
  const resumeTerms = terms(resumeText);
  const jobTerms = terms(jobDescription);
  const matchedKeywords = jobTerms.filter((term) => resumeTerms.includes(term)).slice(0, 20);
  const missingKeywords = jobTerms.filter((term) => !resumeTerms.includes(term)).slice(0, 12);
  const wordCount = resumeText.trim().split(/\s+/).length;
  const keywordScore = jobTerms.length ? (matchedKeywords.length / Math.min(jobTerms.length, 20)) * 100 : 65;
  const score = Math.max(10, Math.min(98, Math.round(sections.filter((section) => section.present).length * 7 + keywordScore * 0.35 + Math.min(100, (wordCount / 450) * 100) * 0.23)));
  const suggestions = [];
  if (!sections[1].present) suggestions.push("Add a short professional summary tailored to the role you want.");
  if (!sections[2].present) suggestions.push("Add a clearly labeled experience section with measurable outcomes.");
  if (!sections[4].present) suggestions.push("Create a skills section using relevant tools and technologies.");
  if (wordCount < 180) suggestions.push("Add detail to your recent experience so recruiters can understand your impact.");
  if (jobTerms.length && missingKeywords.length) suggestions.push(`Where accurate, reflect relevant job-description language such as ${missingKeywords.slice(0, 3).join(", ")}.`);
  if (!suggestions.length) suggestions.push("Use concise accomplishment bullets that pair strong action verbs with measurable results.");
  return {
    score,
    summary: jobTerms.length ? `Your resume currently matches ${matchedKeywords.length} of the most relevant job-description terms.` : "Add a job description for role-specific keyword matching. This score reflects resume structure and completeness.",
    sections, matchedKeywords, missingKeywords,
    strengths: [`${sections.filter((section) => section.present).length} of ${sections.length} core resume sections were detected.`, `${wordCount} words give recruiters useful context.`],
    suggestions, source: "local"
  };
}

export function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem("resume-insight-history") || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn("Could not read local analysis history.", error);
    return [];
  }
}

export function writeHistory(items) {
  try {
    localStorage.setItem("resume-insight-history", JSON.stringify(items.slice(0, 20)));
  } catch (error) {
    console.warn("Could not save local analysis history.", error);
  }
}
