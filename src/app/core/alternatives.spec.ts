import { brandsForSearch, type AlternativeBrand } from './alternatives';

const BRANDS: AlternativeBrand[] = [
  { brand: 'Hikvision', match: ['hikvision', 'hik vision'], offer: ['Hanwha Vision'] },
  {
    brand: 'Resideo / Honeywell Home (Vista, ProSeries)',
    match: ['resideo', 'honeywell home', 'vista'],
    offer: ['Honeywell'],
  },
  { brand: 'DMP', match: ['dmp'], offer: ['Bosch'] },
  { brand: 'Ring Doorbells', match: ['ring doorbell'], offer: ['Alarm.com'] },
];
const CARRIED = ['Hanwha Vision', 'Honeywell', 'Honeywell StreetSmart Security', 'Bosch'];

const brandsFor = (search: string, correctedSearch = '', carriedNames = CARRIED): string[] =>
  brandsForSearch({ brands: BRANDS, carriedNames, search, correctedSearch }).map((b) => b.brand);

describe('brandsForSearch', () => {
  it('matches an exact spelling', () => {
    expect(brandsFor('Hikvision')).toEqual(['Hikvision']);
    expect(brandsFor('hik vision')).toEqual(['Hikvision']);
  });

  it('uses the typo-corrected search when there is one', () => {
    expect(brandsFor('hickvision', 'hikvision')).toEqual(['Hikvision']);
  });

  it('guesses while typing (4+ characters) when no carried line starts that way', () => {
    expect(brandsFor('hikv')).toEqual(['Hikvision']);
    expect(brandsFor('hik')).toEqual([]);
  });

  it("doesn't guess a not-carried brand while the search could still be a carried line", () => {
    expect(brandsFor('honeywell')).toEqual([]);
    expect(brandsFor('honeywell home')).toEqual(['Resideo / Honeywell Home (Vista, ProSeries)']);
  });

  it('finds a 4+ character spelling inside a longer search, but not a short one', () => {
    expect(brandsFor('hikvision nvr')).toEqual(['Hikvision']);
    expect(brandsFor('dmp')).toEqual(['DMP']);
    expect(brandsFor('dmp panel')).toEqual([]);
  });

  it('skips a brand once SDS carries it', () => {
    expect(brandsFor('dmp', '', [...CARRIED, 'DMP'])).toEqual([]);
  });

  it('shows nothing for an empty search', () => {
    expect(brandsFor('   ')).toEqual([]);
  });
});
