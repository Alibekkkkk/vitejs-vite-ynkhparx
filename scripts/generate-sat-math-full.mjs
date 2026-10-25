import { mkdirSync, writeFileSync } from 'node:fs';

const questions = [];
const add = (domain, skill, text, answer, explanation, _module) => {
  const numericAnswer = typeof answer === 'number';
  const gridIn = numericAnswer && questions.length % 2 === 0;
  const multipleChoice = numericAnswer && !gridIn;
  const id = `sat_math_${String(questions.length + 1).padStart(2, '0')}`;
  const wrong = multipleChoice ? [answer + 2, answer - 2, answer + 5].map(value => Number(value.toFixed(2))) : [];
  const options = multipleChoice ? [...new Set([answer, ...wrong])].map(String) : [];
  if (multipleChoice) options.sort((a, b) => Number(a) - Number(b));
  questions.push({
    id,
    type: multipleChoice ? 'mcq' : 'text',
    section: 'math',
    satSection: 'math',
    satModule: questions.length < 22 ? 1 : 2,
    satDomain: domain,
    satSkill: skill,
    questionType: multipleChoice ? 'multiple-choice' : gridIn ? 'sat-student-produced-response' : 'short-answer',
    responseType: multipleChoice ? 'single-choice' : gridIn ? 'numeric' : 'short-text',
    text,
    ...(multipleChoice ? { options, correctAnswer: String(answer) } : { correctAnswer: answer }),
    points: 1,
    difficulty: questions.length % 3 === 0 ? 'hard' : questions.length % 2 ? 'medium' : 'easy',
    explanation,
  });
};

const A = 'Algebra';
[
  ['Linear equations', 'Solve 4x + 7 = 39.', 8, 'Subtract 7, then divide 32 by 4.'],
  ['Linear equations in two variables', 'A line passes through (2, 3) and (6, 15). What is its slope?', 3, 'The slope is (15 − 3)/(6 − 2) = 3.'],
  ['Linear functions', 'For f(x) = 2x + 5, what is f(7)?', 19, 'Substitute 7: 14 + 5 = 19.'],
  ['Systems of two linear equations in two variables', 'If 3x + y = 17 and x − y = 3, what is x?', 5, 'Adding the equations gives 4x = 20, so x = 5.'],
  ['Linear inequalities', 'What is the greatest integer x satisfying 5x − 4 < 21?', 4, 'The inequality gives x < 5, so the greatest integer is 4.'],
  ['Linear equations in one variable', 'A recipe uses flour and water in the ratio 5:6. If it uses 18 cups of water, how many cups of flour does it use?', 15, '18 × 5/6 = 15.'],
  ['Linear functions', 'A tank contains 12 litres and fills at 3 litres per minute. How many litres are in it after 8 minutes?', 36, '12 + 3(8) = 36.'],
  ['Ratios, rates, and units', 'Six notebooks cost $45 at a constant price. What is the cost per notebook in dollars?', 7.5, '45 ÷ 6 = 7.5.'],
  ['Percentages', 'Eighteen is 20 percent of what number?', 90, '0.20n = 18, so n = 90.'],
  ['Linear equations in two variables', 'The line y = 2x − 12 crosses the x-axis at what x-coordinate?', 6, 'Set y = 0: 2x − 12 = 0, so x = 6.'],
  ['Linear functions', 'A club had 28 members and adds 4 members each month. After how many months will it have 60 members?', 8, '28 + 4m = 60, so m = 8.'],
].forEach(([skill, text, answer, explanation], index) => add(A, skill, text, answer, explanation, index < 6 ? 1 : 2));

const M = 'Advanced Math';
[
  ['Nonlinear equations', 'What is the larger solution to x² − 5x + 6 = 0?', 3, 'Factor as (x − 2)(x − 3) = 0; the larger root is 3.'],
  ['Nonlinear equations in one variable', 'If x² = 81 and x is positive, what is x?', 9, 'The positive square root of 81 is 9.'],
  ['Equivalent expressions', 'For nonzero x, simplify (x⁵ · x³)/x² as a power of x.', 'x^6', 'Add exponents when multiplying and subtract when dividing: 5 + 3 − 2 = 6.'],
  ['Equivalent expressions', 'Simplify 2(x − 3) + 4x.', '6x - 6', 'Distribute 2 and combine like terms.'],
  ['Nonlinear functions', 'The function f(x) = (x − 4)² + 2 has its minimum at what x-value?', 4, 'A squared expression is smallest when x − 4 = 0.'],
  ['Nonlinear equations in one variable', 'What is the larger solution to x² + 2x − 15 = 0?', 3, 'Factor as (x + 5)(x − 3) = 0; the larger root is 3.'],
  ['Nonlinear equations in one variable', 'If 2ˣ = 32, what is x?', 5, 'Since 32 = 2⁵, x = 5.'],
  ['Nonlinear functions', 'If g(x) = x² − 1, what is g(4)?', 15, 'Substitute 4: 16 − 1 = 15.'],
  ['Nonlinear equations', 'What is the smaller zero of (x − 2)(x + 5)?', -5, 'The zeros are 2 and −5; the smaller is −5.'],
  ['Nonlinear equations in one variable', 'If 3^(x + 1) = 81, what is x?', 3, '81 = 3⁴, so x + 1 = 4.'],
  ['Equivalent expressions', 'Simplify (3x²)(2x³).', '6x^5', 'Multiply coefficients and add exponents: 3·2 = 6 and 2 + 3 = 5.'],
].forEach(([skill, text, answer, explanation], index) => add(M, skill, text, answer, explanation, index < 6 ? 1 : 2));

