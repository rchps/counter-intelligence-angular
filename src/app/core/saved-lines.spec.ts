import { describe, expect, it } from 'vitest';
import { linesByName, parseNames, pushRecent, togglePinned } from './saved-lines';

describe('parseNames', () => {
  it('reads a saved list of names', () => {
    expect(parseNames('["HID","Altronix"]')).toEqual(['HID', 'Altronix']);
  });

  it('is empty when nothing is saved', () => {
    expect(parseNames(null)).toEqual([]);
  });

  it('is empty when the saved value is not JSON', () => {
    expect(parseNames('not json')).toEqual([]);
  });

  it('is empty when the saved value is not a list', () => {
    expect(parseNames('{"name":"HID"}')).toEqual([]);
  });

  it('drops anything in the list that is not a name', () => {
    expect(parseNames('["HID",3,null,"Altronix"]')).toEqual(['HID', 'Altronix']);
  });
});

describe('togglePinned', () => {
  it('pins a name at the end', () => {
    expect(togglePinned(['HID'], 'Altronix')).toEqual(['HID', 'Altronix']);
  });

  it('unpins a name that is already pinned', () => {
    expect(togglePinned(['HID', 'Altronix'], 'HID')).toEqual(['Altronix']);
  });
});

describe('pushRecent', () => {
  it('puts the newest name first', () => {
    expect(pushRecent(['HID'], 'Altronix')).toEqual(['Altronix', 'HID']);
  });

  it('moves a name opened again to the front instead of listing it twice', () => {
    expect(pushRecent(['HID', 'Altronix', 'Axis'], 'Axis')).toEqual(['Axis', 'HID', 'Altronix']);
  });

  it('keeps at most the given number of names', () => {
    expect(pushRecent(['B', 'C', 'D'], 'A', 3)).toEqual(['A', 'B', 'C']);
  });
});

describe('linesByName', () => {
  const lines = [{ name: 'Altronix' }, { name: 'Axis' }, { name: 'HID' }];

  it('returns the lines in the order the names are listed', () => {
    expect(linesByName(lines, ['HID', 'Altronix'])).toEqual([
      { name: 'HID' },
      { name: 'Altronix' },
    ]);
  });

  it('skips names that are no longer in the data', () => {
    expect(linesByName(lines, ['Gone', 'Axis'])).toEqual([{ name: 'Axis' }]);
  });
});
