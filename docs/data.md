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

**Adding a logo:** put the image in `public/logos/` and reference its file name in the line's `logo`
field. Trim the empty border around the artwork first; the app sizes each logo by the area of its
artwork, and padding in the file makes a logo look smaller than it should:

```bash
magick mogrify -fuzz 8% -trim +repage public/logos/new-logo.png   # ImageMagick
```
