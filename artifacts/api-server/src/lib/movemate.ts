import type {
  MoveMateChatInput,
  MoveMateChatResponse,
  MovePlan,
  MoveProfile,
  MoveTask,
  MoveTaskCategory,
} from "@workspace/api-zod";

type TaskSeed = Omit<MoveTask, "scorePoints">;
const SCORE_INCREMENT = 5;

const categoryWeights: Record<MoveTaskCategory, number> = {
  visa: 25,
  housing: 20,
  job: 20,
  bank: 10,
  "id-medical": 10,
  community: 10,
  sim: 5,
};

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

function choose<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function labeledValue(text: string, label: string): string | undefined {
  const match = text.match(
    new RegExp(`(?:^|\\n)${label}\\s*:\\s*([^\\n]+)`, "i"),
  );
  return match?.[1]?.trim();
}

function parseArrivalDate(text: string): string | null {
  const explicit =
    labeledValue(text, "arrival date") ??
    text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;

  const relative = text.match(/\bin\s+(\d+)\s*(day|week|month)s?\b/i);
  if (!relative) return null;
  const date = new Date();
  const count = Number(relative[1]);
  if (relative[2]?.toLowerCase().startsWith("day")) {
    date.setDate(date.getDate() + count);
  } else if (relative[2]?.toLowerCase().startsWith("week")) {
    date.setDate(date.getDate() + count * 7);
  } else {
    date.setMonth(date.getMonth() + count);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function extractTextProfile(text: string): MoveProfile {
  const lowered = text.toLowerCase();
  const labeledName = labeledValue(text, "name");
  const naturalName =
    text.match(/\bmy name is\s+([A-Z][a-z'-]+)/i)?.[1] ??
    text.match(/\bi(?:'m| am)\s+([A-Z][a-z'-]+)/i)?.[1];
  const nationality =
    labeledValue(text, "nationality") ??
    [
      "American",
      "Australian",
      "British",
      "Canadian",
      "Chinese",
      "French",
      "German",
      "Indian",
      "Irish",
      "Italian",
      "Japanese",
      "Kenyan",
      "Lebanese",
      "Nigerian",
      "Pakistani",
      "Philippine",
      "Singaporean",
      "South African",
      "Spanish",
    ].find((value) => new RegExp(`\\b${value}\\b`, "i").test(text)) ?? "Other";

  const explicitJob = labeledValue(text, "job offer") ?? labeledValue(text, "job status");
  const jobStatus =
    /\b(no|not yet|none|looking|seeking)\b/i.test(explicitJob ?? "") ||
    /\b(no offer|no job offer|not yet|still looking for work|seeking work)\b/i.test(text)
      ? "no-offer"
      : /\b(job offer|have an offer|finance job|starting a role)\b/i.test(text)
        ? "offer"
        : "no-offer";
  const salaryRange =
    labeledValue(text, "salary range") ??
    text.match(/\bAED\s*[\d,.]+\s*(?:-|–|to)\s*[\d,.]+\s*k?\b/i)?.[0] ??
    (jobStatus === "offer" ? "Not shared" : "");
  const familyStatus =
    /\b(alone|solo|on my own|moving alone)\b/i.test(text) ? "alone" : "others";
  const adultsFromText = text.match(/\b(\d+)\s+adults?\b/i)?.[1];
  const childrenFromText = text.match(/\b(\d+)\s+(?:children|kids)\b/i)?.[1];
  const adults =
    Number(adultsFromText) ||
    (/\b(partner|spouse|wife|husband)\b/i.test(text) ? 2 : 1);
  const children = Number(childrenFromText) || 0;
  const arrivalDate = parseArrivalDate(text);
  const explicitArrivalStatus = labeledValue(text, "arrival status");
  const needsVisa =
    /\bvisa\b/i.test(explicitArrivalStatus ?? "") ||
    /\b(need visa|visa help|need help with.*visa|no visa)\b/i.test(text);
  const arrivalStatus = needsVisa ? "visa" : "date";
  const currentCity =
    labeledValue(text, "current city") ??
    text.match(/\b(?:moving|coming|travelling|traveling)\s+from\s+([A-Z][A-Za-z .'-]+)/i)?.[1]?.trim() ??
    null;

  return {
    name: (labeledName ?? naturalName ?? "New arrival").slice(0, 80),
    nationality: nationality.slice(0, 80),
    jobStatus,
    salaryRange: salaryRange.slice(0, 80),
    familyStatus,
    adults: Math.min(8, Math.max(1, adults)),
    children: Math.min(8, Math.max(0, children)),
    arrivalStatus,
    arrivalDate: arrivalStatus === "date" ? arrivalDate : null,
    currentCity: currentCity?.slice(0, 100) ?? null,
  };
}

export function extractProfile(text: string, answers?: MoveProfile): MoveProfile {
  const extracted = extractTextProfile(text);
  if (!answers) return extracted;
  return {
    ...answers,
    name: labeledValue(text, "name") ?? answers.name,
    nationality: labeledValue(text, "nationality") ?? answers.nationality,
    salaryRange: labeledValue(text, "salary range") ?? answers.salaryRange,
  };
}

function task(
  id: string,
  title: string,
  description: string,
  priority: TaskSeed["priority"],
  category: TaskSeed["category"],
  officialSource = false,
): TaskSeed {
  return { id, title, description, priority, category, officialSource };
}

function tasksFor(profile: MoveProfile) {
  const beforeArrival: TaskSeed[] = [
    task(
      "confirm-entry-process",
      profile.arrivalStatus === "visa"
        ? "Confirm your visa pathway"
        : "Confirm your entry and residence steps",
      profile.arrivalStatus === "visa"
        ? "Ask your employer or sponsor which visa route applies and what they will arrange."
        : "Check your entry permission and residence steps with your employer or sponsor before travel.",
      "high",
      "visa",
      true,
    ),
    task(
      "shortlist-home-areas",
      "Shortlist a few neighbourhoods",
      "Compare commute, rent, and day-to-day needs before deciding where to look.",
      "high",
      "housing",
    ),
    task(
      "prepare-bank-documents",
      "Check bank account document requirements",
      "Ask two banks which documents they currently accept for new residents.",
      "medium",
      "bank",
      true,
    ),
    task(
      "prepare-work-arrival",
      profile.jobStatus === "offer"
        ? "Confirm your start date and joining documents"
        : "Prepare a focused Abu Dhabi job-search plan",
      profile.jobStatus === "offer"
        ? "Check your joining date, sponsor paperwork, and first-week expectations with your employer."
        : "Choose target roles, refresh your CV, and set a weekly application goal.",
      profile.jobStatus === "offer" ? "medium" : "high",
      "job",
    ),
  ];
  const week1: TaskSeed[] = [
    task(
      "complete-medical-and-insurance",
      "Complete medical screening and confirm health insurance",
      "Follow your sponsor’s screening steps, then confirm when your health cover starts and who to contact for care.",
      "high",
      "id-medical",
      true,
    ),
    task(
      "choose-local-sim",
      "Choose a local SIM plan",
      "Compare data, coverage, and monthly cost before picking a provider.",
      "medium",
      "sim",
    ),
    task(
      "explore-neighbourhood",
      "Get to know one neighbourhood",
      "Try the commute, find a grocery shop, and note what feels right for you.",
      "low",
      "housing",
    ),
    task(
      "find-first-community",
      "Find one newcomer community or meetup",
      "Choose an activity that matches your interests and save the details.",
      "low",
      "community",
    ),
  ];
  const week2: TaskSeed[] = [
    task(
      "open-bank-account",
      "Open a bank account when your documents are ready",
      "Apply with the bank whose requirements and fees best fit your needs.",
      "high",
      "bank",
      true,
    ),
    task(
      "check-emirates-id",
      "Check your Emirates ID progress",
      "Use the status or collection instructions from your sponsor or official service.",
      "high",
      "id-medical",
      true,
    ),
    task(
      "settle-housing-choice",
      "Choose your first home base",
      "Compare your shortlist against commute, budget, and any family needs.",
      "medium",
      "housing",
    ),
    task(
      "build-work-momentum",
      profile.jobStatus === "offer"
        ? "Settle into your new role"
        : "Keep momentum on your job search",
      profile.jobStatus === "offer"
        ? "Check in with your manager and make a short list of first-month priorities."
        : "Review responses, follow up on applications, and tune your target list.",
      "medium",
      "job",
    ),
  ];

  return { beforeArrival, week1, week2 };
}

function assignScorePoints(
  taskGroups: ReturnType<typeof tasksFor>,
  profile: MoveProfile,
): MovePlan["beforeArrival"] {
  const seeds = [
    ...taskGroups.beforeArrival,
    ...taskGroups.week1,
    ...taskGroups.week2,
  ];
  const taskWeights = { ...categoryWeights };
  if (profile.jobStatus === "offer") {
    // Give the start-date and joining-documents step 5 points while keeping
    // the total at 100 by shifting 5 points from the community category.
    taskWeights.job = SCORE_INCREMENT;
    taskWeights.community -= SCORE_INCREMENT;
  }
  const grouped = new Map<MoveTaskCategory, TaskSeed[]>();
  for (const item of seeds) {
    const group = grouped.get(item.category) ?? [];
    group.push(item);
    grouped.set(item.category, group);
  }
  const pointsById = new Map<string, number>();
  for (const [category, categoryTasks] of grouped) {
    const increments = taskWeights[category] / SCORE_INCREMENT;
    if (!Number.isInteger(increments)) {
      throw new Error(`The ${category} score weight must use increments of ${SCORE_INCREMENT}.`);
    }
    for (let index = 0; index < increments; index += 1) {
      const task = categoryTasks[index % categoryTasks.length];
      if (task) pointsById.set(task.id, (pointsById.get(task.id) ?? 0) + SCORE_INCREMENT);
    }
  }

  return seeds.map((item) => ({ ...item, scorePoints: pointsById.get(item.id) ?? 0 }));
}

function roundedRandom(low: number, high: number): number {
  return Math.round((low + Math.random() * (high - low)) / 100) * 100;
}

export function generatePlan(profile: MoveProfile): MovePlan {
  const seeds = tasksFor(profile);
  const scored = assignScorePoints(seeds, profile);
  const split = (ids: string[]) => scored.filter((item) => ids.includes(item.id));
  const householdSize = Math.max(1, profile.adults + profile.children);
  const housingLow = 8000 + Math.max(0, profile.adults - 1) * 2200 + profile.children * 900;
  const housingHigh = housingLow + 8000;
  const dailyLow = householdSize * 1450;
  const dailyHigh = householdSize * 2600;
  const transportLow = 700;
  const transportHigh = 1900;
  const residencyLow = profile.arrivalStatus === "visa" ? 1800 : 600;
  const residencyHigh = profile.arrivalStatus === "visa" ? 5200 : 2600;
  const costBreakdown: MovePlan["costBreakdown"] = [
    { category: "Initial housing and setup", lowAed: housingLow, highAed: housingHigh },
    { category: "Food and essentials", lowAed: dailyLow, highAed: dailyHigh },
    { category: "Local transport", lowAed: transportLow, highAed: transportHigh },
    { category: "Residency and settling-in costs", lowAed: residencyLow, highAed: residencyHigh },
  ];
  const totalLow = costBreakdown.reduce((sum, line) => sum + line.lowAed, 0);
  const totalHigh = costBreakdown.reduce((sum, line) => sum + line.highAed, 0);

  return {
    beforeArrival: split([
      "confirm-entry-process",
      "shortlist-home-areas",
      "prepare-bank-documents",
      "prepare-work-arrival",
    ]),
    week1: split([
      "complete-medical-and-insurance",
      "choose-local-sim",
      "explore-neighbourhood",
      "find-first-community",
    ]),
    week2: split([
      "open-bank-account",
      "check-emirates-id",
      "settle-housing-choice",
      "build-work-momentum",
    ]),
    estimatedFirstMonthCost: roundedRandom(totalLow, totalHigh),
    costBreakdown,
    costNote:
      "Indicative AED demo estimate only. Rent, deposits, fees, and sponsor arrangements vary; confirm current details with providers and official sources.",
  };
}

export function allPlanTasks(plan: MovePlan): MoveTask[] {
  return [...plan.beforeArrival, ...plan.week1, ...plan.week2];
}

export function getNextTask(
  plan: MovePlan,
  completedTaskIds: string[],
): MoveTask | null {
  const completed = new Set(completedTaskIds);
  return (
    allPlanTasks(plan)
      .filter((item) => !completed.has(item.id))
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])[0] ?? null
  );
}

export function settlementScore(
  profile: MoveProfile,
  plan: MovePlan,
  completedTaskIds: string[],
): number {
  const completed = new Set(completedTaskIds);
  const completedPoints = allPlanTasks(plan)
    .filter((item) => completed.has(item.id))
    .reduce((sum, item) => sum + item.scorePoints, 0);
  const existingJobBonus = profile.jobStatus === "offer" ? 20 : 0;
  return Math.min(100, Math.round(existingJobBonus + completedPoints));
}

function taskForCompletion(message: string, plan: MovePlan, completed: Set<string>): MoveTask | null {
  const lower = message.toLowerCase();
  const saysComplete =
    /\b(?:i (?:just )?(?:finished|completed|did|opened|submitted|signed|set up|got)|i've (?:finished|completed|opened|submitted|signed)|that's done|that is done|mark .+ (?:done|complete))\b/i.test(
      message,
    );
  if (!saysComplete) return null;

  const categoryHints: Array<[MoveTaskCategory, RegExp]> = [
    ["bank", /\b(bank|account)\b/i],
    ["visa", /\b(visa|entry permit|residence process)\b/i],
    ["housing", /\b(house|home|housing|neighbourhood|neighborhood|area)\b/i],
    ["job", /\b(job|role|work|cv|application)\b/i],
    ["id-medical", /\b(emirates id|medical|insurance|screening)\b/i],
    ["sim", /\b(sim|phone plan|mobile plan)\b/i],
    ["community", /\b(meetup|community|people)\b/i],
  ];
  const category = categoryHints.find(([, pattern]) => pattern.test(lower))?.[0];
  if (!category) return null;

  const candidates = allPlanTasks(plan).filter(
    (item) => item.category === category && !completed.has(item.id),
  );
  if (category === "bank" && /\b(opened|opening|open|account)\b/i.test(lower)) {
    return candidates.find((item) => item.id === "open-bank-account") ?? candidates[0] ?? null;
  }
  return candidates[0] ?? null;
}

export function answerChat(
  input: MoveMateChatInput,
): Omit<MoveMateChatResponse, "aiPowered"> {
  const completed = new Set(input.completedTaskIds);
  const completionTarget = taskForCompletion(input.message, input.plan, completed);
  if (completionTarget) {
    completed.add(completionTarget.id);
    const completedTaskIds = [...completed];
    const nextTask = getNextTask(input.plan, completedTaskIds);
    const score = settlementScore(input.profile, input.plan, completedTaskIds);
    const nextCopy = nextTask
      ? ` Your next step is ${nextTask.title}.`
      : " You have completed every task in your current plan.";
    return {
      reply: `Nice work. I marked “${completionTarget.title}” complete. Your Settlement Score is now ${score}%.${nextCopy}`,
      intent: "task-completed",
      completedTaskIds,
      nextTask,
      settlementScore: score,
    };
  }

  const nextTask = getNextTask(input.plan, input.completedTaskIds);
  const score = settlementScore(input.profile, input.plan, input.completedTaskIds);
  const wantsNext = /\bwhat(?:'s| is|s) next\b|\bnext step\b|\bwhat should i do next\b/i.test(
    input.message,
  );
  if (wantsNext) {
    return {
      reply: nextTask
        ? `Your next step is ${nextTask.title}. ${nextTask.description}`
        : "Your current plan is complete. Take a moment to enjoy how far you have come.",
      intent: "next-step",
      completedTaskIds: [...completed],
      nextTask,
      settlementScore: score,
    };
  }

  const conversation = input.conversationHistory ?? [];
  const previousGuideLine = [...conversation].reverse().find((item) => item.role === "assistant")?.text.toLowerCase() ?? "";
  const housingWords = /\b(hous(?:e|ing)|neighbou?rhood|area|rent|commute|shortlist)\b/i;
  const contextText = [...conversation.map((item) => item.text), input.message].join(" ").toLowerCase();
  const explicitBankRequest = /\b(bank|account|adcb|fab|mashreq|emirates nbd)\b/i.test(input.message);
  const explicitSimRequest = /\b(sim|esim|e-sim|phone plan|mobile plan|airport sim)\b/i.test(input.message);
  const housingFollowUp = /commut|work or school|rent budget|optimize for|housing tab|neighbourhood|neighborhood/i.test(previousGuideLine);
  const inHousingFlow = !explicitBankRequest && !explicitSimRequest && (housingWords.test(input.message) || housingFollowUp);
  if (inHousingFlow) {
    if (/commute|work or school|where.*work|location/.test(previousGuideLine) && !/\b(aed|dirham|rent|budget)\b/i.test(input.message)) {
      return { reply: "Got it. What monthly rent budget should I use, in AED? A rough range is perfect.", intent: "general", completedTaskIds: [...completed], nextTask, settlementScore: score };
    }
    if (/rent budget|monthly rent|budget.*aed/.test(previousGuideLine) && !/\b(commute|walk|drive|transit|metro|bus|car|shortest|quiet|space)\b/i.test(input.message)) {
      return { reply: "And what should I optimize for: the shortest drive, public transport, walkable errands, more space, or a quieter feel?", intent: "general", completedTaskIds: [...completed], nextTask, settlementScore: score };
    }
    if (/commute preference|what should i optimize|shortest drive|public transport/.test(previousGuideLine) || /\b(shortest commute|walkable|public transport|more space|quieter|quiet feel)\b/i.test(input.message)) {
      const central = /downtown|city centre|city center|corniche|al reem|central/i.test(contextText);
      const airportSide = /airport|yas|al raha|khalifa city/i.test(contextText);
      const first = central ? "Al Reem Island or Corniche/Al Khalidiyah" : airportSide ? "Khalifa City, Al Raha Beach or Yas Island" : "Al Reem Island, Khalifa City or Al Raha Beach";
      return { reply: `Based on what you shared, I’d compare ${first} first. ${central ? "They give you central-city starting points to test against your exact office route." : airportSide ? "These give you airport-side or more space-focused options to test against your destination." : "That gives you a useful mix of central apartments and more space-focused areas."} Check current listings against your rent range and test the route at your usual commute time; rents and travel times vary by building. The Housing tab below has quick profiles and current-listing links.`, intent: "general", completedTaskIds: [...completed], nextTask, settlementScore: score };
    }
    return { reply: "Let’s narrow this down one step at a time. Where will you commute most days for work or school? A district or nearby landmark is enough.", intent: "general", completedTaskIds: [...completed], nextTask, settlementScore: score };
  }

  if (explicitSimRequest || /prefer an esim|buy a sim at the airport/.test(previousGuideLine)) {
    const inUae = /\b(i'm in|i am in|already in|landed in)\b/i.test(input.message);
    return { reply: inUae ? "Start with an e& or du store/airport desk and ask whether your visitor number can be moved to a resident plan without changing the number. Bring the ID the provider asks for and verify the conversion before you buy. The SIM tab below has sample options; would you rather compare airport pickup or eSIM setup?" : "You can compare two paths: check eSIM compatibility and setup before you fly, or get a visitor SIM at the airport on arrival. Before choosing, ask the provider whether that number can transfer to a resident plan and what ID it needs. The SIM tab below has sample options. Would you prefer eSIM before you travel or airport pickup?", intent: "general", completedTaskIds: [...completed], nextTask, settlementScore: score };
  }

  if (/\b(bank|account)\b/i.test(input.message)) {
    if (/\b(document|paperwork|checklist|requirement)\b/i.test(input.message)) {
      return { reply: "I’ll point you to the Bank guide below. It has preparation checklists and official product links for ADCB, FAB, Emirates NBD and Mashreq. The bank decides its actual documents, so use the official link to verify your account type and eligibility.", intent: "bank", completedTaskIds: [...completed], nextTask, settlementScore: score };
    }
    if (/\b(right bank|which bank|recommend|best bank|figure out)\b/i.test(input.message)) {
      const salaryFloor = /^under\b/i.test(input.profile.salaryRange) ? 0 : Number(input.profile.salaryRange.replace(/[^\d]/g, "").slice(0, 2)) * 1000;
      const message = input.profile.jobStatus === "offer" && salaryFloor >= 10000
        ? `Your profile includes a job offer and a salary range beginning at ${input.profile.salaryRange}. FAB One is worth comparing because its official page lists AED 10,000 as the minimum monthly salary for salaried customers. Compare current fees and conditions with the other options in the Bank tab before deciding.`
        : "First, are you already in the UAE with a residence visa, or are you still pre-arrival? If you need a visitor option, ADCB’s Instant Tourist Account is one product to check, but it requires a valid visit visa and physical presence in the UAE to open. ADCB lists a digital debit card by default; the account must close, and cannot convert, if you later receive a UAE residence visa. The Bank tab has official links and account paths to compare.";
      return { reply: message, intent: "bank", completedTaskIds: [...completed], nextTask, settlementScore: score };
    }
    return {
      reply: choose([
        "For a smooth bank application, compare account fees, minimum-balance rules, and the documents each bank accepts. Many ask for an Emirates ID, passport, residence visa, and proof of address; confirm the current list directly with your chosen bank.",
        "A useful first move is to compare two banks on monthly fees, minimum balance, and app support. Requirements vary, so check the bank’s current document list before you apply.",
        "Bank checklist: compare fees, ask about minimum balance, and confirm what identity and address documents are accepted. Your bank can verify its latest requirements.",
      ]),
      intent: "bank",
      completedTaskIds: [...completed],
      nextTask,
      settlementScore: score,
    };
  }

  if (
    /\b(visa|entry permit|sponsor|emirates id|medical|insurance|documents?|paperwork|passport|photo)\b/i.test(
      input.message,
    )
  ) {
    return {
      reply: choose([
        "A typical employer-sponsored move can involve sponsor paperwork, entry or residence steps, medical fitness screening, health insurance, and Emirates ID. Your exact route depends on your sponsor and circumstances, so verify it with your employer and ICP or TAMM.",
        "Start by asking your sponsor which steps they handle and which documents they need from you. Medical screening, health insurance, and Emirates ID may follow; check current requirements with your sponsor and official ICP or TAMM services.",
        "Keep your passport, sponsor or employer paperwork, visa details, and any requested photo ready. Medical screening, insurance, and Emirates ID steps may follow. Requirements vary, so verify your checklist with your sponsor and official ICP or TAMM services.",
        "Visa and residency steps can vary. Confirm your pathway with your sponsor, then verify current requirements through ICP or TAMM before making plans.",
      ]),
      intent: "visa",
      completedTaskIds: [...completed],
      nextTask,
      settlementScore: score,
    };
  }

  return {
    reply: choose([
      `A helpful place to start is ${nextTask?.title ?? "taking a breather"}. You can work through your plan one small step at a time.`,
      "Moving has a lot of moving parts, so it helps to focus on one decision at a time. Your plan is tailored to the answers you shared.",
      `You are ${score}% through your settlement checklist. I can help with your next step, bank guidance, or visa documents.`,
    ]),
    intent: "general",
    completedTaskIds: [...completed],
    nextTask,
    settlementScore: score,
  };
}
