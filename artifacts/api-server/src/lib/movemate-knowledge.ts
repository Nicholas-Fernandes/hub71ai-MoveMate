export type MoveMateKnowledgeEntry = {
  id: string;
  topic: string;
  keywords: string[];
  guidance: string;
  sourceName: string;
  sourceUrl: string;
  checkedAt: string;
};

// Small, dated first-party facts for the demo. Add new entries with a source
// and review date before using them to shape relocation advice.
export const moveMateKnowledge: MoveMateKnowledgeEntry[] = [
  {
    id: "adcb-instant-tourist-account",
    topic: "ADCB visitor banking",
    keywords: ["bank", "adcb", "tourist", "visitor", "virtual", "digital", "card"],
    guidance:
      "ADCB's Instant Tourist Account requires a valid tourist or visit visa and physical presence in the UAE at account opening, so do not promise it can be opened before arrival. A digital debit card is issued by default; a physical card can be requested through uBank, subject to fees. The official page lists a monthly AED 25 maintenance fee, waived at a minimum AED 2,500 balance. If the customer obtains a UAE residence visa, ADCB says the tourist account must be closed and a new resident account opened subject to eligibility; conversion is not permitted.",
    sourceName: "ADCB Instant Tourist Account",
    sourceUrl: "https://www.adcb.com/en/personal/accounts/current-savings-account/instant-tourist-account",
    checkedAt: "2026-10-02",
  },
  {
    id: "eand-visitor-line",
    topic: "e& Visitor Line SIM",
    keywords: ["sim", "phone", "mobile", "number", "airport", "etisalat", "visitor", "line", "esim"],
    guidance:
      "e& says its Visitor Line is available at airport arrivals in Abu Dhabi, Dubai, and Sharjah. A Visitor Line can later be migrated to Wasel prepaid or postpaid at an e& outlet by presenting a new Emirates ID. Confirm current availability, plan terms, and whether the user's specific line can migrate before promising it.",
    sourceName: "e& Visitor Line support",
    sourceUrl: "https://www.eand.ae/en/c/mobile/plans/visitor-line.html",
    checkedAt: "2026-10-02",
  },
  {
    id: "du-tourist-sim-migration",
    topic: "du Tourist SIM migration",
    keywords: ["sim", "phone", "mobile", "number", "airport", "du", "tourist", "prepaid", "postpaid"],
    guidance:
      "du publishes a process for tourist SIM customers who want to continue using the same number after becoming UAE residents. The user should follow du's current migration steps and verify the documents and deadline with du; do not imply that every tourist plan migrates automatically.",
    sourceName: "du Tourist SIM migration FAQ",
    sourceUrl: "https://www.du.ae/sites/duaediscovery/common/pdfs/Tourist%20Migration%20-%20FAQs.pdf",
    checkedAt: "2026-10-02",
  },
  {
    id: "fab-one-salary-eligibility",
    topic: "FAB One salary account comparison",
    keywords: ["bank", "fab", "salary", "account", "offer", "minimum", "balance", "fees"],
    guidance:
      "FAB's official FAB One current account page lists a minimum monthly salary of AED 10,000 for salaried customers. This is product-specific. Recommend comparing current fees, salary transfer conditions, benefits, and eligibility before choosing; do not infer approval from salary alone.",
    sourceName: "FAB One Current Account",
    sourceUrl: "https://www.bankfab.com/en-ae/personal/accounts/current-accounts/one-account",
    checkedAt: "2026-10-02",
  },
  {
    id: "emirates-nbd-resident-account",
    topic: "Emirates NBD current-account eligibility",
    keywords: ["bank", "emirates", "nbd", "account", "resident", "visa", "documents", "digital"],
    guidance:
      "Emirates NBD says its online current accounts are available to UAE resident customers, salaried and non-salaried. Account-specific document requirements vary; send users to its current document guide and do not guarantee opening or approval.",
    sourceName: "Emirates NBD current-account guide",
    sourceUrl: "https://www.emiratesnbd.com/en/knowledge-hub/open-a-current-account-online",
    checkedAt: "2026-10-02",
  },
];
