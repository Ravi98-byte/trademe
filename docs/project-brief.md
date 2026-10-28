# AI Nasdaq Futures Trading App — Project Brief

## Vision
Build a serious, polished desktop application for researching, analysing and eventually managing Nasdaq futures trading. It should act like a computer operator with a trading brain: understand the trading environment, retrieve evidence, analyse market conditions and, only after appropriate testing and explicit user approval, potentially interact with a trading platform. Build an extensible, maintainable product, not a throwaway prototype.

## Owner's preferences
- The user is Ravi. Explain decisions and setup in simple language; do not assume extensive development knowledge.
- Initially the app runs on the user's own laptop when opened; it is not expected to run 24/7.
- Aim for a polished desktop interface and a straightforward installer. If Windows is confirmed, package dependencies so end users do not need to install Python separately.
- Deliver the product incrementally as permanent, integrated components of the actual application. Do not represent unimplemented features as operational.
- Discuss important design choices, costs and integration limitations transparently.

## Core capabilities
1. **Knowledge library:** Organise notes, permitted books and documents, transcripts, interviews, research, trader ideas, market history, psychology, prop-firm rules, strategies and lessons from tests. Preserve author, source, link, date, relevant page or timestamp, rights/permission and distinction between opinion and evidence. Support import, search, retrieval and answers with source references. Compare conflicting views and indicate uncertainty. Start with formats and rights that can be supported reliably; do not assume public availability grants rights to copy or redistribute.
2. **Market intelligence:** Analyse NQ/MNQ price action and relevant economic events and news. Clearly identify source, timestamps, market-data entitlements and whether prices are live, delayed or stale. Select data providers only after verifying access, terms and costs.
3. **Strategy research:** Define explicit hypotheses and rules; test against appropriate historical data with commissions, slippage and realistic assumptions. Record parameters, data versions and results, including losses, limitations and out-of-sample performance. Avoid overstating evidence or claiming guaranteed profit.
4. **Computer understanding and operation:** With the user's permission, observe the relevant windows and understand charts, tabs, controls, positions and account information. Explore supported platform integrations first; computer interaction must detect uncertainty, unexpected screens and stale information, stop safely, and record actions. Screen observation and clicking are future capabilities, not assumptions about current support.
5. **Account and risk:** Display and verify account balances, positions, drawdown and configurable prop-firm rules when reliable data is available. MFFU rules and permitted automation vary by account and can change; obtain current authoritative terms and verify the user's exact account. Unknown or stale rules must not silently permit trades.
6. **Trading execution:** Paper/simulation first. Any later real-account operation requires explicit user approval, tested independent risk checks, account and platform verification, position and loss limits, an emergency stop and auditable records. On missing data, errors or uncertainty, fail safely. Confirm broker/platform API and prop-firm permissions before implementation.
7. **Security and privacy:** Minimise collected data, protect credentials using appropriate OS facilities, avoid hardcoded keys, offer clear permissions, keep logs free of secrets, protect local data, and provide backup guidance. No software can promise zero hacking risk.

## Architecture principles
- Separate interface, knowledge storage and retrieval, market feeds, strategy research, account/risk checks and execution behind clear interfaces. Use a modular design; select technologies based on supported OS, accessibility, maintainability, deployment and performance.
- Keep local-first operation where practical. Clearly disclose any future cloud AI, news or data service, its costs, what information is sent and any connectivity requirement.
- Use version control, documentation, meaningful tests, logging and reproducible setup. Design data migrations and backups before storing valuable user data.
- Distinguish facts, trader claims, inferred ideas and tested results. Every recommendation should show relevant evidence and limitations, not a false certainty score.
- The earlier Trading Knowledge Library v1 ZIP is a small experiment, not an existing complete architecture. Inspect it if useful; do not assume it must be reused or that it has semantic search, AI, video ingestion or live data.

## Delivery sequence
1. Inspect the environment and confirm requirements. Create a project structure, architecture and integrated desktop application foundation, with a documented run/test/build process. Begin a durable source-aware knowledge library and a clear interface. Establish safe storage and backups.
2. Add reliable import and retrieval with citations, source management and permitted content. Expand formats and semantic search after evaluating tradeoffs.
3. Add licensed historical data and a research/backtesting workflow with realistic trading costs and documented evaluation.
4. Integrate market data and news with freshness and entitlement indicators, then read-only platform/account visibility where permitted.
5. Add paper trading and evaluate risk controls and computer interaction with robust auditability and failure handling.
6. Consider live execution only after explicit user approval, comprehensive testing and confirmation of platform and firm rules.

Each stage is part of the actual product; feature boundaries and sequencing may be adjusted when technical evidence supports it. No stage guarantees trading profit or account compliance.

## Decisions to confirm
- Laptop operating system and version; hardware and available storage.
- Exact MFFU account type and the platform/broker used with it (e.g. TradingView, Tradovate or another platform).
- Budget and acceptable recurring costs for market data, news and AI; preference for local or cloud processing.
- Initial material the user can supply and has rights to use, and desired formats.
- How much control the user eventually wants: analysis only, approval for each trade, or another mode; execution remains disabled until separately authorised and tested.
- Whether and where the user wants the project hosted in GitHub. Never assume a repository or push changes without the appropriate direction.

## First instruction to Codex
Read this brief, inspect the available project and environment, and explain your proposed architecture and first build milestone in plain English. Ask only for details necessary to proceed; make reversible choices when reasonable. Build the foundation as part of the real application, document what is implemented and test it. Preserve the full vision without pretending later integrations already exist. Do not connect to real trading accounts or place orders.
