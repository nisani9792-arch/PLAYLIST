import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accessRouter from "./access";
import adminRouter from "./admin";
import geminiRouter from "./gemini";
import curatorRouter from "./curator";
import searchRouter from "./search";
import parashaRouter from "./parasha";
import playlistsRouter from "./playlists";
import { attachOperator } from "../middleware/operator";
import { geminiRateLimiter, searchRateLimiter } from "../middleware/rate-limit";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/access", accessRouter);
router.use(attachOperator);
router.use(adminRouter);
router.use("/gemini", geminiRateLimiter, geminiRouter);
router.use("/curator", geminiRateLimiter, curatorRouter);
router.use("/search", searchRateLimiter, searchRouter);
router.use("/parasha", searchRateLimiter, parashaRouter);
router.use("/playlists", searchRateLimiter, playlistsRouter);

export default router;
