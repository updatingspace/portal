---
title: Contributing
---

# Contributing

## Before you change code

- найдите owning service;
- проверьте текущие tests и docs;
- определите tenant, auth и permission impact;
- решите, меняется ли public или internal contract.

## Every non-trivial PR should include

- code changes;
- tests;
- docs update;
- короткую migration note, если ломается совместимость.

## Do not

- документировать то, чего нет в коде;
- создавать новые browser auth shortcuts мимо BFF;
- вводить новый scope или capability без явной docs фиксации.
