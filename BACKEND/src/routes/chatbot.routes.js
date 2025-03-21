import { Router } from "express";
import { processQuery } from "../controllers/chatbot.controller.js";

const router = Router();

router.route("/query").post(processQuery);

export default router;
