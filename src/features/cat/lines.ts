/** Everything the cats say. Short, warm, never preachy: written for brains that wander. */

export const START = [
  "Locking in! I'll guard the timer 🛡️",
  'Shh… deep work time 🐾',
  "You've got this! I'm right here ✨",
  'Focus mode: ON. Snacks later 🐟',
  'One thing at a time. Go go go! 💨',
  'Tiny steps count. Start with one 🐾',
];

/** Little pep talks during a focus session (a few minutes apart) */
export const CHEER = [
  "Still here with you 💛",
  "You're doing it! Look at you go ✨",
  'Every minute counts. Keep it rolling 🐾',
  "If your brain wandered, that's okay. Come back gently 🌱",
  'Deep breath… and back to it 🌬️',
  "I'm so proud of you rn 😻",
  'Just this one thing. Nothing else exists 🎯',
  "Your future self says thank you 💌",
  'Purrfect focus 😼',
  'Zoom zoom, brain! 🚀',
  "Hard part? You already started 💪",
  'Keep going, I believe in you 🫶',
  'Distraction? Write it down, come back 📝',
  "You're on a roll! 🧶",
  'Small progress is still progress 🐢✨',
  'Look at you, focusing like a pro 😎',
  "Don't forget to sip some water after 💧",
  'This is the good stuff. Stay with it 🌊',
  "I'm napping, you're winning 😴🏆",
  'One more push. You got this! 🔥',
];

export const HALFWAY = ['Halfway there! 🌗', "Halfway! You're crushing it 💪", 'Half done already?! 😼'];
export const PURR_LINES = ['*purrrr* 💤', '*soft purring* 🎶', 'prrrrr… 💛'];

export const DONE = ['You earned me a 🐟! Proud of you 💖', 'WE DID IT! 🎉', "Session done! You're amazing 😻", 'Look at you finishing things! 🏆', 'Treat time! Thank you 🐟💕'];
/** Ended early: a little sad, never a guilt trip. `w` = what she was working on */
export const EARLY = (w: string) => [
  `That's okay. Our ${w} will wait right here 💛`,
  "It's okay, next one counts 💛",
  `I'll keep our ${w} safe for next time 🌱`,
  "Restarting is a skill too 🌱",
];
/** You left the tab mid-session */
export const AWAY = ["I'll keep your seat warm…", 'I’ll wait right here… 🥺', 'Come back soon, okay? 💛'];
/** …and came back */
export const BACK = ["You're back! 💛 Let's keep going", 'Yay, you came back! 😻', 'I kept your seat warm! 🐾'];
/** Settling in at her desk when a session starts */
export const STUDY = {
  scarf: ['Knitting time! 🧶', 'One row for every minute 🧶', "I'll knit while you work 🧣"],
  book: ['Story time while you work 📖', "Let's both get lost in something 📖", "I'll read, you focus 📚"],
  journal: ['Let me write that down 📓', 'Dear diary, today we focus ✏️', "I'll take notes 📝"],
};
export const BREAK_START = ['Break time! Stretch with me 🙆', 'Paws up! Rest those eyes 👀', 'Snack break? 🐟', 'Go drink some water! 💧'];
export const BREAK_END = ["Break's over, let's go! ✨", 'Ready for another round? 🐾', 'Back to it, champ! 💪'];

export const PET = ['Purrrr… right behind the ears 💕', 'Best human ever 😻', '*happy motor noises* 🐾', 'More pets please! 💖', 'Mrrp! 💛', 'I like you a lot 🫶'];
export const BEG = ['Feed me? Finish a focus session to earn a 🐟', "My tummy says it's treat o'clock…", 'A 🐟 for a focus session? Deal?'];
export const SAD = ['I miss you…', '*sad meow*', 'Pet me maybe? 🥺'];
export const ANNOYED = ['Okay that is ENOUGH pets 😾', 'Personal space, please 💢', 'Hmph. 😤'];
export const FED = ['Nom nom nom 😋', 'Delicious! 🐟', 'Best. Meal. Ever. 😻'];

/** Rare gentle self-care nudges while idle */
export const CARE = ['Water break? 💧', 'Unclench your jaw 😌', 'Stretch your back with me 🙆', 'Have you eaten today? 🍙', 'Blink a few times, rest your eyes 👀', 'Roll your shoulders 🐾', "You're doing better than you think 💛"];

export const GREET = {
  morning: ['Good morning! ☀️ Ready for one small win?', 'Morning! Let’s start tiny 🌱'],
  day: ['Hiii! Missed you 💕', 'You’re back! 😻'],
  evening: ['Evening! One cozy session? 🌙', 'Hey you 💛 Let’s do a little one'],
  night: ['It’s late… one small session, then sleep? 🌙', 'Psst. Bedtime soon 😴'],
  long: ['YOU’RE BACK! I missed you so much 😻', 'Where were you?! I kept the timer warm 💕'],
};

export const PLAY = {
  butterfly: ['A butterfly!! 🦋', 'Must… catch… 🦋', 'Come back here! 🦋'],
  box: ['If I fits, I sits 📦', 'My box now 📦😼', 'Best. Box. Ever.'],
  knock: ['Oops 😼', 'It was like that when I got here', 'Gravity check ✅'],
  gift: ['A gift for you! 🎁', 'I caught this for you 🐭', 'For my favourite human 💝'],
  dance: ['This song slaps 🎶', '*vibing* 🎵', 'Dance with me! 💃'],
  tail: ['My tail!! 🌀', 'I almost had it! 💫'],
  orb: ['Wheee! 🎡', 'Round and round! 🌀', 'King of the timer 👑'],
  zoomies: ['ZOOMIES ⚡', 'nyoooom 💨'],
};

export const KITTEN = ['mew! 🐾', 'mrrp?', '*tiny sneeze*', 'mew mew 💕', '*tumbles*', 'pounce! 🐾'];

export const FAMILY = {
  partner: (n: string) => `This is ${n}! 💕`,
  visit: (n: string) => [`${n} came to visit! 💕`, `Oh hi ${n} 😻`],
  expecting: ['I have news… 🍼💕', 'Big news!! 🍼'],
  born: (a: string, b: string) => `Meet ${a} & ${b}! 🐱🐱`,
  kitten: (n: string) => `Welcome, ${n}! 🐾`,
  level: (lv: number) => `Bond level ${lv}! 💖`,
};