const D = 'Problem-Solving and Data Analysis';
[
  ['One-variable data: distributions and measures of center and spread', 'What is the mean of 8, 10, 12, and 14?', 11, 'The sum is 44; 44 ÷ 4 = 11.'],
  ['One-variable data: distributions and measures of center and spread', 'What is the median of 3, 5, 7, 9, and 20?', 7, 'The middle value in the ordered list is 7.'],
  ['Percentages', 'A price rises from $80 to $100. What is the percent increase?', 25, 'The increase is 20; 20/80 × 100 = 25%.'],
  ['Probability and conditional probability', 'A bag has 3 red and 7 blue counters. What is the probability of selecting a red counter, as a decimal?', 0.3, 'There are 3 red counters among 10 total.'],
  ['Ratios, rates, proportional relationships, and units', 'A batch uses 4 cups of oats for 5 servings. How many cups are needed for 65 servings at the same rate?', 52, '65 × 4/5 = 52.'],
  ['Two-variable data: models and scatterplots', 'A line of best fit passes through (1, 5) and (4, 14). What is its slope?', 3, '(14 − 5)/(4 − 1) = 3.'],
  ['One-variable data: distributions and measures of center and spread', 'The mean of 4, 8, and x is 10. What is x?', 18, '(4 + 8 + x)/3 = 10, so x = 18.'],
  ['Inference from sample statistics and margin of error', 'In a survey, 30 of 120 respondents chose option A. What fraction of the sample chose A?', 0.25, '30 ÷ 120 = 0.25.'],
  ['Evaluating statistical claims: observational studies and experiments', 'A study randomly assigns volunteers to two exercise plans. Which kind of study is this?', 'experiment', 'Researchers assign a treatment, so it is an experiment.'],
  ['Ratios, rates, and units', 'A printer produces 84 pages in 7 minutes at a constant rate. How many pages per minute?', 12, '84 ÷ 7 = 12.'],
  ['Percentages', 'A town survey finds that 40% of 250 respondents prefer the park plan. How many respondents is that?', 100, '0.40 × 250 = 100.'],
].forEach(([skill, text, answer, explanation], index) => add(D, skill, text, answer, explanation, index < 6 ? 1 : 2));

const G = 'Geometry and Trigonometry';
[
  ['Area and volume', 'A triangle has base 12 and height 7. What is its area?', 42, 'Area = 1/2 × 12 × 7 = 42.'],
  ['Circles', 'A circle has radius 5. What is its circumference in terms of π?', '10π', 'Circumference = 2πr = 10π.'],
  ['Right triangles', 'A right triangle has legs 6 and 8. What is the hypotenuse?', 10, 'By the Pythagorean theorem, √(36 + 64) = 10.'],
  ['Area and volume', 'A rectangular prism measures 3 by 4 by 8 units. What is its volume?', 96, 'Volume = 3 × 4 × 8 = 96.'],
  ['Lines, angles, and triangles', 'Similar triangles have corresponding side lengths in the ratio 2:5. A shorter-triangle side is 8. What is the corresponding longer side?', 20, 'Scale by 5/2: 8 × 2.5 = 20.'],
  ['Lines and angles', 'Two angles on a straight line measure x° and 65°. What is x?', 115, 'A linear pair sums to 180°, so x = 115°.'],
  ['Right triangles and trigonometry', 'In a right triangle, the side opposite angle θ is 5 and the hypotenuse is 13. What is sin θ?', '5/13', 'Sine is opposite divided by hypotenuse.'],
  ['Circles', 'A circle has diameter 14. What is its area in terms of π?', '49π', 'The radius is 7, so area = π(7²) = 49π.'],
  ['Area and volume', 'A box is 5 cm long, 4 cm wide, and 3 cm high. What is its volume?', 60, 'Multiply the three dimensions: 5 × 4 × 3 = 60.'],
  ['Area and volume', 'A parallelogram has base 11 and perpendicular height 6. What is its area?', 66, 'Area = base × height = 11 × 6.'],
  ['Right triangles', 'A 30°-60°-90° triangle has a shorter leg of length 7. What is the hypotenuse?', 14, 'In this special triangle, the hypotenuse is twice the shorter leg.'],
].forEach(([skill, text, answer, explanation], index) => add(G, skill, text, answer, explanation, index < 6 ? 1 : 2));

const bank = {
  schemaVersion: 1,
  title: 'Digital SAT Math — Full-Length Original Practice',
  description: 'Unofficial original practice: 44 questions in two 22-question modules, 35 minutes each (70 minutes total). Not an official SAT or scaled score.',
  type: 'SAT',
  category: 'Practice',
  durationSeconds: 4200,
  settings: { unofficialPractice: true, modules: [{ module: 1, questionCount: 22, durationSeconds: 2100 }, { module: 2, questionCount: 22, durationSeconds: 2100 }] },
  sections: { sat: { section: 'math', instructions: 'Complete both 22-question modules. The portal reports teacher-reviewed points only and does not calculate an official SAT scaled score.', modules: [{ module: 1, firstQuestion: 1, lastQuestion: 22, durationSeconds: 2100 }, { module: 2, firstQuestion: 23, lastQuestion: 44, durationSeconds: 2100 }] } },
  questions,
};

if (questions.length !== 44 || questions.slice(0, 22).some(question => question.satModule !== 1) || questions.slice(22).some(question => question.satModule !== 2)) throw new Error('SAT Math structure is invalid.');
mkdirSync(new URL('../sample-data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../sample-data/sat-math-full.json', import.meta.url), `${JSON.stringify(bank, null, 2)}\n`);
console.log('Wrote 44 original SAT Math questions in two 22-question modules.');
