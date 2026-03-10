---
title: Operational Notes
---

# Operational Notes

## Things that routinely break first

- unread count drift;
- partially normalized connector payloads;
- media upload edge cases;
- feed pagination regressions;
- account link flows when external provider configuration changes.

## What to test after changes

- unread count and long-poll together;
- feed serialization for news items with media;
- account-link create/delete;
- sync pipeline from raw event to normalized event;
- privacy-sensitive transformations in connectors.
