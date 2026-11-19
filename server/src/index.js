import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { connectDatabase } from "./config/database.js";
import authRoutes from "./routes/auth.js";
import analysisRoutes from "./routes/analyses.js";
import { analyzeResume } from "./services/analyzer.js";

const app = express();
const port = Number(process.env.PORT) || 5000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== "application/pdf") return callback(new Error("Only PDF files are supported."));
    callback(null, true);
  }
});

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false }));
const analysisLimit = process.env.OPENAI_API_KEY?.trim() ? 10 : 30;
const analysisRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: analysisLimit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Analysis limit reached. Please try again later." }
});
app.get("/api/health", (req, res) => res.json({ status: "ok", mode: process.env.MONGODB_URI ? "connected" : "demo" }));
app.use("/api/auth", authRoutes);
app.use("/api/analyses", analysisRoutes);

app.post("/api/analyze", analysisRateLimit, upload.single("resume"), async (req, res, next) => {
  try {
    let resumeText = String(req.body.resumeText ?? "").trim();
    if (req.file) {
      let parsed;
      try {
        parsed = await pdf(req.file.buffer);
      } catch {
        return res.status(400).json({ message: "We couldn't read that PDF. Try a valid PDF with selectable text." });
      }
      resumeText = parsed.text.trim();
    }
    if (resumeText.length < 80) return res.status(400).json({ message: "Please provide at least 80 characters of readable resume text." });
    if (resumeText.length > 30000) return res.status(413).json({ message: "Resume text must be 30,000 characters or fewer." });
    const jobDescription = String(req.body.jobDescription ?? "").trim().slice(0, 12000);
    const result = await analyzeResume(resumeText, jobDescription);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "PDF must be 5 MB or smaller." : "Unable to process the uploaded file.";
    return res.status(400).json({ message });
  }
  if (error.message === "Only PDF files are supported.") return res.status(400).json({ message: error.message });
  console.error(error);
  return res.status(500).json({ message: error.message || "Something went wrong. Please try again." });
});

try {
  await connectDatabase();
  app.listen(port, () => console.info(`Resume Insight API listening on http://localhost:${port}`));
} catch (error) {
  console.error("Could not connect to MongoDB:", error.message);
  process.exitCode = 1;
}
