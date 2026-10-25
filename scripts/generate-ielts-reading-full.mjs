import { mkdirSync, writeFileSync } from 'node:fs';

const academic = [
  { title: 'Heat below the streets', lead: 'The fictional city of Norhaven tested district heating as a way to reuse heat that would otherwise be lost. Its engineers compared several neighbourhoods before recommending a cautious expansion.', facts: [
    ['The first pilot connected the riverside clinic to a heat network in 2018.', 'When did the first pilot begin?', '2018'],
    ['Engineers used insulated pipes to carry hot water beneath the pavement.', 'What carried the hot water?', 'insulated pipes'],
    ['A data centre supplied waste heat during the winter trial.', 'Which facility supplied waste heat?', 'a data centre'],
    ['The library joined the network only after a separate heat exchanger was installed.', 'What was installed before the library joined?', 'a heat exchanger'],
    ['Measurements showed lower gas use in connected buildings, but the report did not compare construction costs.', 'What did the report leave out?', 'construction costs'],
    ['The team found that older pipes lost more heat at shallow joints.', 'Where did older pipes lose more heat?', 'at shallow joints'],
    ['A maintenance crew inspected the network every six weeks.', 'How often was the network inspected?', 'every six weeks'],
    ['Residents received notices before work began on each street.', 'What did residents receive before street work?', 'notices'],
    ['The council paused expansion until a second winter of data had been collected.', 'Why did the council pause expansion?', 'to collect a second winter of data'],
    ['The pilot used water at a lower temperature than the city’s older steam system.', 'How did the pilot water temperature compare with the old system?', 'it was lower'],
    ['A university group checked the temperature sensors independently.', 'Who checked the sensors?', 'a university group'],
    ['The report recommended mapping underground utilities before selecting new routes.', 'What should be mapped before routes are selected?', 'underground utilities'],
    ['The researchers warned that savings would vary with building insulation.', 'What could change the level of savings?', 'building insulation'],
  ] },
  { title: 'A night sky with fewer lamps', lead: 'In the fictional district of Bellmere, planners studied whether street lighting could be reduced without making paths feel unsafe. The team combined light measurements with interviews and a small controlled trial.', facts: [
    ['The survey covered twelve streets beside the town’s canal.', 'How many streets were surveyed?', 'twelve'],
    ['Researchers measured brightness at pavement level rather than at lamp height.', 'Where was brightness measured?', 'at pavement level'],
    ['The trial replaced broad white lamps with shielded amber lights.', 'What kind of replacement lamps were tested?', 'shielded amber lights'],
    ['The shield directed most light toward the walkway and away from bedroom windows.', 'Where did the shield direct most light?', 'toward the walkway'],
    ['Participants walked each route at the same time on three evenings.', 'How many evenings did participants walk each route?', 'three'],
    ['The interviews found that even lighting mattered more to many walkers than maximum brightness.', 'Which feature mattered more than maximum brightness to many walkers?', 'even lighting'],
    ['A separate group checked the routes during rainy weather.', 'What weather did the second group check?', 'rainy weather'],
    ['The trial reduced electricity use by about one fifth on the selected streets.', 'By roughly how much did electricity use fall?', 'one fifth'],
    ['The study recorded no change in reported falls during its short trial.', 'What happened to reported falls during the short trial?', 'there was no recorded change'],
    ['The authors said the trial was too brief to establish long-term accident rates.', 'Why could the study not establish long-term accident rates?', 'the trial was too brief'],
    ['Shop owners asked that signs near crossings remain clearly illuminated.', 'What did shop owners want illuminated?', 'signs near crossings'],
    ['The planners advised testing each lamp design with local residents before wider use.', 'Who should help test lamp designs?', 'local residents'],
    ['The report treated light pollution and personal safety as separate measures.', 'Which two measures did the report keep separate?', 'light pollution and personal safety'],
  ] },
  { title: 'Seeds kept for uncertain seasons', lead: 'A fictional agricultural institute built a seed collection to help farms prepare for changing rainfall. Its researchers stress that stored seeds are useful only when their origins and growing conditions are recorded.', facts: [
    ['The collection began with seeds from farms in three neighbouring valleys.', 'Where did the first seeds come from?', 'three neighbouring valleys'],
    ['Each packet received a code linked to its collection location and date.', 'What information was linked to each packet code?', 'its location and date'],
    ['Staff dried the seeds slowly before placing them in sealed containers.', 'What did staff do before sealing the containers?', 'dried the seeds slowly'],
    ['A temperature log showed that the storage room stayed near four degrees Celsius.', 'What temperature did the room stay near?', 'four degrees Celsius'],
    ['The institute tested a small sample from every new batch for germination.', 'What did the institute test in each new batch?', 'germination'],
    ['Some local varieties germinated later but survived longer without irrigation.', 'What advantage did some local varieties show?', 'they survived longer without irrigation'],
    ['Researchers compared growth in sandy soil and heavier clay soil.', 'Which two soils were compared?', 'sandy soil and clay soil'],
    ['The trial did not identify one variety that performed best in every field.', 'Did one variety perform best in every field?', 'no'],
    ['Farmers helped choose which traits to measure during the growing season.', 'Who helped choose the traits to measure?', 'farmers'],
    ['The institute returned duplicate seed samples to two village cooperatives.', 'Where were duplicate samples returned?', 'two village cooperatives'],
    ['A yearly inventory was introduced after several labels became difficult to read.', 'Why was a yearly inventory introduced?', 'some labels became difficult to read'],
    ['The report recommends keeping a living field collection alongside frozen storage.', 'What should accompany frozen storage?', 'a living field collection'],
    ['Researchers cautioned that a seed collection cannot replace healthy soils or reliable water.', 'What two resources can the collection not replace?', 'healthy soils and reliable water'],
    ['The next trial will compare planting dates after an unusually dry spring.', 'What will the next trial compare?', 'planting dates'],
  ] },
];

