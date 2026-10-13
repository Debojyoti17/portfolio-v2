---
title: "Agentic Shell: Inode & Symlink Auditor Agent"
type: Team project
area: Reliable multi-agent AI
summary: A natural-language Linux shell agent in Python that audits symlinks, symlink loops, hard links and inode usage, with a safety-gated delete.
tags: [AI agents, Linux]
featured: true
order: 5
visual: tree
facts:
  - { label: Language, value: Python }
  - { label: Platform, value: Linux shell }
---

A natural-language Linux shell agent, written in Python, that audits the file system.

## What it audits

- Symlinks and **symlink loops**
- Hard links
- Inode usage

Deleting anything goes through a **safety gate**.
