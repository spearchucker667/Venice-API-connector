export type PromptStarterCategory =
  | "writing"
  | "coding"
  | "learning"
  | "research"
  | "creative"
  | "productivity"
  | "analysis"
  | "image"
  | "audio"
  | "music"
  | "embeddings";

export interface PromptStarter {
  id: string;
  translationKey: `promptStarters.${string}`;
  fallbackPrompt: string;
  category: PromptStarterCategory;
  tags?: string[];
}

export const PROMPT_STARTERS: PromptStarter[] = [
  // --- writing (12 items) ---
  {
    id: "writing-rsa-email",
    translationKey: "promptStarters.writing-rsa-email",
    fallbackPrompt:
      "Draft a polite but firm email asking my landlord to fix the heating.",
    category: "writing",
    tags: ["email", "landlord", "formal"],
  },
  {
    id: "writing-cover-letter",
    translationKey: "promptStarters.writing-cover-letter",
    fallbackPrompt:
      "Write a tailored cover letter template for a Senior Full Stack Engineer role focusing on remote collaboration.",
    category: "writing",
    tags: ["career", "cover-letter", "professional"],
  },
  {
    id: "writing-scifi-hook",
    translationKey: "promptStarters.writing-scifi-hook",
    fallbackPrompt:
      "Compose a compelling opening hook for a sci-fi novel where gravity behaves differently in every city.",
    category: "writing",
    tags: ["creative-writing", "sci-fi", "fiction"],
  },
  {
    id: "writing-newsletter-intro",
    translationKey: "promptStarters.writing-newsletter-intro",
    fallbackPrompt:
      "Draft a engaging newsletter introduction discussing the societal impacts of autonomous agent fleets.",
    category: "writing",
    tags: ["newsletter", "marketing", "agents"],
  },
  {
    id: "writing-press-release",
    translationKey: "promptStarters.writing-press-release",
    fallbackPrompt:
      "Create a formal press release template announcing the open-sourcing of a privacy-first web scraper.",
    category: "writing",
    tags: ["pr", "open-source", "marketing"],
  },
  {
    id: "writing-linkedin-post",
    translationKey: "promptStarters.writing-linkedin-post",
    fallbackPrompt:
      "Draft a professional LinkedIn post summarizing key lessons learned from building an offline-first Electron application.",
    category: "writing",
    tags: ["career", "social-media", "developer"],
  },
  {
    id: "writing-blog-outline",
    translationKey: "promptStarters.writing-blog-outline",
    fallbackPrompt:
      "Generate a detailed outline for a technical blog post titled 'Securing Preload Bridges in Modern Electron Apps'.",
    category: "writing",
    tags: ["blog", "outline", "security"],
  },
  {
    id: "writing-sabbatical-request",
    translationKey: "promptStarters.writing-sabbatical-request",
    fallbackPrompt:
      "Write a professional proposal requesting a 3-month educational sabbatical to study distributed systems.",
    category: "writing",
    tags: ["formal", "career", "sabbatical"],
  },
  {
    id: "writing-speech-intro",
    translationKey: "promptStarters.writing-speech-intro",
    fallbackPrompt:
      "Write a 3-minute introductory speech on the importance of local-first software and data sovereignty.",
    category: "writing",
    tags: ["speech", "local-first", "presentation"],
  },
  {
    id: "writing-bug-report",
    translationKey: "promptStarters.writing-bug-report",
    fallbackPrompt:
      "Write a thorough template for a bug report in an open-source project to encourage fast resolution.",
    category: "writing",
    tags: ["developer", "bug-report", "template"],
  },
  {
    id: "writing-refusal-letter",
    translationKey: "promptStarters.writing-refusal-letter",
    fallbackPrompt:
      "Draft a professional response declining a vendor proposal while keeping the door open for future collaboration.",
    category: "writing",
    tags: ["formal", "business", "negotiation"],
  },
  {
    id: "writing-haiku-comp",
    translationKey: "promptStarters.writing-haiku-comp",
    fallbackPrompt:
      "Compose three haikus capturing the transition from analog hardware to quantum computation.",
    category: "writing",
    tags: ["poetry", "creative"],
  },

  // --- coding (12 items) ---
  {
    id: "coding-rest-graphql",
    translationKey: "promptStarters.coding-rest-graphql",
    fallbackPrompt: "Compare REST and GraphQL — when does each shine?",
    category: "coding",
    tags: ["api", "rest", "graphql", "comparison"],
  },
  {
    id: "coding-debounce-ts",
    translationKey: "promptStarters.coding-debounce-ts",
    fallbackPrompt:
      "Write a robust, fully-typed debounce hook in TypeScript for React with support for immediate invocation.",
    category: "coding",
    tags: ["typescript", "react", "hooks"],
  },
  {
    id: "coding-sql-recursive",
    translationKey: "promptStarters.coding-sql-recursive",
    fallbackPrompt:
      "Explain how recursive CTEs work in SQL with an example of querying an organizational hierarchy.",
    category: "coding",
    tags: ["sql", "database", "query"],
  },
  {
    id: "coding-refactor-lru",
    translationKey: "promptStarters.coding-refactor-lru",
    fallbackPrompt:
      "Refactor a simple Node.js memory cache into a thread-safe LRU cache with expiration support.",
    category: "coding",
    tags: ["nodejs", "caching", "refactoring"],
  },
  {
    id: "coding-rust-error",
    translationKey: "promptStarters.coding-rust-error",
    fallbackPrompt:
      "Show how to implement custom error handling in Rust using the `thiserror` and `anyhow` crates.",
    category: "coding",
    tags: ["rust", "error-handling", "backend"],
  },
  {
    id: "coding-git-bisect",
    translationKey: "promptStarters.coding-git-bisect",
    fallbackPrompt:
      "Explain how to use `git bisect` to locate a regression commit, including automated script execution.",
    category: "coding",
    tags: ["git", "debugging", "workflow"],
  },
  {
    id: "coding-docker-multi",
    translationKey: "promptStarters.coding-docker-multi",
    fallbackPrompt:
      "Create a minimal, secure multi-stage Dockerfile for packaging a TypeScript Node.js microservice.",
    category: "coding",
    tags: ["docker", "devops", "typescript"],
  },
  {
    id: "coding-csp-rules",
    translationKey: "promptStarters.coding-csp-rules",
    fallbackPrompt:
      "Write a strict Content Security Policy (CSP) header configuration that allows local WASM execution but blocks inline eval.",
    category: "coding",
    tags: ["security", "csp", "web"],
  },
  {
    id: "coding-vitest-mocking",
    translationKey: "promptStarters.coding-vitest-mocking",
    fallbackPrompt:
      "Demonstrate how to mock global window objects and asynchronous fetch calls in Vitest.",
    category: "coding",
    tags: ["testing", "vitest", "mocking"],
  },
  {
    id: "coding-css-flex-grid",
    translationKey: "promptStarters.coding-css-flex-grid",
    fallbackPrompt:
      "Explain the architectural differences between CSS Grid and Flexbox layouts, with specific layout use cases for each.",
    category: "coding",
    tags: ["css", "frontend", "layout"],
  },
  {
    id: "coding-sse-parse",
    translationKey: "promptStarters.coding-sse-parse",
    fallbackPrompt:
      "Show how to write a stream parser for Server-Sent Events (SSE) in vanilla JavaScript without external dependencies.",
    category: "coding",
    tags: ["javascript", "streaming", "sse"],
  },
  {
    id: "coding-indexeddb-transaction",
    translationKey: "promptStarters.coding-indexeddb-transaction",
    fallbackPrompt:
      "Provide an example of robust transaction management and error rollback in browser-native IndexedDB.",
    category: "coding",
    tags: ["indexeddb", "javascript", "storage"],
  },

  // --- learning (12 items) ---
  {
    id: "learning-rsa-metaphor",
    translationKey: "promptStarters.learning-rsa-metaphor",
    fallbackPrompt:
      "Explain how RSA encryption works using a metaphor a 10-year-old could grasp.",
    category: "learning",
    tags: ["cryptography", "rsa", "explanation"],
  },
  {
    id: "learning-pid-controller",
    translationKey: "promptStarters.learning-pid-controller",
    fallbackPrompt:
      "Explain the mathematics behind a PID temperature controller in simple, intuitive terms.",
    category: "learning",
    tags: ["math", "engineering", "control-systems"],
  },
  {
    id: "learning-monad-metaphor",
    translationKey: "promptStarters.learning-monad-metaphor",
    fallbackPrompt:
      "Explain what a Monad is in functional programming using an everyday real-world analogy.",
    category: "learning",
    tags: ["functional-programming", "explanation", "coding"],
  },
  {
    id: "learning-special-relativity",
    translationKey: "promptStarters.learning-special-relativity",
    fallbackPrompt:
      "What is time dilation in special relativity? Explain it using a thought experiment involving clocks.",
    category: "learning",
    tags: ["physics", "relativity", "space"],
  },
  {
    id: "learning-inflation-basics",
    translationKey: "promptStarters.learning-inflation-basics",
    fallbackPrompt:
      "Explain how central banks use interest rates to control inflation and what economic tradeoffs are involved.",
    category: "learning",
    tags: ["economics", "finance", "explanation"],
  },
  {
    id: "learning-photosynthesis",
    translationKey: "promptStarters.learning-photosynthesis",
    fallbackPrompt:
      "Describe the light-dependent reactions of photosynthesis as a step-by-step assembly line process.",
    category: "learning",
    tags: ["biology", "science", "education"],
  },
  {
    id: "learning-platonic-cave",
    translationKey: "promptStarters.learning-platonic-cave",
    fallbackPrompt:
      "Explain Plato's Allegory of the Cave and discuss how it relates to modern social media echo chambers.",
    category: "learning",
    tags: ["philosophy", "history", "allegory"],
  },
  {
    id: "learning-blockchain-proof",
    translationKey: "promptStarters.learning-blockchain-proof",
    fallbackPrompt:
      "Explain the difference between Proof of Work and Proof of Stake consensus algorithms without using tech jargon.",
    category: "learning",
    tags: ["blockchain", "consensus", "cryptocurrency"],
  },
  {
    id: "learning-turing-complete",
    translationKey: "promptStarters.learning-turing-complete",
    fallbackPrompt:
      "What does it mean for a system to be 'Turing Complete'? Give a simple explanation and a non-obvious example.",
    category: "learning",
    tags: ["computer-science", "theory"],
  },
  {
    id: "learning-habermas-public",
    translationKey: "promptStarters.learning-habermas-public",
    fallbackPrompt:
      "Summarize Jürgen Habermas's concept of the 'Public Sphere' and its relevance to the internet era.",
    category: "learning",
    tags: ["sociology", "political-theory", "philosophy"],
  },
  {
    id: "learning-plate-tectonics",
    translationKey: "promptStarters.learning-plate-tectonics",
    fallbackPrompt:
      "How do plate tectonics drive volcanic activity? Explain the differences between subduction zones and hot spots.",
    category: "learning",
    tags: ["geology", "earth-science"],
  },
  {
    id: "learning-music-scales",
    translationKey: "promptStarters.learning-music-scales",
    fallbackPrompt:
      "Explain the relationship between mathematical frequencies and musical scales or harmony.",
    category: "learning",
    tags: ["music", "math", "physics"],
  },

  // --- research (12 items) ---
  {
    id: "research-fusion-status",
    translationKey: "promptStarters.research-fusion-status",
    fallbackPrompt:
      "What are the latest milestones and remaining engineering barriers in commercial nuclear fusion energy research?",
    category: "research",
    tags: ["energy", "nuclear", "physics"],
  },
  {
    id: "research-dns-sec",
    translationKey: "promptStarters.research-dns-sec",
    fallbackPrompt:
      "Analyze the security vulnerabilities of the traditional DNS protocol and how DNSSEC addresses them.",
    category: "research",
    tags: ["dns", "security", "protocols"],
  },
  {
    id: "research-solid-battery",
    translationKey: "promptStarters.research-solid-battery",
    fallbackPrompt:
      "Summarize the current state of solid-state battery technology for electric vehicles, focusing on energy density and lifecycle.",
    category: "research",
    tags: ["batteries", "ev", "materials"],
  },
  {
    id: "research-roman-concrete",
    translationKey: "promptStarters.research-roman-concrete",
    fallbackPrompt:
      "Investigate the chemical formulation of ancient Roman marine concrete and why it outlasts modern Portland cement.",
    category: "research",
    tags: ["materials-science", "history", "chemistry"],
  },
  {
    id: "research-browser-privacy",
    translationKey: "promptStarters.research-browser-privacy",
    fallbackPrompt:
      "Compare the privacy protection mechanisms of third-party cookie blocking, browser fingerprinting defense, and partitioning.",
    category: "research",
    tags: ["privacy", "browser", "security"],
  },
  {
    id: "research-green-hydrogen",
    translationKey: "promptStarters.research-green-hydrogen",
    fallbackPrompt:
      "Analyze the energetic and economic efficiency of green hydrogen production compared to direct battery electrification.",
    category: "research",
    tags: ["hydrogen", "clean-tech", "economics"],
  },
  {
    id: "research-graphene-scaling",
    translationKey: "promptStarters.research-graphene-scaling",
    fallbackPrompt:
      "What are the current manufacturing limitations preventing the scaling of monolayer graphene for commercial electronics?",
    category: "research",
    tags: ["graphene", "semiconductors", "scaling"],
  },
  {
    id: "research-zero-knowledge",
    translationKey: "promptStarters.research-zero-knowledge",
    fallbackPrompt:
      "Compare zk-SNARKs and zk-STARKs in terms of trusted setup requirements, proof size, and computational overhead.",
    category: "research",
    tags: ["cryptography", "zero-knowledge", "zk"],
  },
  {
    id: "research-microbiome-brain",
    translationKey: "promptStarters.research-microbiome-brain",
    fallbackPrompt:
      "Summarize the primary biological pathways connecting the human gut microbiome to central nervous system functions.",
    category: "research",
    tags: ["biology", "medicine", "microbiome"],
  },
  {
    id: "research-deep-sea-mining",
    translationKey: "promptStarters.research-deep-sea-mining",
    fallbackPrompt:
      "What are the environmental and economic stakes of deep-sea polymetallic nodule mining in international waters?",
    category: "research",
    tags: ["oceanography", "mining", "ecology"],
  },
  {
    id: "research-compiler-optimizations",
    translationKey: "promptStarters.research-compiler-optimizations",
    fallbackPrompt:
      "Investigate how loop unrolling, dead-code elimination, and register allocation optimization work inside compilers.",
    category: "research",
    tags: ["compilers", "computer-science", "optimization"],
  },
  {
    id: "research-cfc-ozone",
    translationKey: "promptStarters.research-cfc-ozone",
    fallbackPrompt:
      "Trace the historical timeline and chemical process of the ozone layer recovery following the Montreal Protocol.",
    category: "research",
    tags: ["environment", "chemistry", "history"],
  },

  // --- creative (12 items) ---
  {
    id: "creative-llm-pi-projects",
    translationKey: "promptStarters.creative-llm-pi-projects",
    fallbackPrompt:
      "Brainstorm five novel side-project ideas using LLMs and a Raspberry Pi.",
    category: "creative",
    tags: ["iot", "raspberry-pi", "llm", "side-project"],
  },
  {
    id: "creative-time-travel-game",
    translationKey: "promptStarters.creative-time-travel-game",
    fallbackPrompt:
      "Design the core gameplay loop for an investigative puzzle game centered on recursive time travel paradoxes.",
    category: "creative",
    tags: ["game-design", "puzzle", "time-travel"],
  },
  {
    id: "creative-steampunk-ai",
    translationKey: "promptStarters.creative-steampunk-ai",
    fallbackPrompt:
      "Write a short conceptual description of a steampunk city where municipal decisions are routed through mechanical differential analyzers.",
    category: "creative",
    tags: ["world-building", "steampunk", "creative"],
  },
  {
    id: "creative-product-name",
    translationKey: "promptStarters.creative-product-name",
    fallbackPrompt:
      "Brainstorm ten distinct, evocative brand names for a localized, peer-to-peer mesh networking utility.",
    category: "creative",
    tags: ["branding", "mesh-network", "marketing"],
  },
  {
    id: "creative-card-game",
    translationKey: "promptStarters.creative-card-game",
    fallbackPrompt:
      "Create the rules and win conditions for a micro card game played with only 18 cards themed around network routing.",
    category: "creative",
    tags: ["game-design", "tabletop", "networking"],
  },
  {
    id: "creative-synth-podcast",
    translationKey: "promptStarters.creative-synth-podcast",
    fallbackPrompt:
      "Outline a pitch for a fictional audio drama podcast detailing the diary entries of a stranded deep-space communication buoy.",
    category: "creative",
    tags: ["podcasting", "sci-fi", "storytelling"],
  },
  {
    id: "creative-culinary-fusion",
    translationKey: "promptStarters.creative-culinary-fusion",
    fallbackPrompt:
      "Invent five creative fusion dishes blending traditional Japanese fermentation techniques with Mexican street food concepts.",
    category: "creative",
    tags: ["culinary", "creative", "recipes"],
  },
  {
    id: "creative-speculative-ui",
    translationKey: "promptStarters.creative-speculative-ui",
    fallbackPrompt:
      "Describe an innovative user interface design for managing personal privacy policies using a spatial 3D node canvas.",
    category: "creative",
    tags: ["ux", "ui-design", "speculative"],
  },
  {
    id: "creative-robot-sports",
    translationKey: "promptStarters.creative-robot-sports",
    fallbackPrompt:
      "Brainstorm a brand new sport designed specifically to showcase the coordination limits of legged robotics and drones.",
    category: "creative",
    tags: ["sports", "robotics", "drones"],
  },
  {
    id: "creative-magic-system",
    translationKey: "promptStarters.creative-magic-system",
    fallbackPrompt:
      "Design a fantasy magic system where spellcasting is constrained by thermodynamic laws and conservation of momentum.",
    category: "creative",
    tags: ["world-building", "fantasy", "magic"],
  },
  {
    id: "creative-smart-mirror",
    translationKey: "promptStarters.creative-smart-mirror",
    fallbackPrompt:
      "Brainstorm three creative applications for a smart mirror that interacts with local calendar and ambient weather APIs.",
    category: "creative",
    tags: ["iot", "smart-home", "ideas"],
  },
  {
    id: "creative-metaphor-database",
    translationKey: "promptStarters.creative-metaphor-database",
    fallbackPrompt:
      "Create an extended metaphor comparing database normalization to organizing a sprawling municipal library.",
    category: "creative",
    tags: ["writing", "analogy", "database"],
  },

  // --- productivity (12 items) ---
  {
    id: "productivity-time-box",
    translationKey: "promptStarters.productivity-time-box",
    fallbackPrompt:
      "Create a customizable weekly time-blocking template optimized for deep-work software development schedules.",
    category: "productivity",
    tags: ["time-management", "deep-work", "schedule"],
  },
  {
    id: "productivity-meeting-agenda",
    translationKey: "promptStarters.productivity-meeting-agenda",
    fallbackPrompt:
      "Draft an agenda template for a weekly async-first engineering sync aimed at resolving architectural bottlenecks.",
    category: "productivity",
    tags: ["meetings", "async", "management"],
  },
  {
    id: "productivity-habit-stack",
    translationKey: "promptStarters.productivity-habit-stack",
    fallbackPrompt:
      "Design a 30-day habit-stacking framework for transitioning into a consistent morning exercise and reading routine.",
    category: "productivity",
    tags: ["habits", "self-improvement", "framework"],
  },
  {
    id: "productivity-notion-layout",
    translationKey: "promptStarters.productivity-notion-layout",
    fallbackPrompt:
      "Outline the database schema and layout structure for a Notion workspace designed to track personal knowledge and bookmarks.",
    category: "productivity",
    tags: ["notion", "knowledge-base", "organization"],
  },
  {
    id: "productivity-prioritization",
    translationKey: "promptStarters.productivity-prioritization",
    fallbackPrompt:
      "Explain how to apply the Eisenhower Matrix to prioritize tasks as an engineering manager with conflicting priorities.",
    category: "productivity",
    tags: ["management", "prioritization", "decision-making"],
  },
  {
    id: "productivity-onboarding",
    translationKey: "promptStarters.productivity-onboarding",
    fallbackPrompt:
      "Create a checklist for onboarding a new remote software engineer to a complex legacy monolithic codebase.",
    category: "productivity",
    tags: ["onboarding", "career", "checklist"],
  },
  {
    id: "productivity-markdown-journal",
    translationKey: "promptStarters.productivity-markdown-journal",
    fallbackPrompt:
      "Design a lightweight daily markdown journaling prompt system that helps track daily goals, blockers, and gratitudes.",
    category: "productivity",
    tags: ["journaling", "markdown", "habits"],
  },
  {
    id: "productivity-inbox-zero",
    translationKey: "promptStarters.productivity-inbox-zero",
    fallbackPrompt:
      "Draft a step-by-step system for achieving and maintaining Inbox Zero using automated labels and keyboard shortcuts.",
    category: "productivity",
    tags: ["email", "productivity", "system"],
  },
  {
    id: "productivity-postmortem",
    translationKey: "promptStarters.productivity-postmortem",
    fallbackPrompt:
      "Create a standard template for writing software postmortems after a critical production outage.",
    category: "productivity",
    tags: ["devops", "incident-management", "template"],
  },
  {
    id: "productivity-learning-sprint",
    translationKey: "promptStarters.productivity-learning-sprint",
    fallbackPrompt:
      "Outline a 4-week learning sprint plan to master the fundamentals of Rust WebAssembly compilation.",
    category: "productivity",
    tags: ["learning-plan", "rust", "wasm"],
  },
  {
    id: "productivity-presentation-deck",
    translationKey: "promptStarters.productivity-presentation-deck",
    fallbackPrompt:
      "Draft a slide-by-slide structure for a 10-minute presentation pitch to secure seed funding for a local LLM client.",
    category: "productivity",
    tags: ["pitch", "presentation", "business"],
  },
  {
    id: "productivity-dependency-audit",
    translationKey: "promptStarters.productivity-dependency-audit",
    fallbackPrompt:
      "Create an action plan for conducting a monthly audit of open-source library dependencies in a production code repository.",
    category: "productivity",
    tags: ["security", "dependency-audit", "devops"],
  },

  // --- analysis (12 items) ---
  {
    id: "analysis-p2p-mesh",
    translationKey: "promptStarters.analysis-p2p-mesh",
    fallbackPrompt:
      "Conduct a SWOT analysis of deploying a decentralized peer-to-peer mesh network in high-density urban areas.",
    category: "analysis",
    tags: ["swot", "networking", "mesh"],
  },
  {
    id: "analysis-sqlite-pg",
    translationKey: "promptStarters.analysis-sqlite-pg",
    fallbackPrompt:
      "Compare the architectural tradeoffs of SQLite vs PostgreSQL for an offline-first desktop application with syncing capabilities.",
    category: "analysis",
    tags: ["database", "sqlite", "postgresql"],
  },
  {
    id: "analysis-fallacy-media",
    translationKey: "promptStarters.analysis-fallacy-media",
    fallbackPrompt:
      "List five common logical fallacies found in modern media reporting and provide guidelines on how to spot them.",
    category: "analysis",
    tags: ["logic", "fallacies", "critical-thinking"],
  },
  {
    id: "analysis-cloud-vs-local",
    translationKey: "promptStarters.analysis-cloud-vs-local",
    fallbackPrompt:
      "Analyze the long-term cost-benefit tradeoffs of cloud-hosted serverless computing vs self-hosted bare metal servers.",
    category: "analysis",
    tags: ["cloud", "bare-metal", "cost-analysis"],
  },
  {
    id: "analysis-electron-tauri",
    translationKey: "promptStarters.analysis-electron-tauri",
    fallbackPrompt:
      "Perform a detailed comparative analysis of Electron vs Tauri in terms of memory footprint, build size, and security models.",
    category: "analysis",
    tags: ["electron", "tauri", "comparison"],
  },
  {
    id: "analysis-monolith-micro",
    translationKey: "promptStarters.analysis-monolith-micro",
    fallbackPrompt:
      "Identify key indicators showing when a growing startup should transition from a monolith to a microservices architecture.",
    category: "analysis",
    tags: ["software-architecture", "startup", "microservices"],
  },
  {
    id: "analysis-privacy-shield",
    translationKey: "promptStarters.analysis-privacy-shield",
    fallbackPrompt:
      "Analyze the legal and technical implications of GDPR compliance requirements on logging and telemetry practices.",
    category: "analysis",
    tags: ["legal", "telemetry", "gdpr"],
  },
  {
    id: "analysis-rsa-vs-ecc",
    translationKey: "promptStarters.analysis-rsa-vs-ecc",
    fallbackPrompt:
      "Perform a comparative technical analysis of RSA vs Elliptic Curve Cryptography (ECC) regarding key sizes and signature speeds.",
    category: "analysis",
    tags: ["cryptography", "rsa", "ecc"],
  },
  {
    id: "analysis-dns-over-https",
    translationKey: "promptStarters.analysis-dns-over-https",
    fallbackPrompt:
      "Analyze the privacy advantages and network performance tradeoffs of adopting DNS-over-HTTPS (DoH).",
    category: "analysis",
    tags: ["dns", "networking", "privacy"],
  },
  {
    id: "analysis-open-licensing",
    translationKey: "promptStarters.analysis-open-licensing",
    fallbackPrompt:
      "Compare the legal conditions, copyleft properties, and commercial usage permissions of MIT vs GPLv3 licenses.",
    category: "analysis",
    tags: ["legal", "licensing", "open-source"],
  },
  {
    id: "analysis-ci-caching",
    translationKey: "promptStarters.analysis-ci-caching",
    fallbackPrompt:
      "Analyze the build time optimizations gained from cache strategies in GitHub Actions CI pipelines.",
    category: "analysis",
    tags: ["ci-cd", "caching", "optimization"],
  },
  {
    id: "analysis-work-automation",
    translationKey: "promptStarters.analysis-work-automation",
    fallbackPrompt:
      "Evaluate the prospective impacts of AI autonomous agent workflows on administrative team productivity and resource demand.",
    category: "analysis",
    tags: ["automation", "workplace", "ai-agents"],
  },
  // --- image (20 items) ---
  {
    id: "image-serene-mountain",
    translationKey: "promptStarters.image-serene-mountain",
    fallbackPrompt:
      "A serene mountain lake at golden hour, low fog over the water, painterly",
    category: "image",
    tags: ["nature", "landscape", "painterly"],
  },
  {
    id: "image-dewdrop-spiderweb",
    translationKey: "promptStarters.image-dewdrop-spiderweb",
    fallbackPrompt:
      "Macro photo of a dewdrop on a spider web, sunrise lighting",
    category: "image",
    tags: ["macro", "nature", "photo"],
  },
  {
    id: "image-cyberpunk-market",
    translationKey: "promptStarters.image-cyberpunk-market",
    fallbackPrompt:
      "Cyberpunk street market at night, neon signs reflecting in puddles",
    category: "image",
    tags: ["cyberpunk", "city", "neon"],
  },
  {
    id: "image-fox-mushroom",
    translationKey: "promptStarters.image-fox-mushroom",
    fallbackPrompt:
      "Children's book illustration of a fox reading a book under a mushroom",
    category: "image",
    tags: ["illustration", "cute", "fantasy"],
  },
  {
    id: "image-steampunk-airship",
    translationKey: "promptStarters.image-steampunk-airship",
    fallbackPrompt:
      "Steampunk airship docking at a floating platform in a cloud-filled sky, vintage illustration style",
    category: "image",
    tags: ["steampunk", "airship", "illustration"],
  },
  {
    id: "image-bioluminescent-forest",
    translationKey: "promptStarters.image-bioluminescent-forest",
    fallbackPrompt:
      "A futuristic bioluminescent forest at night, glowing plants, ethereal blue and purple tones, detailed digital art",
    category: "image",
    tags: ["sci-fi", "nature", "digital-art"],
  },
  {
    id: "image-watercolor-cafe",
    translationKey: "promptStarters.image-watercolor-cafe",
    fallbackPrompt:
      "Vibrant watercolor painting of a bustling European street cafe, sunny day, loose artistic brushstrokes",
    category: "image",
    tags: ["watercolor", "city", "art"],
  },
  {
    id: "image-astronaut-portrait",
    translationKey: "promptStarters.image-astronaut-portrait",
    fallbackPrompt:
      "A close-up portrait of an astronaut looking at Earth, reflection in the visor, hyper-realistic, detailed spacesuit",
    category: "image",
    tags: ["sci-fi", "portrait", "realistic"],
  },
  {
    id: "image-overgrown-ruins",
    translationKey: "promptStarters.image-overgrown-ruins",
    fallbackPrompt:
      "Ancient ruins of a temple overgrown with giant tree roots, afternoon sunbeams piercing through leaves, moody",
    category: "image",
    tags: ["nature", "fantasy", "moody"],
  },
  {
    id: "image-minimalist-desert",
    translationKey: "promptStarters.image-minimalist-desert",
    fallbackPrompt:
      "Minimalist vector art of a desert landscape at night, crescent moon, stars, warm terracotta and dark blue tones",
    category: "image",
    tags: ["vector", "minimalist", "landscape"],
  },
  {
    id: "image-cozy-cabin",
    translationKey: "promptStarters.image-cozy-cabin",
    fallbackPrompt:
      "An oil painting of a cozy cabin in the woods during a winter snowstorm, warm amber light shining from the windows",
    category: "image",
    tags: ["oil-painting", "cozy", "winter"],
  },
  {
    id: "image-floating-island",
    translationKey: "promptStarters.image-floating-island",
    fallbackPrompt:
      "A whimsical floating island with a small lighthouse, surrounded by fluffy white clouds, 3D claymation style",
    category: "image",
    tags: ["claymation", "fantasy", "lighthouse"],
  },
  {
    id: "image-midcentury-abstract",
    translationKey: "promptStarters.image-midcentury-abstract",
    fallbackPrompt:
      "Abstract geometric composition inspired by mid-century modern design, muted retro color palette",
    category: "image",
    tags: ["abstract", "mid-century", "art"],
  },
  {
    id: "image-castle-dragon",
    translationKey: "promptStarters.image-castle-dragon",
    fallbackPrompt:
      "A majestic dragon perched on top of a medieval castle tower, mist, dramatic cinematic lighting",
    category: "image",
    tags: ["fantasy", "dragon", "cinematic"],
  },
  {
    id: "image-surreal-whale",
    translationKey: "promptStarters.image-surreal-whale",
    fallbackPrompt:
      "Surreal digital art of a whale flying through a cloudy sky filled with floating hot air balloons",
    category: "image",
    tags: ["surreal", "fantasy", "digital-art"],
  },
  {
    id: "image-retro-lab",
    translationKey: "promptStarters.image-retro-lab",
    fallbackPrompt:
      "A retro-futuristic laboratory with glass vials of glowing liquid, copper coils, and analog dials, dramatic shadows",
    category: "image",
    tags: ["retro-futuristic", "sci-fi", "lab"],
  },
  {
    id: "image-sketch-cat",
    translationKey: "promptStarters.image-sketch-cat",
    fallbackPrompt:
      "Pencil sketch of a sleepy cat curled up on a stack of old leather-bound books, soft crosshatching",
    category: "image",
    tags: ["sketch", "pencil", "cat"],
  },
  {
    id: "image-coral-reef",
    translationKey: "promptStarters.image-coral-reef",
    fallbackPrompt:
      "A colorful coral reef teeming with exotic fish, sunlight rays filtering through clear turquoise water, underwater photo",
    category: "image",
    tags: ["nature", "underwater", "photo"],
  },
  {
    id: "image-hacker-setup",
    translationKey: "promptStarters.image-hacker-setup",
    fallbackPrompt:
      "Cyberpunk hacker setup with multiple glowing monitors, wires everywhere, dark room with cyber-blue ambient light",
    category: "image",
    tags: ["cyberpunk", "hacker", "setup"],
  },
  {
    id: "image-stained-glass",
    translationKey: "promptStarters.image-stained-glass",
    fallbackPrompt:
      "Stained glass window depicting a tree of life, bright sunlight casting colorful patterns on a stone floor",
    category: "image",
    tags: ["stained-glass", "art", "light"],
  },

  // --- audio (15 items) ---
  {
    id: "audio-welcome-vf",
    translationKey: "promptStarters.audio-welcome-vf",
    fallbackPrompt:
      "Welcome to Venice Forge. The future of voice is here, and it speaks every language.",
    category: "audio",
    tags: ["welcome", "narration"],
  },
  {
    id: "audio-library-book",
    translationKey: "promptStarters.audio-library-book",
    fallbackPrompt:
      "In a quiet town nestled between two mountains, a small library held a very old book.",
    category: "audio",
    tags: ["story", "narration"],
  },
  {
    id: "audio-octopus-brains",
    translationKey: "promptStarters.audio-octopus-brains",
    fallbackPrompt:
      "Did you know? A single octopus has nine brains — one central, plus one in each arm.",
    category: "audio",
    tags: ["fact", "educational"],
  },
  {
    id: "audio-safety-protocols",
    translationKey: "promptStarters.audio-safety-protocols",
    fallbackPrompt:
      "Please ensure all safety protocols are fully engaged before deploying the local LLM agent cluster.",
    category: "audio",
    tags: ["sci-fi", "announcement"],
  },
  {
    id: "audio-quick-brown-fox",
    translationKey: "promptStarters.audio-quick-brown-fox",
    fallbackPrompt:
      "The quick brown fox jumps over the lazy dog. Just a classic vocal test to check all phonetic frequencies.",
    category: "audio",
    tags: ["test", "phonetics"],
  },
  {
    id: "audio-hyperloop-depart",
    translationKey: "promptStarters.audio-hyperloop-depart",
    fallbackPrompt:
      "Attention passengers, the hyperloop transit corridor to the eastern terminal will depart in exactly three minutes.",
    category: "audio",
    tags: ["announcement", "transit"],
  },
  {
    id: "audio-hydrothermal-vents",
    translationKey: "promptStarters.audio-hydrothermal-vents",
    fallbackPrompt:
      "Deep in the ocean, hydrothermal vents support unique ecosystems that never see the light of the sun.",
    category: "audio",
    tags: ["nature", "science"],
  },
  {
    id: "audio-study-stars",
    translationKey: "promptStarters.audio-study-stars",
    fallbackPrompt:
      "To understand the universe, we must study the stars, the atoms, and the space between them.",
    category: "audio",
    tags: ["philosophical", "space"],
  },
  {
    id: "audio-step-forward",
    translationKey: "promptStarters.audio-step-forward",
    fallbackPrompt:
      "A single step forward can change the course of history, provided we know which path we are following.",
    category: "audio",
    tags: ["inspiration", "motivational"],
  },
  {
    id: "audio-digital-archive",
    translationKey: "promptStarters.audio-digital-archive",
    fallbackPrompt:
      "Welcome to the digital archive. Please state your credentials or insert your authorization module.",
    category: "audio",
    tags: ["sci-fi", "security"],
  },
  {
    id: "audio-whispering-leaves",
    translationKey: "promptStarters.audio-whispering-leaves",
    fallbackPrompt:
      "Whispering leaves and distant thunder filled the night air as the autumn storm approached.",
    category: "audio",
    tags: ["poetry", "ambient"],
  },
  {
    id: "audio-getting-started",
    translationKey: "promptStarters.audio-getting-started",
    fallbackPrompt:
      "The secret of getting ahead is getting started, combined with a daily habit of focused work.",
    category: "audio",
    tags: ["productivity", "motivational"],
  },
  {
    id: "audio-compilation-complete",
    translationKey: "promptStarters.audio-compilation-complete",
    fallbackPrompt:
      "Our system has successfully completed the compilation process. All module parameters are nominal.",
    category: "audio",
    tags: ["tech", "notification"],
  },
  {
    id: "audio-kepler-transmission",
    translationKey: "promptStarters.audio-kepler-transmission",
    fallbackPrompt:
      "In the year twenty-two forty-two, humanity received its first verified transmission from the Kepler system.",
    category: "audio",
    tags: ["sci-fi", "story"],
  },
  {
    id: "audio-complex-problem",
    translationKey: "promptStarters.audio-complex-problem",
    fallbackPrompt:
      "For every complex problem, there is a solution that is simple, neat, and completely wrong.",
    category: "audio",
    tags: ["quote", "wit"],
  },

  // --- music (15 items) ---
  {
    id: "music-lofi-hiphop",
    translationKey: "promptStarters.music-lofi-hiphop",
    fallbackPrompt:
      "Lo-fi hip-hop beat with vinyl crackle and rain — 80 bpm, mellow",
    category: "music",
    tags: ["lofi", "relaxing", "hiphop"],
  },
  {
    id: "music-cinematic-orchestral",
    translationKey: "promptStarters.music-cinematic-orchestral",
    fallbackPrompt:
      "Cinematic orchestral build — slow strings rising into triumphant brass",
    category: "music",
    tags: ["cinematic", "orchestral", "epic"],
  },
  {
    id: "music-synthwave-retro",
    translationKey: "promptStarters.music-synthwave-retro",
    fallbackPrompt:
      "Synthwave with retro arpeggios, warm pads, gated reverb drums — 105 bpm",
    category: "music",
    tags: ["synthwave", "retro", "electronic"],
  },
  {
    id: "music-acoustic-folk",
    translationKey: "promptStarters.music-acoustic-folk",
    fallbackPrompt:
      "Acoustic folk fingerpicking, soft female vocals, intimate room sound",
    category: "music",
    tags: ["folk", "acoustic", "vocal"],
  },
  {
    id: "music-indie-pop",
    translationKey: "promptStarters.music-indie-pop",
    fallbackPrompt:
      "Upbeat indie pop track with catchy electric guitar riffs and handclaps — 120 bpm",
    category: "music",
    tags: ["pop", "indie", "cheerful"],
  },
  {
    id: "music-dark-ambient",
    translationKey: "promptStarters.music-dark-ambient",
    fallbackPrompt:
      "Dark ambient drone with slow synth pulses and metallic textures — space atmosphere",
    category: "music",
    tags: ["ambient", "dark", "atmospheric"],
  },
  {
    id: "music-heavy-metal",
    translationKey: "promptStarters.music-heavy-metal",
    fallbackPrompt:
      "80s heavy metal guitar solo, fast double-bass drums, high-energy rock anthem",
    category: "music",
    tags: ["rock", "metal", "energetic"],
  },
  {
    id: "music-jazz-piano",
    translationKey: "promptStarters.music-jazz-piano",
    fallbackPrompt:
      "Relaxing jazz piano trio with upright bass and soft brush drums — late-night lounge",
    category: "music",
    tags: ["jazz", "piano", "smooth"],
  },
  {
    id: "music-industrial-techno",
    translationKey: "promptStarters.music-industrial-techno",
    fallbackPrompt:
      "Cyberpunk industrial techno with distorted basslines and heavy kick drum — 130 bpm",
    category: "music",
    tags: ["techno", "cyberpunk", "club"],
  },
  {
    id: "music-japanese-flute",
    translationKey: "promptStarters.music-japanese-flute",
    fallbackPrompt:
      "Traditional Japanese flute (shakuhachi) with ambient string pads — serene meditation",
    category: "music",
    tags: ["meditation", "ambient", "traditional"],
  },
  {
    id: "music-edm-drop",
    translationKey: "promptStarters.music-edm-drop",
    fallbackPrompt:
      "High-energy EDM drop with progressive synth chords and driving sub-bass — festival style",
    category: "music",
    tags: ["edm", "dance", "festive"],
  },
  {
    id: "music-chillstep",
    translationKey: "promptStarters.music-chillstep",
    fallbackPrompt:
      "Chillout chillstep track with pitch-bent vocal chops and soft sub-bass — 90 bpm",
    category: "music",
    tags: ["chillstep", "electronic", "relaxing"],
  },
  {
    id: "music-delta-blues",
    translationKey: "promptStarters.music-delta-blues",
    fallbackPrompt:
      "Delta blues slide guitar with stompbox rhythm, raw and soulful",
    category: "music",
    tags: ["blues", "guitar", "soulful"],
  },
  {
    id: "music-chiptune-retro",
    translationKey: "promptStarters.music-chiptune-retro",
    fallbackPrompt:
      "Futuristic chiptune 8-bit game music, cheerful melody, retro sound effects",
    category: "music",
    tags: ["chiptune", "game", "retro"],
  },
  {
    id: "music-reggae-dub",
    translationKey: "promptStarters.music-reggae-dub",
    fallbackPrompt:
      "Reggae dub track with heavy offbeat chords, deep bassline, and echo effects",
    category: "music",
    tags: ["reggae", "dub", "groove"],
  },

  // --- embeddings (15 items) ---
  {
    id: "embeddings-fox-dog",
    translationKey: "promptStarters.embeddings-fox-dog",
    fallbackPrompt: "The quick brown fox jumps over the lazy dog.",
    category: "embeddings",
    tags: ["pangram", "classic"],
  },
  {
    id: "embeddings-meaning-vector",
    translationKey: "promptStarters.embeddings-meaning-vector",
    fallbackPrompt:
      "Embeddings turn text into a vector you can search by meaning.",
    category: "embeddings",
    tags: ["concept", "explanation"],
  },
  {
    id: "embeddings-sf-bridges",
    translationKey: "promptStarters.embeddings-sf-bridges",
    fallbackPrompt:
      "San Francisco is a city in northern California known for its fog and bridges.",
    category: "embeddings",
    tags: ["geography", "fact"],
  },
  {
    id: "embeddings-ai-simulation",
    translationKey: "promptStarters.embeddings-ai-simulation",
    fallbackPrompt:
      "Artificial intelligence is the simulation of human intelligence processes by machines.",
    category: "embeddings",
    tags: ["ai", "definition"],
  },
  {
    id: "embeddings-quantum-computing",
    translationKey: "promptStarters.embeddings-quantum-computing",
    fallbackPrompt:
      "Quantum computing utilizes superposition and entanglement to perform complex operations.",
    category: "embeddings",
    tags: ["science", "tech"],
  },
  {
    id: "embeddings-dna-helix",
    translationKey: "promptStarters.embeddings-dna-helix",
    fallbackPrompt:
      "The double-helix structure of DNA was first discovered in 1953 by Watson and Crick.",
    category: "embeddings",
    tags: ["biology", "history"],
  },
  {
    id: "embeddings-db-index",
    translationKey: "promptStarters.embeddings-db-index",
    fallbackPrompt:
      "A database index is a data structure that improves the speed of data retrieval operations.",
    category: "embeddings",
    tags: ["database", "cs"],
  },
  {
    id: "embeddings-clean-code",
    translationKey: "promptStarters.embeddings-clean-code",
    fallbackPrompt:
      "Clean code always looks like it was written by someone who cares.",
    category: "embeddings",
    tags: ["software-engineering", "quote"],
  },
  {
    id: "embeddings-photosynthesis",
    translationKey: "promptStarters.embeddings-photosynthesis",
    fallbackPrompt:
      "Photosynthesis is the process used by plants to convert light energy into chemical energy.",
    category: "embeddings",
    tags: ["biology", "science"],
  },
  {
    id: "embeddings-cryptographic-hash",
    translationKey: "promptStarters.embeddings-cryptographic-hash",
    fallbackPrompt:
      "Cryptographic hash functions map arbitrary binary data to a fixed-size signature.",
    category: "embeddings",
    tags: ["cryptography", "security"],
  },
  {
    id: "embeddings-spacetime-curve",
    translationKey: "promptStarters.embeddings-spacetime-curve",
    fallbackPrompt:
      "The theory of general relativity describes gravity as the curvature of spacetime.",
    category: "embeddings",
    tags: ["physics", "science"],
  },
  {
    id: "embeddings-offline-first",
    translationKey: "promptStarters.embeddings-offline-first",
    fallbackPrompt:
      "In an offline-first application, data is stored locally before syncing to the cloud.",
    category: "embeddings",
    tags: ["local-first", "architecture"],
  },
  {
    id: "embeddings-regex-match",
    translationKey: "promptStarters.embeddings-regex-match",
    fallbackPrompt:
      "Regular expressions are patterns used to match character combinations in strings.",
    category: "embeddings",
    tags: ["programming", "patterns"],
  },
  {
    id: "embeddings-vector-space",
    translationKey: "promptStarters.embeddings-vector-space",
    fallbackPrompt:
      "A vector space is a mathematical structure formed by a collection of vectors.",
    category: "embeddings",
    tags: ["math", "linear-algebra"],
  },
  {
    id: "embeddings-microservices",
    translationKey: "promptStarters.embeddings-microservices",
    fallbackPrompt:
      "Microservices architecture structures an application as a collection of loosely coupled services.",
    category: "embeddings",
    tags: ["architecture", "scale"],
  },
];
