# Keeping the data current

[← Back to the README](../README.md) · [All docs](README.md)

All content is in `public/data/`, and `npm run validate-data` checks it (the pre-commit hook and CI run
it too): required fields, duplicates, unknown fields (usually a typo), and every name that has to match a
manufacturer exactly.

| File                | Holds                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `lines.json`        | `asOf` date, categories, manufacturers (`name`, `url`, `cats`, `aka`, `logo`), branches (`st`, `city`, `addr`, `phone`) |
| `terms.json`        | Product terms: a `label`, the other ways people type it (`syn`), and the `lines` that make it                           |
| `alternatives.json` | Brands not carried: what a rep might type (`match`), lines to `offer` instead, optional `note`                          |

**Adding a manufacturer:** add it to `lines.json` with at least one category and a logo, update `asOf`,
run `npm run validate-data`, and check it in the app. If it was listed in `alternatives.json` as a brand
not carried, that entry is skipped automatically once the line exists.

**Removing a manufacturer:** take it out of `lines.json`, then out of any term's `lines` in `terms.json`
and any brand's `offer` in `alternatives.json` (`npm run validate-data` names each one left behind).
Delete its logo from `public/logos/` and update `asOf`.

**Adding a logo:** put the image in `public/logos/` and reference its file name in the line's `logo`
field. Trim the empty border around the artwork first; the app sizes each logo by the area of its
artwork, and padding in the file makes a logo look smaller than it should:

```bash
magick mogrify -fuzz 8% -trim +repage public/logos/new-logo.png   # ImageMagick
```

## Checking the data against the source

The distributor's supplier and location pages are the source of truth. When checking against them:

- **Manufacturers:** look for lines added to or dropped from the supplier page, and compare each line's
  `url` with the link the page gives it. Use the page's link even when the old one still works. Skip
  differences that are only `www`, a trailing slash or `/index`.
- **Branches:** compare each branch's address and phone with its own location page.
- **No website:** when the source has no link for a line, set `url` to `null` rather than guessing a
  domain. A domain that looks right can belong to someone else: goldenstateinst.com, for example, is
  now an unrelated site, not Golden State Instrument.
- **Aliases:** when a line moves to a parent company's site (Comtran to Marmon, Platinum Tools to NSI
  Industries), add the parent's name to `aka` so a search for it still finds the line.

Then update `asOf`, run `npm run validate-data`, and update the search baseline for any results that
changed (see [Testing](testing.md#end-to-end-tests)).
