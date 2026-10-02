import { Router, type IRouter } from "express";
import {
  ChatWithMoveMateBody,
  ChatWithMoveMateResponse,
  ExtractProfileBody,
  ExtractProfileResponse,
  GenerateMovePlanBody,
  GenerateMovePlanResponse,
} from "@workspace/api-zod";
import {
  extractProfile,
  generatePlan,
} from "../lib/movemate";
import { answerWithMoveMate, isLunaEnabled } from "../lib/luna-assistant";

const router: IRouter = Router();

router.post("/extract-profile", (req, res): void => {
  const parsed = ExtractProfileBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid profile extraction request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = extractProfile(parsed.data.text, parsed.data.answers);
  res.json(ExtractProfileResponse.parse(result));
});

router.post("/generate-plan", (req, res): void => {
  const parsed = GenerateMovePlanBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid move plan request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = generatePlan(parsed.data.profile);
  res.json(GenerateMovePlanResponse.parse(result));
});

router.get("/assistant-status", (_req, res) => {
  res.json({ aiPowered: isLunaEnabled(), model: isLunaEnabled() ? "gpt-6-luna" : null });
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatWithMoveMateBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid MoveMate chat request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await answerWithMoveMate(parsed.data);
    res.json(ChatWithMoveMateResponse.parse(result));
  } catch (error) {
    req.log.warn({ error }, "MoveMate Luna reply failed; using the free demo guide");
    const { answerChat } = await import("../lib/movemate");
    res.json(ChatWithMoveMateResponse.parse({ ...answerChat(parsed.data), aiPowered: false }));
  }
});

export default router;
