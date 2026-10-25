import { mkdirSync, writeFileSync } from 'node:fs';

const sections = [
  {
    title: 'Section 1 — Riverside repair booking', context: 'Two speakers: a customer arranges a bicycle repair with a service desk.',
    transcript: 'CUSTOMER: I need to book my bicycle in. It is a green touring bike, not the blue road bike I brought last year. CLERK: What is the frame number? CUSTOMER: 48271. The front brake cable has frayed, and the rear tyre loses air overnight. CLERK: We can inspect both. The workshop is at 18 Willow Lane. The earliest appointment is Thursday the 14th at 9:30. CUSTOMER: I have a class then. Is Friday possible? CLERK: Friday the 15th, at 11:00. CUSTOMER: That works. Please use my mobile ending 6042. CLERK: The inspection costs £12, payable when you collect it. If we need parts, we will call before doing extra work. CUSTOMER: I will bring the lock key too. CLERK: Please leave the bicycle by the side entrance, not the front counter.',
    questions: [
      ['What colour is the bicycle?', 'short-text', 'green', ['green'], 'The customer identifies it as green.'],
      ['What kind of bicycle is being booked?', 'short-text', 'touring bike', ['touring bike'], 'The customer distinguishes it from a road bike.'],
      ['What is the frame number?', 'numeric', 48271, [], 'The number given is 48271.'],
      ['Which part has frayed?', 'short-text', 'front brake cable', ['front brake cable'], 'The customer reports a frayed front brake cable.'],
      ['What happens to the rear tyre?', 'short-text', 'It loses air overnight', ['loses air overnight', 'it loses air overnight'], 'The rear tyre loses air overnight.'],
      ['Where is the workshop?', 'short-text', '18 Willow Lane', ['18 Willow Lane'], 'The address is 18 Willow Lane.'],
      ['Which appointment does the customer choose?', 'short-text', 'Friday the 15th at 11:00', ['Friday the 15th', 'Friday at 11:00'], 'The customer accepts Friday the 15th at 11:00.'],
      ['What are the last four digits of the mobile number?', 'numeric', 6042, [], 'The number ends in 6042.'],
      ['How much is the inspection?', 'numeric', 12, [], 'The fee is £12.'],
      ['Where should the bicycle be left?', 'mcq', 'By the side entrance', [], 'The clerk says to use the side entrance.'],
    ],
  },
  {
    title: 'Section 2 — Bellmere wetland visitor route', context: 'A guide gives visitors information about a nature reserve.',
    transcript: 'GUIDE: Welcome to Bellmere Wetland. The visitor centre opens at 8:30, and the last entry is 4:15. Please begin at the east gate because the north gate is closed for repairs this month. The blue route is 2.4 kilometres and takes about 50 minutes. The shorter reed-bed loop is 1.1 kilometres, but it is closed after heavy rain. Binoculars can be borrowed at the information desk for a refundable deposit of five pounds. The observation tower is the best place to see herons, especially before midday. The café is beside the old pump house, not inside the visitor centre. At 10:00 and 2:00, a ranger leads a free walk from the map board. Dogs are welcome only on the gravel path and must remain on a lead. Please do not feed the ducks; bread can harm them. The accessible toilet is behind the education room.',
    questions: [
      ['What time does the visitor centre open?', 'short-text', '8:30', ['8:30', '8.30'], 'The centre opens at 8:30.'],
      ['Which gate should visitors use?', 'mcq', 'East gate', [], 'The guide directs visitors to the east gate.'],
      ['How long is the blue route?', 'numeric', 2.4, [], 'The route is 2.4 kilometres.'],
      ['When is the reed-bed loop closed?', 'mcq', 'After heavy rain', [], 'It closes after heavy rain.'],
      ['What deposit is required for binoculars?', 'numeric', 5, [], 'The deposit is five pounds.'],
      ['Where are herons easiest to see?', 'mcq', 'The observation tower', [], 'The guide recommends the observation tower.'],
      ['Where is the café?', 'short-text', 'Beside the old pump house', ['old pump house'], 'It is beside the old pump house.'],
      ['At what times do ranger walks begin?', 'multi-blank', ['10:00', '2:00'], [], 'The walks begin at 10:00 and 2:00.'],
      ['Where may dogs walk?', 'mcq', 'On the gravel path', [], 'Dogs are restricted to the gravel path.'],
      ['Why should visitors not feed the ducks?', 'short-text', 'Bread can harm them', ['bread can harm them'], 'The guide says bread can harm the ducks.'],
    ],
  },
  {
    title: 'Section 3 — Student research project meeting', context: 'Two students and a tutor discuss a university research project.',
    transcript: 'TUTOR: Your project is about how students use quiet study rooms. What have you done so far? MAYA: We planned to interview staff, but the booking system already provides useful room-occupancy data. LEO: We will still interview students about why they choose particular rooms. TUTOR: How many responses do you have? MAYA: The pilot survey had 18 responses. We revised two confusing questions and sent the final survey to three departments; it closes on the 22nd. LEO: We will compare morning and evening use, but we should not claim that room design causes a preference. TUTOR: Correct. Your sample is self-selected. What about the presentation? MAYA: I will make the charts. LEO: I will write the limitations section and check the references. MAYA: We both need to explain the method. TUTOR: Use the seminar room projector, but bring a backup PDF on a USB drive. The library printer is unreliable. LEO: We should meet on Tuesday at 3:15 to rehearse. TUTOR: Good. Your report is due on the 30th, not the 28th listed on the old course page.',
    questions: [
      ['What data source did the students discover?', 'short-text', 'Room-occupancy data', ['room occupancy data', 'booking system data'], 'The booking system contains occupancy data.'],
      ['How many responses were in the pilot survey?', 'numeric', 18, [], 'The pilot had 18 responses.'],
      ['How many departments received the final survey?', 'numeric', 3, [], 'It was sent to three departments.'],
      ['When does the survey close?', 'short-text', 'the 22nd', ['22nd', '22'], 'The survey closes on the 22nd.'],
      ['Why should the students avoid a causal claim?', 'short-text', 'The sample is self-selected', ['self-selected', 'sample is self-selected'], 'The tutor notes that the sample is self-selected.'],
      ['Who will make the charts?', 'mcq', 'Maya', [], 'Maya takes responsibility for the charts.'],
      ['Who will write the limitations section?', 'mcq', 'Leo', [], 'Leo will write that section.'],
      ['What backup should they bring?', 'short-text', 'A PDF on a USB drive', ['PDF on a USB drive', 'backup PDF'], 'They plan to bring a PDF on a USB drive.'],
      ['When will they rehearse?', 'short-text', 'Tuesday at 3:15', ['Tuesday 3:15', 'Tuesday at 3:15'], 'They agree to meet Tuesday at 3:15.'],
      ['When is the report due?', 'short-text', 'the 30th', ['30th', '30'], 'The tutor corrects the old page: it is due on the 30th.'],
    ],
  },
  {
    title: 'Section 4 — Repair cafés and product life', context: 'A lecturer explains a small study of community repair cafés.',
    transcript: 'LECTURER: A repair café is a community event where volunteers help residents fix household objects. Our study followed four cafés in the fictional region of Eastmere for six months. Volunteers recorded the item, the fault, and whether it was repaired, but did not record visitors’ names. The most common items were lamps, small kitchen appliances, and clothing. Electrical items were tested with a portable safety meter after repair. About 62 percent of all items were repaired during the visit; another 14 percent needed a part that the café did not have. The organisers found that a clear booking form reduced waiting time more effectively than adding extra tables. However, the study cannot show how long repaired objects remained in use. A follow-up survey is planned for next spring. The team recommends publishing repair instructions with photographs, because several volunteers reported that written steps alone were difficult to follow. It also recommends separating safety checks from cosmetic improvements. The regional grant will fund tools, but not permanent staff. Further research should compare rural and urban events, since transport to a café may be a barrier for some residents.',
    questions: [
      ['How many cafés did the study follow?', 'numeric', 4, [], 'The study followed four cafés.'],
      ['For how long were they observed?', 'numeric', 6, [], 'The observation period was six months.'],
      ['Which personal detail was not recorded?', 'mcq', 'Visitors’ names', [], 'The volunteers did not record names.'],
      ['Name one common item category.', 'short-text', 'lamps', ['lamps', 'small kitchen appliances', 'clothing'], 'The lecturer lists lamps, appliances, and clothing.'],
      ['What was used to check electrical items?', 'short-text', 'a portable safety meter', ['portable safety meter'], 'Electrical items were checked with a portable safety meter.'],
      ['What percentage of items were repaired during the visit?', 'numeric', 62, [], 'The figure given is about 62 percent.'],
      ['What reduced waiting time more effectively than extra tables?', 'short-text', 'A clear booking form', ['clear booking form'], 'The booking form was more effective.'],
      ['What question will the follow-up survey investigate?', 'short-text', 'How long repaired objects stayed in use', ['how long repaired objects remained in use', 'how long repaired objects stayed in use'], 'The study lacks evidence about durability.'],
      ['How should repair instructions be presented?', 'mcq', 'With photographs', [], 'The team recommends adding photographs.'],
      ['Which events should future research compare?', 'mcq', 'Rural and urban events', [], 'The lecturer calls for rural-urban comparison.'],
    ],
  },
];

