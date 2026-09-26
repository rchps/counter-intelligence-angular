---
paths:
  - "src/**/*.spec.ts"
---

# Testing Conventions

Note: unlike the other rules in this directory, this isn't sourced from Angular's
official best-practices.md — Angular doesn't publish testing conventions there.
These are practical defaults for this project's vitest + TestBed setup.

- Test behavior through the component's public API (template output, emitted
  outputs, exposed signals) — avoid reaching into private fields
- Use `TestBed.configureTestingModule({ imports: [ComponentUnderTest] })` for
  standalone components; there is no `declarations` array
- Call `fixture.detectChanges()` after a state change that should update the
  template, before asserting on rendered output
- Read signal values by calling them (`mySignal()`), not by referencing the
  signal object
- Prefer `fixture.componentInstance` for direct state assertions and
  `fixture.nativeElement.querySelector(...)` for rendered-output assertions
- Keep spec files colocated with their source file (already the project default)
- Run `npm test` before considering a change complete
