export interface ChallengeMeta { difficulty: string; subjects: string[]; desc: string }

/** Difficulty, subjects and a one-line brief for each of the 14 challenge prototypes. */
export const CHALLENGE_META: Record<number, ChallengeMeta> = {
  1: { difficulty: 'Beginner/Youth', subjects: ['Astrophysics', 'Planets & Moons', 'Space Exploration'], desc: 'Tell the stories of NASA hardware left on the Moon and Mars — and the science it made possible.' },
  2: { difficulty: 'Advanced', subjects: ['Earth Science', 'Software'], desc: 'Find NASA variables that are changing, visualize them, and test whether the change is statistically significant.' },
  3: { difficulty: 'Beginner/Youth', subjects: ['Games', 'Space Exploration'], desc: 'A game where students run a lunar or Martian outpost, balancing life support, power and food.' },
  4: { difficulty: 'Intermediate', subjects: ['Human Exploration', 'Software'], desc: 'Health monitoring software that gathers indicators so astronauts can assess their own status.' },
  5: { difficulty: 'Advanced', subjects: ['Earth Science', 'Software'], desc: 'Use NISAR radar to track and visualize surface change — the "Dancing with the SARs" challenge.' },
  6: { difficulty: 'Intermediate', subjects: ['Earth Science', 'Agriculture'], desc: 'Help farmers explore crop rotations suited to soil health and a changing climate.' },
  7: { difficulty: 'Intermediate', subjects: ['Living in Space', 'AI'], desc: 'An AI dashboard that summarizes microgravity combustion experiments for fire safety.' },
  8: { difficulty: 'Advanced', subjects: ['Earth Science'], desc: 'Harmonize MODIS and VIIRS active-fire records into one historical map.' },
  9: { difficulty: 'Beginner/Youth', subjects: ['Planets & Moons'], desc: 'Find Earth sites that resemble the Moon and Mars for mission preparation.' },
  10: { difficulty: 'Intermediate', subjects: ['Space Exploration'], desc: 'An interactive map for surface routes on Mars.' },
  11: { difficulty: 'Advanced', subjects: ['Space Exploration'], desc: 'Compare lunar south-pole landing sites by Sun and Earth visibility.' },
  12: { difficulty: 'Intermediate', subjects: ['Astrophysics'], desc: 'See changes in the infrared sky with SPHEREx data.' },
  13: { difficulty: 'Beginner/Youth', subjects: ['Games'], desc: 'A game for designing a complete space mission.' },
  14: { difficulty: 'Beginner/Youth', subjects: ['Earth Science'], desc: 'Turn Earth observations into sound.' },
};
