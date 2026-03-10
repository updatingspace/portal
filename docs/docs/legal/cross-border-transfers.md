---
title: Cross-Border Transfers
---

# Cross-Border Transfers

## Current state

The platform currently operates primarily in Russian infrastructure and plans a separate EU deployment path.

## Baseline rule

If EEA users are targeted or materially served, cross-border implications must be reviewed before launch. The preferred option is a dedicated EEA-hosted contour. If personal data still moves across regions, the project needs a documented transfer mechanism and a review of legal risk.

## Engineering consequence

Cross-border transfer readiness is not only a legal checkbox. It affects:

- where databases are hosted;
- where logs and backups live;
- where object storage and media delivery occur;
- where identity and connector traffic is terminated.

## Release gate

EU public rollout should not be treated as complete until the final deployment topology and transfer model are explicitly documented and approved.