const general = [
  { title: 'Getting around Westbridge', lead: 'This guide explains how residents can use the fictional Westbridge transport service. Fares and opening times below apply to the current spring timetable.', facts: [
    ['The service desk at Central Station opens at 7:30 on weekdays.', 'When does the Central Station desk open on weekdays?', '7:30'],
    ['A day pass allows unlimited bus and tram journeys until midnight.', 'Until when is a day pass valid?', 'midnight'],
    ['Children under six travel free when accompanied by a fare-paying adult.', 'Which children travel free?', 'children under six'],
    ['Passengers can add money to a travel card at the station or through the mobile app.', 'Where can passengers add money to a travel card?', 'at the station or in the app'],
    ['The green route stops at the hospital entrance every twenty minutes.', 'How often does the green route reach the hospital?', 'every twenty minutes'],
    ['Bicycles are accepted on trains outside the morning peak.', 'When are bicycles accepted on trains?', 'outside the morning peak'],
    ['Lost property is held at the depot for fourteen days.', 'How long is lost property kept?', 'fourteen days'],
    ['The accessible minibus must be booked at least one day in advance.', 'How early must the minibus be booked?', 'one day in advance'],
    ['A replacement bus serves the riverside stop while the bridge is being repaired.', 'What serves the riverside stop during repairs?', 'a replacement bus'],
    ['Contactless bank cards are accepted on buses but not on the heritage tram.', 'Where are contactless bank cards not accepted?', 'the heritage tram'],
    ['The first Sunday service leaves Central Station at 8:10.', 'When does the first Sunday service leave?', '8:10'],
    ['A folded pushchair may be taken on board without an extra charge.', 'Is there an extra charge for a folded pushchair?', 'no'],
    ['The operator posts service changes on noticeboards and its website.', 'Where are service changes posted?', 'noticeboards and the website'],
    ['Refund requests for unused weekly passes must be made before the pass begins.', 'When must a refund request be made?', 'before the pass begins'],
  ] },
  { title: 'Using the Harbour Street library', lead: 'Harbour Street library offers study space, digital access, and community activities. The following notice describes services available to members this year.', facts: [
    ['The reading room is open until 8 p.m. on Tuesday and Thursday.', 'Until what time is the reading room open on Thursdays?', '8 p.m.'],
    ['Members may borrow up to eight books at one time.', 'How many books may a member borrow at once?', 'eight'],
    ['Books are loaned for three weeks and can be renewed online once.', 'How many online renewals are allowed?', 'one'],
    ['The computer area requires a booking during school holidays.', 'When does the computer area require a booking?', 'during school holidays'],
    ['A quiet study room can be reserved in one-hour blocks.', 'How long is each study-room booking block?', 'one hour'],
    ['The weekly conversation group meets on Wednesday mornings.', 'When does the conversation group meet?', 'Wednesday mornings'],
    ['Large-print books are kept on the shelves beside the front desk.', 'Where are large-print books kept?', 'beside the front desk'],
    ['A replacement card costs two pounds.', 'How much does a replacement card cost?', 'two pounds'],
    ['Children’s story time is intended for ages three to seven.', 'Which ages is story time intended for?', 'ages three to seven'],
    ['The library accepts book donations only after staff have checked their condition.', 'When are donated books accepted?', 'after staff check their condition'],
    ['Printing is charged by the page, while scanning is free.', 'Which service is free?', 'scanning'],
    ['The local history collection may be used inside the building but not borrowed.', 'Can local history items be borrowed?', 'no'],
    ['Members can ask staff to request a title from another branch.', 'What can staff request from another branch?', 'a title'],
  ] },
  { title: 'A community garden project', lead: 'The fictional Eastbank Garden welcomes residents who want to grow food and improve a shared outdoor space. Its organisers explain how plots, tools, and volunteer sessions work.', facts: [
    ['New members attend a short orientation before receiving a plot.', 'What must new members attend?', 'an orientation'],
    ['Each family plot measures four metres by two metres.', 'What are the dimensions of a family plot?', 'four metres by two metres'],
    ['Watering is restricted to early morning during dry-weather notices.', 'When may members water during a dry-weather notice?', 'early morning'],
    ['The tool shed is opened by the volunteer coordinator on Saturdays.', 'Who opens the tool shed?', 'the volunteer coordinator'],
    ['Organic waste is placed in the marked bays behind the greenhouse.', 'Where should organic waste be placed?', 'the marked bays behind the greenhouse'],
    ['Members label shared seedlings with the plant name and sowing date.', 'What two details go on seedling labels?', 'the plant name and sowing date'],
    ['Children must remain with an adult near the pond.', 'Who must stay with children near the pond?', 'an adult'],
    ['The monthly work session takes place on the first Sunday.', 'When is the monthly work session?', 'the first Sunday'],
    ['A small number of raised beds are reserved for residents with limited mobility.', 'Who are some raised beds reserved for?', 'residents with limited mobility'],
    ['The garden does not permit chemical weedkiller on shared paths.', 'What is not permitted on shared paths?', 'chemical weedkiller'],
    ['Members may sell surplus produce only at the autumn open day.', 'When may members sell surplus produce?', 'at the autumn open day'],
    ['The greenhouse key is signed out at the community centre.', 'Where is the greenhouse key signed out?', 'the community centre'],
    ['The committee reviews plot use at the end of each growing season.', 'When does the committee review plot use?', 'at the end of each growing season'],
  ] },
];

