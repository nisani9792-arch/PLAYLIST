import { Router, type IRouter } from "express";
import healthRouter from "./health";
import geminiRouter from "./gemini";
import searchRouter from "./search";
import parashaRouter from "./parasha";
import { geminiRateLimiter, searchRateLimiter } from "../middleware/rate-limit";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/gemini", geminiRateLimiter, geminiRouter);
router.use("/search", searchRateLimiter, searchRouter);
router.use("/parasha", searchRateLimiter, parashaRouter);

export default router;
