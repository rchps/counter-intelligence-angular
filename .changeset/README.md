# Changesets

A change people at the counter would notice adds a file here, committed with the change itself: any
name ending in `.md`, holding its bump size and one plain-language line.

```md
---
bump: minor
---

Tools shows a few tips the first time it opens.
```

- **patch**: a fix, or something small. **minor**: something new. **major**: something that works
  differently enough that people have to relearn it.
- Write the line for the counter, not for developers: what they'll see, not how it was built.
- Docs, tests and CI changes don't need one. A pull request that changes the app without one gets a
  warning in CI, not a failure.

Each deploy of `main` is a release: the biggest bump among the changesets added since the last one
(a patch if there are none), tagged with these lines as its notes. [docs/ci-cd.md](../docs/ci-cd.md#releases)
has the whole flow.
