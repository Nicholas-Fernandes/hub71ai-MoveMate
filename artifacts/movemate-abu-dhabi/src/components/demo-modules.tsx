import { useState } from 'react';
import { BriefcaseBusiness, Bus, CalendarDays, Check, ChevronDown, CreditCard, MapPin, RefreshCw, Smartphone, Sparkles, ExternalLink, Home, CircleHelp } from 'lucide-react';

type ModuleKey = 'bank' | 'housing' | 'sim' | 'jobs' | 'events' | 'transport';
type BankPriority = 'before-arrival' | 'salary' | 'digital' | 'fees' | 'not-sure';
type DemoProfile = { jobStatus: string; salaryRange: string; arrivalStatus: string };
const modules: { key: ModuleKey; label: string; icon: typeof CreditCard }[] = [
  { key: 'bank', label: 'Bank', icon: CreditCard },
  { key: 'housing', label: 'Housing', icon: Home },
  { key: 'sim', label: 'SIM', icon: Smartphone },
  { key: 'jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'transport', label: 'Transport', icon: Bus },
];
const banks = [
  { name: 'ADCB', note: 'Visitor and resident account paths', detail: 'Its Instant Tourist Account requires a valid visit visa and physical presence in the UAE to open. A digital debit card is issued by default; a physical card can be requested. The listed AED 25 monthly fee is waived at an AED 2,500 minimum balance. If you later get a residence visa, the tourist account must close; it cannot be converted.', product: 'Instant Tourist Account', url: 'https://www.adcb.com/en/personal/accounts/current-savings-account/instant-tourist-account', docs: ['Passport and current entry or residence status', 'UAE contact details, if requested', 'Ask the bank which proof of address it accepts'] },
  { name: 'FAB', note: 'Compare everyday and salary account options', detail: 'FAB offers personal current accounts. Its FAB One page lists a minimum monthly salary of AED 10,000 for salaried customers; confirm current criteria and fees.', product: 'FAB Personal Current Account', url: 'https://www.bankfab.com/en-ae/personal/accounts/current-accounts/personal-current-account', docs: ['Passport and current entry or residence status', 'Emirates ID, if available', 'Salary or employer information, if applying for a salary account'] },
  { name: 'Emirates NBD', note: 'Resident current-account option', detail: 'Emirates NBD says its online current accounts are for UAE residents, both salaried and non-salaried. Check its document guide for your account type.', product: 'Current account and document guide', url: 'https://www.emiratesnbd.com/en/knowledge-hub/open-a-current-account-online', docs: ['Passport and residence visa', 'Emirates ID or application status', 'Account-specific proof of income or address'] },
  { name: 'Mashreq NEO', note: 'Digital banking option to compare', detail: 'Explore its current and savings accounts, then check the exact residency, Emirates ID, salary and balance rules for the product you want.', product: 'NEO accounts', url: 'https://www.mashreq.com/en/uae/neo/accounts/', docs: ['Passport and current entry or residence status', 'Emirates ID, if required for your chosen product', 'Check the product page for salary or balance criteria'] },
];
const neighbourhoods = [
  { name: 'Al Reem Island', fit: 'Central apartment living', tradeoff: 'Compare tower amenities, parking and peak-hour routes to your workplace.', link: 'https://www.propertyfinder.ae/en/area-insights/abu-dhabi/al-reem-island' },
  { name: 'Khalifa City', fit: 'More room and a quieter suburban feel', tradeoff: 'Check the exact drive to work or school and whether daily errands need a car.', link: 'https://www.bayut.com/area-guides/abu-dhabi/' },
  { name: 'Corniche / Al Khalidiyah', fit: 'Central city access and waterfront walks', tradeoff: 'Compare building age, parking and your exact commute at busy times.', link: 'https://www.propertyfinder.ae/en/rent/abu-dhabi/properties-for-rent.html' },
  { name: 'Yas Island', fit: 'Island amenities, leisure and family outings', tradeoff: 'Check the commute to central Abu Dhabi and current rents for your home size.', link: 'https://www.bayut.com/mybayut/top-residential-islands-abu-dhabi/' },
  { name: 'Al Raha Beach', fit: 'Waterfront communities and airport-side access', tradeoff: 'Compare community fees, transit options and travel time to your workplace.', link: 'https://www.propertyfinder.ae/en/rent/abu-dhabi/properties-for-rent.html' },
  { name: 'Mohammed Bin Zayed City', fit: 'Space-focused options away from the island core', tradeoff: 'Check the daily drive, nearby services and transport that suit your routine.', link: 'https://www.bayut.com/area-guides/abu-dhabi/' },
];
const simProviders = [
  { name: 'e&', plan: 'Visitor Line', data: 'Visitor SIM and eSIM options', price: 'Check', detail: 'See current plan and validity', url: 'https://www.eand.ae/en/c/mobile/plans/visitor-line.html' },
  { name: 'du', plan: 'Tourist SIM', data: 'Visitor bundles and tourist eSIM', price: 'Check', detail: 'See current bundle and activation', url: 'https://www.du.ae/personal/mobile/prepaid-plans/tourist-sim/registration' },
  { name: 'Virgin Mobile', plan: 'UAE mobile plans', data: 'Compare current eSIM and SIM options', price: 'Check', detail: 'See current offers and eligibility', url: 'https://www.virginmobile.ae/' },
];
const jobIdeas = [
  { title: 'Client services coordinator', field: 'Operations', fit: 'A people-focused route for someone who enjoys keeping details moving.' },
  { title: 'Junior project administrator', field: 'Operations', fit: 'A practical starting point for building local project experience.' },
  { title: 'Learning support assistant', field: 'Education', fit: 'A school-based idea for someone drawn to student support.' },
  { title: 'Clinic front-desk coordinator', field: 'Healthcare', fit: 'A service role combining organisation and clear communication.' },
  { title: 'Events operations assistant', field: 'Hospitality', fit: 'A hands-on idea for busy venues and visitor experiences.' },
  { title: 'Guest experience associate', field: 'Hospitality', fit: 'A welcoming role suited to strong communication and service.' },
  { title: 'Accounts assistant', field: 'Finance', fit: 'An entry-level direction for someone with careful numerical habits.' },
  { title: 'Sales support administrator', field: 'Commercial', fit: 'A coordination-oriented route across customer and sales teams.' },
];
const events = [
  { name: 'Corniche morning walk', type: 'Outdoors', when: 'A quiet start by the water', price: 'Free' },
  { name: 'Community language exchange', type: 'Community', when: 'Meet neighbours over conversation', price: 'Free' },
  { name: 'Public art trail', type: 'Culture', when: 'Explore creative corners of the city', price: 'Free' },
  { name: 'Family picnic at the park', type: 'Family', when: 'Bring a blanket and settle in', price: 'Free' },
  { name: 'Newcomer coffee circle', type: 'Community', when: 'Small-group introductions', price: 'Free' },
  { name: 'Mangrove kayak introduction', type: 'Outdoors', when: 'A guided beginner session', price: 'AED 85' },
  { name: 'Gallery discovery tour', type: 'Culture', when: 'A hosted art and architecture visit', price: 'AED 45' },
  { name: 'Abu Dhabi food tasting', type: 'Food', when: 'Sample regional favourites', price: 'AED 120' },
  { name: 'Beginner pottery workshop', type: 'Creative', when: 'Make a small piece to take home', price: 'AED 95' },
  { name: 'Desert evening introduction', type: 'Outdoors', when: 'An easy-paced desert experience', price: 'AED 160' },
];
const transport = [
  { mode: 'Local bus', example: 'Single journey', low: 'AED 2', high: 'AED 5' },
  { mode: 'Taxi', example: 'Short city trip', low: 'AED 12', high: 'AED 35' },
  { mode: 'Ride-hail', example: 'Short city trip', low: 'AED 15', high: 'AED 45' },
  { mode: 'Car hire', example: 'Daily sample', low: 'AED 90', high: 'AED 220' },
];

function DemoTag() { return <span className="demo-tag">Demo data</span>; }

function salaryNumber(value: string) { if (/^under\b/i.test(value)) return 0; return Number(value.replace(/[^\d]/g, '').slice(0, 2)) * 1000; }

export default function DemoModules({ profile }: { profile: DemoProfile }) {
  const [active, setActive] = useState<ModuleKey>('bank');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [jobOffset, setJobOffset] = useState(0);
  const [bankPriority, setBankPriority] = useState<BankPriority>('not-sure');
  const activeIndex = modules.findIndex(item => item.key === active);
  const visibleJobs = Array.from({ length: 4 }, (_, index) => jobIdeas[(index + jobOffset) % jobIdeas.length]);
  const toggleDoc = (key: string) => setChecked(current => ({ ...current, [key]: !current[key] }));
  const bankRecommendation = bankPriority === 'before-arrival'
    ? { title: 'Check whether ADCB’s visitor account fits your arrival', reason: 'ADCB lists a digital debit card by default, but its Instant Tourist Account requires a valid visit visa and physical presence in the UAE to open. A listed AED 25 monthly fee is waived at AED 2,500 minimum balance; if you receive a residence visa later, it must close and cannot convert. Verify before relying on it.' }
    : bankPriority === 'salary' && profile.jobStatus === 'offer' && salaryNumber(profile.salaryRange) >= 10000
      ? { title: 'Compare salary account offers, including FAB One', reason: 'Your selected salary range starts at AED 10,000, which meets the minimum monthly salary listed on FAB One’s page. Compare its current fees and benefits with other banks before deciding.' }
      : bankPriority === 'salary'
        ? { title: 'Compare salary account rules after your offer is confirmed', reason: 'Your current move profile does not confirm a salary range at AED 10,000 or above. FAB One lists that as its minimum monthly salary; compare products whose published criteria fit your actual salary.' }
        : bankPriority === 'digital'
          ? { title: 'Compare digital account journeys', reason: 'Mashreq NEO and ADCB both publish online account information. Check whether your visa status, Emirates ID and UAE mobile number are needed for the exact product you want.' }
          : bankPriority === 'fees'
            ? { title: 'Compare the current fee schedules first', reason: 'A low-fee choice depends on account type, balance and salary conditions. Open each provider’s current fees and key facts before picking one.' }
            : { title: 'Choose based on your move stage', reason: 'If you need a temporary visitor option before your residence visa, review ADCB’s Instant Tourist Account. Once resident, compare standard current accounts using your salary, fees, minimum balance, digital access and branch needs.' };
  return <section className="demo-hub" aria-labelledby="demo-hub-heading" data-testid="section-demo-modules">
    <div className="demo-hub-heading">
      <div><div className="phase-label">Local planning desk</div><h2 id="demo-hub-heading">Useful things to explore</h2><p>Small starting points for the practical parts of settling in.</p></div>
      <DemoTag />
    </div>
    <div className="demo-disclaimer" role="note" data-testid="text-demo-disclaimer">Everything here is illustrative sample data, not current or verified information. Confirm details directly with providers before making decisions.</div>
    <div className="demo-tabs" role="tablist" aria-label="Explore relocation modules">
      {modules.map(({ key, label, icon: Icon }, index) => <button key={key} id={`demo-tab-${key}`} type="button" role="tab" aria-selected={active === key} aria-controls={`demo-panel-${key}`} tabIndex={active === key ? 0 : -1} className={`demo-tab${active === key ? ' is-active' : ''}`} onClick={() => setActive(key)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const direction = event.key === 'ArrowRight' ? 1 : -1; const next = (index + direction + modules.length) % modules.length; setActive(modules[next].key); document.getElementById(`demo-tab-${modules[next].key}`)?.focus(); } }} data-testid={`tab-demo-${key}`}><Icon size={16} /><span>{label}</span><span className="demo-tab-index">0{index + 1}</span></button>)}
    </div>
    <div className="demo-panel" role="tabpanel" id={`demo-panel-${active}`} aria-labelledby={`demo-tab-${active}`} tabIndex={0} data-testid={`panel-demo-${active}`}>
      {active === 'bank' && <div className="module-content">
        <div className="module-title-row"><div><DemoTag /><h3>Find a bank worth comparing</h3><p>Choose what matters most to get a clear starting point and a reason.</p></div><span className="module-count">04 providers</span></div>
        <div className="bank-priorities" role="group" aria-label="What matters most for choosing a bank?">{([
          ['before-arrival', 'Visitor / temporary'], ['salary', 'Salary account'], ['digital', 'Digital setup'], ['fees', 'Fees and balance'], ['not-sure', 'Help me compare'],
        ] as const).map(([value, label]) => <button key={value} type="button" className={`bank-priority${bankPriority === value ? ' is-selected' : ''}`} aria-pressed={bankPriority === value} onClick={() => setBankPriority(value)}>{label}</button>)}</div>
        <aside className="bank-recommendation" aria-live="polite" data-testid="bank-recommendation"><span className="recommendation-label"><CircleHelp size={14} />Your starting point</span><strong>{bankRecommendation.title}</strong><p>{bankRecommendation.reason}</p></aside>
        <div className="bank-grid">{banks.map((bank, index) => <article className="bank-card" key={bank.name} data-testid={`card-bank-${index}`}><div className="bank-card-head"><span className="bank-monogram">{bank.name.split(' ').map(word => word[0]).join('').slice(0, 2)}</span><div><h4>{bank.name}</h4><p>{bank.note}</p></div></div><p className="bank-detail">{bank.detail}</p><div className="bank-links"><a href={bank.url} target="_blank" rel="noreferrer">{bank.product}<ExternalLink size={12} /></a>{bank.name === 'FAB' && <a href="https://www.bankfab.com/en-ae/personal/accounts/current-accounts/one-account" target="_blank" rel="noreferrer">FAB One criteria <ExternalLink size={12} /></a>}{bank.name === 'ADCB' && <a href="https://www.adcb.com/en/tools-resources/charges-fees/" target="_blank" rel="noreferrer">ADCB fees <ExternalLink size={12} /></a>}</div><details className="bank-documents" id={index === 0 ? 'bank-document-requirements' : undefined}><summary data-testid={`button-bank-documents-${index}`}>Starting document checklist <ChevronDown size={15} /></summary><ul>{bank.docs.map((doc, docIndex) => { const id = `${index}-${docIndex}`; return <li key={doc}><label><input type="checkbox" checked={Boolean(checked[id])} onChange={() => toggleDoc(id)} data-testid={`check-bank-document-${id}`} /><span className="check-visual"><Check size={12} /></span><span>{doc}</span></label></li>; })}</ul><p className="bank-note">This is a preparation list, not the bank’s confirmed requirement. Ask the bank for its current checklist.</p></details></article>)}</div>
        <p className="module-footnote"><MapPin size={14} />Use the official links to confirm current eligibility, documents, fees, minimum balance and promotions. A suggested starting point is not an approval or financial recommendation.</p>
      </div>}
      {active === 'housing' && <div className="module-content">
        <div className="module-title-row"><div><DemoTag /><h3>Compare Abu Dhabi areas by fit</h3><p>Start with your work or school location, rent budget and preferred commute.</p></div><span className="module-count">06 areas</span></div>
        <div className="neighbourhood-grid">{neighbourhoods.map((area, index) => <article className="neighbourhood-card" key={area.name} data-testid={`card-neighbourhood-${index}`}><span className="neighbourhood-index">0{index + 1}</span><h4>{area.name}</h4><strong>{area.fit}</strong><p>{area.tradeoff}</p><a href={area.link} target="_blank" rel="noreferrer">Check current listings and area details <ExternalLink size={12} /></a></article>)}</div>
        <p className="module-footnote"><MapPin size={14} />These are first-pass area profiles, not a live rental feed. Check current rent, viewing availability, peak commute, tenancy terms and Tawtheeq requirements before paying.</p>
      </div>}
      {active === 'sim' && <div className="module-content"><div className="module-title-row"><div><DemoTag /><h3>Get connected when you land</h3><p>Compare airport pickup with setting up an eSIM before you travel.</p></div><span className="module-count">03 providers</span></div><div className="sim-list">{simProviders.map((item, index) => <article className="sim-card" key={item.name} data-testid={`card-sim-${index}`}><div className="sim-provider-mark">{item.name === 'Virgin Mobile' ? 'VM' : item.name}</div><div className="sim-plan-copy"><span className="sim-plan-label">{item.plan}</span><strong>{item.data}</strong><small>{item.detail}</small><a className="sim-provider-link" href={item.url} target="_blank" rel="noreferrer">Official plans <ExternalLink size={12} /></a></div><div className="sim-price">{item.price}<small>check provider</small></div></article>)}</div><p className="sim-convert-note">Ask whether you can keep your visitor number when moving to a resident plan. e&amp; says its Visitor Line can migrate at an outlet with a new Emirates ID; confirm the current process with your provider.</p><p className="module-footnote">Offers, validity and eligibility change. Check device compatibility, current requirements and whether a visitor number can be retained before choosing.</p></div>}
      {active === 'jobs' && <div className="module-content"><div className="module-title-row"><div><DemoTag /><h3>Local role ideas, shaped for exploration</h3><p>Locally generated demo suggestions. These are not live vacancies or model output.</p></div><button className="refresh-ideas" type="button" onClick={() => setJobOffset(value => (value + 1) % jobIdeas.length)} data-testid="button-refresh-job-ideas"><RefreshCw size={15} />More ideas</button></div><div className="job-idea-grid" aria-live="polite" data-testid="list-job-ideas">{visibleJobs.map((job, index) => <article className="job-idea" key={`${job.title}-${index}`} data-testid={`card-job-idea-${index}`}><div className="job-idea-top"><span>{job.field}</span><Sparkles size={15} /></div><h4>{job.title}</h4><p>{job.fit}</p></article>)}</div><p className="module-footnote">Use these synthetic ideas to explore job titles and skills. No vacancies are searched or checked.</p></div>}
      {active === 'events' && <div className="module-content"><div className="module-title-row"><div><DemoTag /><h3>Ten ways to picture your weekends</h3><p>Synthetic local outing ideas, with free and paid options clearly marked.</p></div><span className="module-count">10 ideas</span></div><div className="event-grid">{events.map((event, index) => <article className="event-card" key={event.name} data-testid={`card-event-${index}`}><div className="event-card-top"><span className="event-type">{event.type}</span><span className={`event-price ${event.price === 'Free' ? 'is-free' : 'is-paid'}`}>{event.price === 'Free' ? 'Free' : `Paid · ${event.price}`}</span></div><h4>{event.name}</h4><p>{event.when}</p></article>)}</div><p className="module-footnote">All ten items are fictional examples; paid prices are illustrative AED amounts, not listings.</p></div>}
      {active === 'transport' && <div className="module-content"><div className="module-title-row"><div><DemoTag /><h3>Everyday transport costs, side by side</h3><p>Example ranges in AED to help frame your first conversations.</p></div><span className="module-count">AED guide</span></div><div className="transport-table-wrap"><table className="transport-table"><caption className="sr-only">Illustrative transport cost ranges in Abu Dhabi dirhams</caption><thead><tr><th scope="col">Option</th><th scope="col">Example use</th><th scope="col">Sample range</th></tr></thead><tbody>{transport.map((row, index) => <tr key={row.mode} data-testid={`row-transport-${index}`}><th scope="row">{row.mode}</th><td>{row.example}</td><td>{row.low}–{row.high}</td></tr>)}</tbody></table></div><div className="transport-disclaimer" role="note">Illustrative data only. Fares and costs can vary with route, time, demand and provider. Confirm current prices locally.</div></div>}
    </div>
    <div className="demo-hub-endnote">Your move plan above remains your personalized checklist. These demo modules are separate, local examples.</div>
    <span className="sr-only" aria-live="polite" data-testid="status-demo-active-module">{modules[activeIndex].label} demo module selected</span>
  </section>;
}
