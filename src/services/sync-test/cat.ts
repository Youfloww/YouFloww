/** Rules for one cat per account (features/cat/cloudRules). Run: npx -y tsx@4 --tsconfig tsconfig.json src/services/sync-test/cat.ts */
import { importantChange, isNewCat, isSave, mergeCat, sameCat, toSave, type CatFields } from '../../features/cat/cloudRules';

let fails = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
  if (!cond) fails++;
};
const base: CatFields = {
  name: 'Flowy', skin: 'tabby', treats: 1, purrs: true, cheers: true, showFamily: true,
  hunger: 30, energy: 80, joy: 70, affection: 40, asleep: false, lastTick: 1000,
  xp: 0, together: 0, stage: 'single', partner: null, expectingAt: 0, kittens: [],
};
const cat = (p: Partial<CatFields>, idAt = 1, needsAt = 1) => toSave({ ...base, ...p }, idAt, needsAt);
const kits = [{ id: 'a', name: 'Bean', skin: 'ginger' as const, born: 5 }, { id: 'b', name: 'Kiwi', skin: 'tabby' as const, born: 5 }];

// progress never goes back
const laptop = cat({ xp: 900, together: 80, stage: 'family', partner: { name: 'Mochi', skin: 'ginger' }, kittens: kits, name: 'Luna' }, 100, 100);
const desktop = cat({ xp: 120, together: 9, stage: 'dating', partner: { name: 'Leo', skin: 'snow' } }, 50, 300);
let m = mergeCat(desktop, laptop)!;
ok('further cat wins progress', m.xp === 900 && m.stage === 'family' && m.kittens.length === 2 && m.partner?.name === 'Mochi');
ok('progress same both ways', sameCat(mergeCat(desktop, laptop), mergeCat(laptop, desktop)));
ok('newest name wins', m.name === 'Luna');
ok('freshest needs win', m.needsAt === 300 && m.hunger === desktop.hunger);

// a rename on the less advanced device still sticks
const renamed = cat({ xp: 120, together: 9, stage: 'dating', name: 'Nori' }, 500, 300);
m = mergeCat(laptop, renamed)!;
ok('latest rename kept even from the device behind', m.name === 'Nori' && m.xp === 900);

// skin must be unlocked at the merged bond
const wantsCosmic = cat({ xp: 10, skin: 'cosmic' }, 900, 1);
m = mergeCat(wantsCosmic, cat({ xp: 20 }, 1, 1), (skin, xp) => skin !== 'cosmic' || xp >= 830)!;
ok('locked skin falls back', m.skin === 'tabby');
m = mergeCat(cat({ xp: 10, skin: 'cosmic' }, 900, 1), cat({ xp: 1050, skin: 'tabby' }, 1, 1), (skin, xp) => skin !== 'cosmic' || xp >= 830)!;
ok('newer skin kept when the bond allows it', m.skin === 'cosmic' && m.xp === 1050);

// one side missing
ok('no account cat: keep this one', sameCat(mergeCat(laptop, null), laptop));
ok('no local cat: take the account one', sameCat(mergeCat(null, laptop), laptop));

// merging twice changes nothing (no write ping-pong between devices)
const once = mergeCat(desktop, laptop)!;
ok('merge is stable', sameCat(mergeCat(once, laptop), once) && sameCat(mergeCat(desktop, once), once));

// change kinds
ok('needs drift is not urgent', !importantChange(cat({ hunger: 30 }), cat({ hunger: 44 })));
ok('a kitten is urgent', importantChange(cat({}), cat({ kittens: kits })));
ok('a rename is urgent', importantChange(cat({}), cat({ name: 'Mo' })));
ok('timestamps alone are not a change', sameCat(cat({}, 1, 1), cat({}, 99, 99)));

// fresh browsers and junk
ok('untouched cat is new', isNewCat(base));
ok('a cat with one session is not new', !isNewCat({ ...base, together: 1, xp: 12 }));
ok('broken saves are ignored', !isSave(null) && !isSave({ v: 2 }) && !isSave({ v: 1, name: 'x', xp: NaN, kittens: [] }) && isSave(laptop));

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
