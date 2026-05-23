/**
 * BLOG / NEWSLETTER POSTS.
 * Add new posts by pushing to POSTS. Categories drive the column layout on /blog.
 *
 * @typedef {Object} Post
 * @property {string} id
 * @property {'ai'|'quant'|'research'|'gems'} category
 * @property {string} title
 * @property {string} dek       - Subtitle / deck
 * @property {string} date      - ISO date
 * @property {string} readMin   - e.g. "6 min"
 * @property {Block[]} blocks   - Long-form content
 * @property {string[]} [tags]
 * @property {boolean} [featured]
 */

/**
 * @typedef {Object} Block
 * @property {'h2'|'h3'|'p'|'lead'|'quote'|'list'|'code'|'hr'|'pull'} kind
 * @property {string} [text]
 * @property {string[]} [items]
 * @property {string} [lang]
 * @property {string} [cite]
 */

/** @type {Post[]} */
export const POSTS = [
  {
    id: "edge-inference-2026",
    category: "ai",
    title: "The quiet revolution in edge inference",
    dek: "Why the interesting work in AI this year isn't happening in datacenters.",
    date: "2026-04-12",
    readMin: "9 min",
    featured: true,
    tags: ["inference", "edge", "arm"],
    blocks: [
      { kind: "lead", text: "Every press release is about a bigger model. Every interesting engineering story is about a smaller one." },
      { kind: "p", text: "In the last six months, three shifts have compounded: NPUs in every mid-range phone, quantization that actually preserves behavior below 4 bits, and inference runtimes that finally respect memory hierarchy. Individually, each is a footnote. Together they change what an application can assume about its environment." },
      { kind: "h2", text: "What changed, concretely" },
      { kind: "p", text: "A year ago, running a competent 7B model on a $200 SBC was a party trick — minutes to first token, RAM pinned, thermal throttling inside of a paragraph. Today it is <i>routine</i>, and the bottleneck has moved to storage bandwidth, which is a much more tractable problem." },
      { kind: "list", items: [
        "<b>Mixed-precision kernels</b> that downshift at runtime under thermal pressure without model reload.",
        "<b>KV-cache paging</b> over NVMe with prefetch hints from the decoder's own attention pattern.",
        "<b>Tokenizer fast-paths</b> that skip Python entirely — often the biggest single win.",
      ]},
      { kind: "pull", text: "The most interesting inference work of 2026 fits on a device you can put in your pocket." },
      { kind: "h2", text: "What to watch" },
      { kind: "p", text: "The sleeper trend is <i>locality-aware routing</i>: fleets of tiny models that hand queries to each other based on context, with a larger model invoked only as a fallback. The economics are brutal — a $0.02 API call collapses to nearly zero when 80% of it runs on-device." },
      { kind: "h3", text: "My bet" },
      { kind: "p", text: "Within eighteen months, the default assumption for a consumer ML feature will be that it runs locally, and calling out to a server will be the exception that demands justification." },
    ],
  },
  {
    id: "latency-as-ux",
    category: "ai",
    title: "Latency is the new UX",
    dek: "Below 100ms, interfaces feel like thought. Above it, they feel like websites.",
    date: "2026-04-05",
    readMin: "5 min",
    tags: ["ux", "inference"],
    blocks: [
      { kind: "lead", text: "There is a line, somewhere around the blink rate, below which software stops feeling like software." },
      { kind: "p", text: "It is the reason local-first apps feel faster than their cloud equivalents even when the cloud one is, on paper, more capable. It is the reason <i>streaming</i> tokens matters more than total throughput. It is why I have mostly given up on apps that put a network round-trip between me and the thing I asked for." },
      { kind: "h2", text: "The 100ms budget" },
      { kind: "p", text: "You have roughly a hundred milliseconds to respond to an input before the user's attention starts to audit you. Not finish — just respond. A skeleton, a cursor, a character, anything. This is old news in game dev and new news in LLM-land." },
    ],
  },
  {
    id: "market-making-rewrite",
    category: "quant",
    title: "I rewrote my market-maker in Rust. Here's what I learned.",
    dek: "Spoiler: the wins weren't where I expected.",
    date: "2026-03-28",
    readMin: "12 min",
    tags: ["rust", "hft", "performance"],
    blocks: [
      { kind: "lead", text: "Every rewrite post has the same arc, and this one is no exception, except for the parts that were surprising." },
      { kind: "p", text: "The conventional wisdom says: rewrite in Rust for performance. In my case the performance gains were real but modest — maybe 1.3× on the hot path. The real wins were elsewhere." },
      { kind: "h2", text: "Borrow checker as type designer" },
      { kind: "p", text: "Forced to think about ownership of an order from creation to acknowledgement, I discovered my Python code was implicitly moving orders through at least four owners with no clear handoff. The Rust rewrite made that a compile error. I caught two latent race conditions this way before writing a single test." },
    ],
  },
  {
    id: "vol-surface-regime",
    category: "quant",
    title: "Vol surface regime-switching with HMMs",
    dek: "A small model that quietly outperforms big ones.",
    date: "2026-03-14",
    readMin: "8 min",
    tags: ["vol", "hmm"],
    blocks: [
      { kind: "p", text: "The entire field has been chasing transformers on order-book data. Meanwhile a three-state HMM on realized-vol quantiles has been sitting there, posting Sharpe." },
    ],
  },
  {
    id: "sparse-attention-rediscovered",
    category: "research",
    title: "Sparse attention keeps getting rediscovered",
    dek: "A tour through five papers proposing the same idea with different Greek letters.",
    date: "2026-04-02",
    readMin: "7 min",
    tags: ["attention", "sparsity"],
    blocks: [
      { kind: "lead", text: "At this point <i>every</i> sparse-attention paper is a rediscovery. The question is what the rediscovery adds." },
      { kind: "p", text: "This week I read five. Three of them are identical. One of them is clearly better but will be forgotten. One of them is wrong in an interesting way." },
    ],
  },
  {
    id: "papers-i-reread",
    category: "research",
    title: "Five papers I re-read every year",
    dek: "Not the famous ones. The ones that taught me how to think.",
    date: "2026-02-18",
    readMin: "10 min",
    tags: ["reading list"],
    blocks: [
      { kind: "p", text: "Most papers are transactional: you read them, extract the finding, move on. A few are different — they reshape how you approach a problem. Here are mine." },
    ],
  },
  {
    id: "hidden-gem-lapce",
    category: "gems",
    title: "Hidden gem: lapce",
    dek: "A Rust-native editor that deserves more attention than it gets.",
    date: "2026-03-20",
    readMin: "4 min",
    tags: ["editors", "rust"],
    blocks: [
      { kind: "p", text: "Everyone defaults to VS Code and a handful defect to Zed. lapce sits in the corner being quietly excellent." },
    ],
  },
  {
    id: "gem-ast-grep",
    category: "gems",
    title: "Hidden gem: ast-grep",
    dek: "grep for people who are tired of regex.",
    date: "2026-03-01",
    readMin: "3 min",
    tags: ["tools"],
    blocks: [
      { kind: "p", text: "Structural search for code. It is not new, but it is underused. If you refactor regularly and you are still using regex, you are paying a tax you don't need to." },
    ],
  },
  {
    id: "gem-zed-vim",
    category: "gems",
    title: "Hidden gem: zed's vim mode",
    dek: "The first vim emulation I've been able to live in full-time.",
    date: "2026-02-08",
    readMin: "3 min",
    tags: ["editors"],
    blocks: [
      { kind: "p", text: "A short appreciation post." },
    ],
  },
];