const makeBank = (variant, passages) => {
  const questions = [];
  passages.forEach((passage, passageIndex) => {
    const passageNumber = passageIndex + 1;
    const claimText = passage.facts.map(([fact]) => fact).join(' ');
    const content = `${passage.lead}\n\n${claimText}`;
    passage.content = content;
    passage.facts.forEach(([fact, prompt, answer], index) => {
      const globalIndex = questions.length;
      const kind = globalIndex % 9;
      const choices = [...new Set([answer, ...passages.flatMap(item => item.facts.map(row => row[2])).filter(choice => choice !== answer)])].slice(0, 4);
      const id = `${variant === 'academic' ? 'academic' : 'general'}_reading_${String(globalIndex + 1).padStart(2, '0')}`;
      const base = { id, section: 'reading', passageNumber, points: 1, difficulty: ['easy', 'medium', 'hard'][globalIndex % 3], explanation: `The passage states: ${fact}`, text: prompt };
      let question;
      if (kind === 0 || kind === 6) question = { ...base, type: 'mcq', questionType: 'multiple-choice', responseType: 'single-choice', options: choices, correctAnswer: answer };
      else if (kind === 1) {
        const caseType = globalIndex % 3;
        const claim = caseType === 1 ? `The passage reports that a documentary was made about ${passage.title}.` : caseType === 2 ? `The passage does not report this fact: “${fact}”` : fact;
        question = { ...base, type: 'mcq', questionType: 'true-false-not-given', responseType: 'single-choice', text: `Decide whether the statement agrees with the passage: “${claim}”`, options: ['True', 'False', 'Not Given'], correctAnswer: caseType === 1 ? 'Not Given' : caseType === 2 ? 'False' : 'True' };
      }
      else if (kind === 2) question = { ...base, type: 'text', questionType: 'completion', responseType: 'multi-blank', text: `Complete the note using words from the passage: ${prompt}`, answerSlots: [{ id: `${id}_answer`, label: 'Answer', correctAnswers: [answer] }] };
      else if (kind === 3) question = { ...base, type: 'text', questionType: 'short-answer', responseType: 'short-text', correctAnswer: answer, acceptedAnswers: [answer] };
      else if (kind === 4) {
        const heading = `Passage ${passageNumber}: ${passage.title}`;
        const headings = passages.map((item, itemIndex) => `Passage ${itemIndex + 1}: ${item.title}`);
        question = { ...base, type: 'select', questionType: 'matching-headings', responseType: 'matching', text: `Choose the best heading for Passage ${passageNumber}.`, answerSlots: [{ id: `${id}_heading`, label: 'Heading', correctAnswers: [heading] }], sharedChoices: headings };
      } else if (kind === 5) question = { ...base, type: 'select', questionType: 'matching-information', responseType: 'matching', text: `Which passage contains this information? ${fact}`, answerSlots: [{ id: `${id}_passage`, label: 'Passage', correctAnswers: [`Passage ${passageNumber}`] }], sharedChoices: passages.map((_, itemIndex) => `Passage ${itemIndex + 1}`) };
      else if (kind === 6) question = { ...base, type: 'select', questionType: 'sentence-endings', responseType: 'matching', text: `Match the idea in the question to its answer: ${prompt}`, answerSlots: [{ id: `${id}_ending`, label: 'Answer', correctAnswers: [answer] }], sharedChoices: choices };
      else if (kind === 7) {
        const caseType = globalIndex % 3;
        const claim = caseType === 1 ? `The passage reports that a documentary was made about ${passage.title}.` : caseType === 2 ? `It is not the case that ${fact}` : fact;
        question = { ...base, type: 'mcq', questionType: 'yes-no-not-given', responseType: 'single-choice', text: `Does the passage state that this claim is accurate? “${claim}”`, options: ['Yes', 'No', 'Not Given'], correctAnswer: caseType === 1 ? 'Not Given' : caseType === 2 ? 'No' : 'Yes' };
      } else question = { ...base, type: 'mcq', questionType: 'multiple-choice', responseType: 'single-choice', options: choices, correctAnswer: answer };
      questions.push(question);
    });
  });
  if (questions.length !== 40) throw new Error(`${variant} bank must have exactly 40 questions.`);
  return {
    schemaVersion: 1,
    title: `IELTS ${variant === 'academic' ? 'Academic' : 'General Training'} Reading — Full-Length Original Practice`,
    description: 'Unofficial original practice: three passages, 40 questions, and 60 minutes. This is not an official IELTS test.',
    type: 'IELTS', category: 'Practice', durationSeconds: 3600,
    settings: { ieltsVariant: variant, unofficialPractice: true, questionCount: 40 },
    sections: { reading: { instructions: 'Answer all 40 questions. Use evidence in each passage; the practice uses the teacher review workflow.', passages: passages.map((passage, index) => ({ passageNumber: index + 1, title: passage.title, content: passage.content })) } },
    questions,
  };
};

for (const [variant, passages] of [['academic', academic], ['general', general]]) {
  const bank = makeBank(variant, passages);
  const name = `ielts-${variant}-reading-full.json`;
  mkdirSync(new URL('../sample-data/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`../sample-data/${name}`, import.meta.url), `${JSON.stringify(bank, null, 2)}\n`);
  console.log(`Wrote ${name} with 40 questions.`);
}
