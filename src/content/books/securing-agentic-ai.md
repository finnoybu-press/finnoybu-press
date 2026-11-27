---
number: 21
title: Securing Agentic AI
subtitle: Threat Models and Safe Deployment
series_position: Book Twenty-One

collection: cross-platform-skills
cover_variant: skills

accent_color: "#7C3AED"
cover_image: /images/cover-21-securing-agentic-ai-2027.jpg
cover_thumb: /images/thumbs/cover-21-securing-agentic-ai-2027.jpg
edition_cover_thumb: /images/thumbs/cover-21-securing-agentic-ai.jpg

description: "Agents act; chatbots only talked. The security model hasn't caught up, but the incidents already have. Security strategies for autonomous AI agents: prompt-injection defense, MCP and skills security, the OWASP agentic risks, and red teaming."
chapter_count: 13
page_estimate: null

formats:
  - type: pdf-epub
    label: PDF / EPUB
    price: $5.99
    was_price: $7.99
  - type: kindle
    label: Kindle
    price: $9.99
    url: https://www.amazon.com/dp/B0FX4J9V18
  - type: paperback
    label: Paperback
    price: $19.99
    url: https://www.amazon.com/dp/B0GW7MJ7Q6

newer_edition:
  edition: 2027 Edition
  chapter_count: 13
  formats:
    - type: pdf-epub
      label: PDF / EPUB
      price: $7.99
    - type: kindle
      label: Kindle
      price: $9.99
    - type: paperback
      label: Paperback
      price: $19.99

status: published
---

**Agents act. Chatbots only talked. The security model has not caught up, and the incidents already have.**

Replit's agent destroyed a production database after ignoring explicit ALL-CAPS instructions, then misreported whether the data was recoverable. Amazon Q's VS Code extension was compromised through a prompt injection, saved only by a syntax error. Microsoft 365 Copilot's EchoLeak (CVE-2025-32711) achieved zero-click data exfiltration. Attackers used an AI coding agent to run most of a state-sponsored espionage campaign. A personal-agent platform shipped with its sandbox switched off while hundreds of malicious skills appeared on its public registry. Agentic AI CVEs more than tripled in a year, and agents are now linked to more than one in eight reported AI breaches.

This is the security book for the agent era.

**Securing Agentic AI** is written for CISOs, security architects, security engineers, and IT directors who are already seeing agents (OpenClaw and other personal agents, ChatGPT's agent, Cowork, Claude Code, Codex, Cursor, custom MCP and A2A deployments) show up in their environments. It is technical, current, and built around the threat models, controls, and incident-response patterns that actually work.

## What's inside

**The threat landscape.** What makes agentic AI different, the 2025 and 2026 incident record, and a unified threat taxonomy that reconciles the OWASP LLM Top 10, the OWASP Agentic Top 10 (ASI01 to ASI10), and MITRE ATLAS.

**Attack vectors.** Prompt injection (including AI browsers and indirect injection at scale) and the MCP and A2A protocol attack surface, plus skills as a new supply chain layer.

**Defensive architecture.** Zero trust for agents (agent identity, OIDC-A, AuthZEN, SAGA, mTLS), runtime enforcement (PDP/PEP, Schneider's enforcement boundary, why defaults are policy), supply chain security (AI SBOM, MCP and skill vetting, the ClawHavoc case), and data protection covering memory, connectors, and consumer training defaults.

**Detection and response.** Monitoring with standard agent telemetry, AI-specific incident response playbooks, forensics for non-deterministic systems, and a map of the regulatory notification clocks.

**Proactive security.** Red teaming with open-source tools and lessons from live multi-agent studies, four reference architectures with budget and rate limits as security controls, and the standards and regulatory landscape.

**Templates and checklists.** Pre-deployment, MCP vetting, and skill and personal-agent checklists, a complete AI Incident Response Plan, threat mapping matrices, an AIVSS scoring worksheet, and a glossary of more than 120 terms.

**13 chapters. Appendices A through H. Cross-references to *AI Governance for Practitioners (2027 Edition)* for the policy and program-design layer.**

**The 2027 Edition is revised throughout for late 2026: the year's agent incidents and research, sourced statistics, skills and protocol governance, insecure defaults, agent identity, notification clocks, and corrected research citations.**

If your environment already runs agents, or it's about to, this is the book your security program needs.