const questions = [];
const parts = sections.map((section, index) => {
  const sectionNumber = index + 1;
  const transformed = section.questions.map(([prompt, mode, answer, accepted, explanation], questionIndex) => {
    const isChoice = mode === 'mcq';
    const isBlank = mode === 'multi-blank';
    const distractorsByAnswer = {
      'By the side entrance': ['At the front counter', 'Inside the café', 'At the east gate'],
      'East gate': ['North gate', 'West gate', 'Visitor centre'],
      'After heavy rain': ['Before midday', 'Every Thursday', 'During the winter'],
      'The observation tower': ['The café', 'The east gate', 'The education room'],
      'On the gravel path': ['On every trail', 'Inside the café', 'At the north gate'],
      'Maya': ['Leo', 'The tutor', 'The research assistant'],
      'Leo': ['Maya', 'The tutor', 'The librarian'],
      'Visitors’ names': ['The item type', 'The repair outcome', 'The café location'],
      'With photographs': ['With audio only', 'With no instructions', 'With handwritten labels'],
      'Rural and urban events': ['Morning and evening classes', 'Old and new devices', 'Indoor and outdoor cafés'],
    };
    const finalOptions = isChoice ? [String(answer), ...(distractorsByAnswer[String(answer)] || [])] : undefined;
    const question = {
      id: `ielts_listen_s${sectionNumber}_q${questionIndex + 1}`,
      type: isChoice ? 'mcq' : isBlank ? 'text' : mode === 'numeric' ? 'number' : 'text',
      section: 'listening', listeningSectionNumber: sectionNumber,
      questionType: isChoice ? 'multiple-choice' : isBlank ? 'completion' : 'short-answer',
      responseType: isChoice ? 'single-choice' : isBlank ? 'multi-blank' : mode,
      text: prompt,
      ...(finalOptions ? { options: finalOptions } : {}),
      ...(isBlank ? { answerSlots: answer.map((value, slotIndex) => ({ id: `blank${slotIndex + 1}`, label: String(slotIndex + 1), correctAnswers: [value] })), points: answer.length }
        : { correctAnswer: answer, ...(accepted?.length ? { acceptedAnswers: accepted } : {}), points: 1 }),
      difficulty: sectionNumber < 3 ? 'medium' : 'hard', explanation,
    };
    questions.push(question);
    return question;
  });
  return {
    sectionNumber, title: section.title, instructions: section.context,
    recordingScript: section.transcript,
    recordingNotes: 'Teacher: record this original dialogue/lecture at a natural pace, include the speaker changes, and leave short pauses between answer-bearing details. Upload a browser-playable audio file, listen through it, and tick Audio verified before publishing.',
    audioUrl: '', audioVerified: false, mediaStatus: 'required', questionIds: transformed.map(question => question.id),
  };
});
const bank = {
  schemaVersion: 1, title: 'IELTS Listening — Full-Length Original Practice (Audio Required)',
  description: 'Original 4-section, 40-question script-based practice draft. No recording is included. Do not publish until real recordings are attached and verified for all four sections.',
  type: 'IELTS', category: 'Practice', durationSeconds: 30 * 60,
  sections: { listening: { instructions: 'Four sections, 10 questions each. Allow 30 minutes for the recording and 10 minutes for answer transfer. Normal student use requires one verified recording per section.', transferTimeSeconds: 600, parts } },
  questions,
};
if (questions.length !== 40 || parts.some(part => part.questionIds.length !== 10 || part.audioUrl || part.audioVerified)) throw new Error('Listening full bank count/readiness mismatch.');
mkdirSync('sample-data', { recursive: true });
writeFileSync('sample-data/ielts-listening-full.json', `${JSON.stringify(bank, null, 2)}\n`);
