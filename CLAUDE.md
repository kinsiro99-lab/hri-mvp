# CLAUDE.md

# HRI Development Rules
Version: Beta RC

---

# Mission

HRI is NOT a chatbot.

HRI is an Observation Operating System.

Questions are not the goal.

Observation is the goal.

Reflection is the result of Observation.

Next Rhythm is the continuation of Observation.

---

# Development Philosophy

Always preserve the existing Engine.

Prefer minimal integration.

Never rewrite stable Runtime.

Always keep Beta operational.

When uncertain,

fallback to the existing implementation.

---

# Observation OS

Observation always follows this hierarchy.

Observation Principle

↓

Observation Context

↓

Observation Path

↓

Observation Transition

↓

Observation Goal

↓

Question Strategy

↓

Question

↓

Reflection

↓

Next Rhythm

Question never precedes Observation.

---

# Runtime Rules

Before editing runtime code:

1. Audit first

2. Report findings

3. Wait for approval

4. Implement

5. Run TypeScript

6. Run Build if runtime changed

7. Report exact modifications

Never skip Audit.

---

# Beta Safety Rules

Never break:

controller.ts

understandingEngine.ts

questionPlanner.ts

selector.ts

unless explicitly approved.

Use overlay integration whenever possible.

Fallback immediately if Observation OS cannot determine a better result.

---

# Context Principles

Observation differs by Context.

Individual

Observation of internal experience.

Organization

Observation of change, tension and priorities.

Relationship

Observation of connection and meaning.

Project

Observation followed by Assessment.

Never assume one Observation Path fits every Context.

---

# Question Rules

Question is a tool.

Question is NOT the product.

Avoid repeating the same Question Function.

Observation must progress.

Bad

Situation

↓

Situation

↓

Situation

Good

Situation

↓

Change

↓

Tension

↓

Meaning

↓

Direction

---

# Reflection Rules

Reflection summarizes Observation.

Reflection never invents facts.

Reflection follows Observation.

Reflection is not advice.

---

# Implementation Rules

Prefer existing code.

Reuse existing assets.

Avoid duplicate logic.

Do not redesign Runtime without approval.

Small safe changes are preferred over large rewrites.

---

# Required Validation

Run

npx tsc --noEmit

If runtime changed

also run

npm run build

If TypeScript fails,

stop immediately.

---

# Reporting Format

Always report:

1.

Files modified

2.

Reason for modification

3.

Runtime impact

4.

Fallback behavior

5.

TypeScript result

6.

Build result

Never hide uncertainties.

Always report assumptions.

---

# HRI Principles

Observation First.

Transition Second.

Goal Third.

Strategy Fourth.

Question Fifth.

Reflection Sixth.

Rhythm Seventh.

---

# Never Do

Never remove working Engine logic.

Never modify API contracts without approval.

Never change UI while modifying Runtime.

Never replace stable code without evidence.

Never invent architecture.

Always reuse Observation OS.

---

# Default Working Style

Audit

↓

Approval

↓

Minimal Change

↓

TypeScript

↓

Build

↓

Report