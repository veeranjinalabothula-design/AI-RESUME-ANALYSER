import { Router } from "express";
import Analysis from "../models/Analysis.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const analyses = await Analysis.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ analyses });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const result = req.body.result;
    if (!result || !Number.isFinite(Number(result.score))) return res.status(400).json({ message: "A valid analysis result is required." });
    const analysis = await Analysis.create({
      user: req.userId,
      title: String(req.body.title ?? "Resume review").slice(0, 100),
      score: Number(result.score),
      result
    });
    res.status(201).json({ analysis });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await Analysis.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!deleted) return res.status(404).json({ message: "Analysis not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
