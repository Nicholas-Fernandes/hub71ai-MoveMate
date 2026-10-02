import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moveMateRouter from "./movemate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(moveMateRouter);

export default router;
