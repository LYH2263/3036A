import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedWord = readonly [string, string, string, string];

const TARGET_WORDS_COUNT = 9300;
const WORD_LIST_FILE = 'google-10000-english-no-swears.txt';
const EXPLAINED_WORD_LIST_FILE = '30k-explained.txt';
const MAX_WORD_LENGTH = 24;
const TEST_ACCOUNT_EMAIL = 'test@lexigram.local';
const TEST_ACCOUNT_PASSWORD = 'Test123456';

const coreWords = [
  ['abandon', '放弃；遗弃', 'He decided to abandon the old plan.', '/əˈbændən/'],
  ['ability', '能力；才能', 'Practice improves your ability to speak English.', '/əˈbɪləti/'],
  ['banana', '香蕉', 'I eat a banana every morning.', '/bəˈnænə/'],
  ['achieve', '实现；达到', 'She worked hard to achieve her goal.', '/əˈtʃiːv/'],
  ['adapt', '适应；改编', 'You need to adapt to a new schedule quickly.', '/əˈdæpt/'],
  ['analysis', '分析', 'The report includes a detailed analysis of data.', '/əˈnæləsɪs/'],
  ['approach', '方法；接近', 'We need a practical approach to learning.', '/əˈprəʊtʃ/'],
  ['attempt', '尝试', 'She made an attempt to answer every question.', '/əˈtempt/'],
  ['benefit', '好处；受益', 'Daily reading will benefit your vocabulary.', '/ˈbenɪfɪt/'],
  ['challenge', '挑战', 'Grammar can be a challenge at first.', '/ˈtʃælɪndʒ/'],
  ['combine', '结合；合并', 'Try to combine new words with examples.', '/kəmˈbaɪn/'],
  ['communicate', '交流；沟通', 'You must communicate clearly in meetings.', '/kəˈmjuːnɪkeɪt/'],
  ['compare', '比较', 'Compare these two sentences carefully.', '/kəmˈpeə(r)/'],
  ['complex', '复杂的', 'The grammar rule is not as complex as it looks.', '/ˈkɒmpleks/'],
  ['conclude', '得出结论', 'Can you conclude this paragraph in one sentence?', '/kənˈkluːd/'],
  ['confirm', '确认', 'Please confirm your email address.', '/kənˈfɜːm/'],
  ['consider', '考虑', 'Consider using shorter sentences.', '/kənˈsɪdə(r)/'],
  ['constant', '持续的；恒定的', 'Learning needs constant effort.', '/ˈkɒnstənt/'],
  ['context', '语境；上下文', 'New words are easier in context.', '/ˈkɒntekst/'],
  ['create', '创造；创建', 'Create a review schedule for this week.', '/kriˈeɪt/'],
  ['critical', '关键的；批判的', 'Critical thinking helps with writing.', '/ˈkrɪtɪkəl/'],
  ['debate', '辩论', 'They had a debate about education.', '/dɪˈbeɪt/'],
  ['define', '定义', 'Please define this term in English.', '/dɪˈfaɪn/'],
  ['demonstrate', '演示；证明', 'The teacher will demonstrate the usage.', '/ˈdemənstreɪt/'],
  ['detail', '细节', 'Pay attention to detail in grammar.', '/ˈdiːteɪl/'],
  ['device', '设备', 'This app works on most mobile devices.', '/dɪˈvaɪs/'],
  ['efficient', '高效的', 'A spaced review plan is efficient.', '/ɪˈfɪʃnt/'],
  ['enhance', '提高；增强', 'Listening can enhance your pronunciation.', '/ɪnˈhɑːns/'],
  ['evaluate', '评估', 'Evaluate your progress every week.', '/ɪˈvæljueɪt/'],
  ['evidence', '证据', 'Use evidence to support your opinion.', '/ˈevɪdəns/'],
  ['expand', '扩展', 'Reading novels can expand your vocabulary.', '/ɪkˈspænd/'],
  ['feature', '特征；功能', 'The app has a sync feature.', '/ˈfiːtʃə(r)/'],
  ['focus', '专注；焦点', 'Focus on one grammar point each day.', '/ˈfəʊkəs/'],
  ['frequent', '频繁的', 'Frequent review improves memory.', '/ˈfriːkwənt/'],
  ['function', '功能；作用', 'This button has a clear function.', '/ˈfʌŋkʃn/'],
  ['generate', '生成；产生', 'The system can generate a review list.', '/ˈdʒenəreɪt/'],
  ['improve', '改进；提高', 'Practice will improve your fluency.', '/ɪmˈpruːv/'],
  ['include', '包含', 'Include one example sentence for each word.', '/ɪnˈkluːd/'],
  ['insight', '洞察', 'The chart gives useful insight.', '/ˈɪnsaɪt/'],
  ['interact', '互动', 'Students interact with exercises online.', '/ˌɪntərˈækt/'],
  ['maintain', '保持；维护', 'Maintain your learning streak.', '/meɪnˈteɪn/'],
  ['method', '方法', 'This method works for beginners.', '/ˈmeθəd/'],
  ['modify', '修改', 'You can modify the sentence to fit context.', '/ˈmɒdɪfaɪ/'],
  ['objective', '目标；客观的', 'Set an objective for this month.', '/əbˈdʒektɪv/'],
  ['organize', '组织', 'Organize vocabulary by topic.', '/ˈɔːɡənaɪz/'],
  ['pattern', '模式', 'Notice the pattern in these sentences.', '/ˈpætən/'],
  ['practice', '练习', 'Practice speaking every morning.', '/ˈpræktɪs/'],
  ['predict', '预测', 'Can you predict the next word?', '/prɪˈdɪkt/'],
  ['progress', '进步', 'Track your progress weekly.', '/ˈprəʊɡres/'],
  ['pronounce', '发音', 'Try to pronounce this word clearly.', '/prəˈnaʊns/'],
  ['review', '复习；回顾', 'Review difficult words before bed.', '/rɪˈvjuː/'],
  ['schedule', '计划表', 'A schedule helps you stay consistent.', '/ˈʃedjuːl/'],
  ['specific', '具体的', 'Give specific examples in your answer.', '/spəˈsɪfɪk/'],
  ['strategy', '策略', 'A good strategy saves time.', '/ˈstrætədʒi/'],
  ['structure', '结构', 'This grammar structure is common.', '/ˈstrʌktʃə(r)/'],
  ['suitable', '合适的', 'Choose a suitable study plan.', '/ˈsuːtəbl/'],
  ['support', '支持', 'Examples support your argument.', '/səˈpɔːt/'],
  ['target', '目标', 'Set a target of 10 words a day.', '/ˈtɑːɡɪt/'],
  ['technique', '技巧', 'Use a memory technique for long words.', '/tekˈniːk/'],
  ['understand', '理解', 'I understand this rule now.', '/ˌʌndəˈstænd/'],
  ['update', '更新', 'Update your notes after class.', '/ˌʌpˈdeɪt/'],
  ['visualize', '可视化', 'Visualize your progress on charts.', '/ˈvɪʒuəlaɪz/']
] as const satisfies readonly SeedWord[];

function resolveDataFilePath(fileName: string): string {
  const cwdPath = path.join(process.cwd(), 'prisma', 'data', fileName);
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  const currentFilePath = path.join(__dirname, 'data', fileName);
  if (existsSync(currentFilePath)) {
    return currentFilePath;
  }

  throw new Error(`词典文件不存在：${fileName}`);
}

function resolveWordListPath(): string {
  return resolveDataFilePath(WORD_LIST_FILE);
}

function resolveExplainedWordListPath(): string {
  return resolveDataFilePath(EXPLAINED_WORD_LIST_FILE);
}

function loadExtendedWordCandidates(): string[] {
  const raw = readFileSync(resolveWordListPath(), 'utf8');
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-z]+(?:['-][a-z]+)?$/.test(item))
    .filter((item) => item.length >= 2 && item.length <= MAX_WORD_LENGTH);
}

function toPrimaryPhonetic(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const first = trimmed
    .split(/\s{2,}|\t+/)
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (!first) {
    return '';
  }

  const normalized = first.replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}/` : '';
}

type DictionaryEntry = Readonly<{
  definition: string;
  phonetic: string;
}>;

function loadWordDictionary(): Map<string, DictionaryEntry> {
  const raw = readFileSync(resolveExplainedWordListPath(), 'utf8');
  const lines = raw.split(/\r?\n/);
  const dictionary = new Map<string, DictionaryEntry>();

  for (let i = 0; i + 2 < lines.length; i += 1) {
    const header = lines[i]?.trim() ?? '';
    const match = header.match(/^([a-z]+(?:['-][a-z]+)?)\s+\d+$/i);
    if (!match) {
      continue;
    }

    const word = match[1].toLowerCase();
    const phonetic = toPrimaryPhonetic(lines[i + 1] ?? '');
    const definition = (lines[i + 2] ?? '').trim();

    if (!definition) {
      continue;
    }

    dictionary.set(word, {
      definition,
      phonetic
    });
  }

  return dictionary;
}

function hasChineseText(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function buildExtendedWords(
  baseWords: readonly SeedWord[],
  dictionary: Map<string, DictionaryEntry>
): SeedWord[] {
  const needed = Math.max(0, TARGET_WORDS_COUNT - baseWords.length);
  if (needed === 0) {
    return [];
  }

  const existing = new Set(baseWords.map(([word]) => word.toLowerCase()));
  const candidates = loadExtendedWordCandidates();
  const generated: SeedWord[] = [];

  for (const word of candidates) {
    if (generated.length >= needed) {
      break;
    }
    if (existing.has(word)) {
      continue;
    }

    const dictionaryEntry = dictionary.get(word);
    if (!dictionaryEntry || !hasChineseText(dictionaryEntry.definition)) {
      continue;
    }

    existing.add(word);
    generated.push([
      word,
      dictionaryEntry.definition,
      `I am learning the word "${word}" in lexigram.`,
      dictionaryEntry.phonetic
    ] as const);
  }

  if (generated.length < needed) {
    throw new Error(
      `扩展词库不足或词义缺失：目标 ${TARGET_WORDS_COUNT}，现有 ${baseWords.length + generated.length}`
    );
  }

  return generated;
}

function assertChineseDefinitionCoverage(allWords: readonly SeedWord[]) {
  const missing = allWords
    .filter(([, definition]) => !hasChineseText(definition))
    .map(([word]) => word);

  if (missing.length > 0) {
    throw new Error(`存在缺少中文词义的单词：${missing.slice(0, 10).join(', ')}`);
  }
}

const wordDictionary = loadWordDictionary();
const words = [...coreWords, ...buildExtendedWords(coreWords, wordDictionary)];
assertChineseDefinitionCoverage(words);

const lessons = [
  {
    title: '一般现在时',
    level: 'basic',
    content:
      '一般现在时用于描述习惯、事实与经常性动作。主语为第三人称单数时，谓语动词通常加 -s/-es。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'She ____ to school by bus every day.',
        options: ['go', 'goes', 'went', 'going'],
        answer: 'goes',
        explanation: '第三人称单数 she 对应 goes。'
      },
      {
        type: 'fill_blank',
        prompt: 'The earth ____ around the sun.',
        options: [],
        answer: 'moves',
        explanation: '客观事实使用一般现在时。'
      },
      {
        type: 'single_choice',
        prompt: 'Which sentence is correct?',
        options: ['He play football.', 'He plays football.', 'He playing football.'],
        answer: 'He plays football.',
        explanation: '第三人称单数动词加 s。'
      }
    ]
  },
  {
    title: '一般过去时',
    level: 'basic',
    content: '一般过去时表示过去发生的动作或状态，常与 yesterday、last week 等时间状语连用。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'We ____ a movie last night.',
        options: ['watch', 'watched', 'watches'],
        answer: 'watched',
        explanation: 'last night 提示过去时。'
      },
      {
        type: 'fill_blank',
        prompt: 'She ____ (be) very tired yesterday.',
        options: [],
        answer: 'was',
        explanation: '主语 she 在过去时用 was。'
      },
      {
        type: 'single_choice',
        prompt: 'Which one is NOT past tense?',
        options: ['studied', 'ran', 'studies'],
        answer: 'studies',
        explanation: 'studies 为一般现在时。'
      }
    ]
  },
  {
    title: '一般将来时',
    level: 'basic',
    content: '一般将来时表达将要发生的动作，常见结构为 will + 动词原形。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'I ____ call you tonight.',
        options: ['will', 'am', 'did'],
        answer: 'will',
        explanation: '一般将来时常用 will。'
      },
      {
        type: 'fill_blank',
        prompt: 'They ____ (visit) Beijing next month.',
        options: [],
        answer: 'will visit',
        explanation: 'next month 提示将来。'
      },
      {
        type: 'single_choice',
        prompt: 'Future tense sentence:',
        options: ['He is tired.', 'He will arrive soon.', 'He arrived.'],
        answer: 'He will arrive soon.',
        explanation: 'will + 动词原形。'
      }
    ]
  },
  {
    title: '现在进行时',
    level: 'basic',
    content: '现在进行时表示正在发生的动作，结构为 am/is/are + doing。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'Listen! The birds ____.',
        options: ['sing', 'are singing', 'sang'],
        answer: 'are singing',
        explanation: 'Listen! 常搭配进行时。'
      },
      {
        type: 'fill_blank',
        prompt: 'I ____ (read) a book now.',
        options: [],
        answer: 'am reading',
        explanation: 'now 提示正在进行。'
      },
      {
        type: 'single_choice',
        prompt: 'Which is present continuous?',
        options: ['She cooks dinner.', 'She is cooking dinner.', 'She cooked dinner.'],
        answer: 'She is cooking dinner.',
        explanation: 'be + doing。'
      }
    ]
  },
  {
    title: '名词单复数',
    level: 'basic',
    content: '可数名词有单复数变化，常见复数形式加 -s 或 -es，不规则变化需单独记忆。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'One child, two ____.',
        options: ['childs', 'children', 'childes'],
        answer: 'children',
        explanation: 'child 的不规则复数是 children。'
      },
      {
        type: 'fill_blank',
        prompt: 'There are many ____ (box) in the room.',
        options: [],
        answer: 'boxes',
        explanation: 'box 复数加 -es。'
      },
      {
        type: 'single_choice',
        prompt: 'Correct plural form of “city” is:',
        options: ['citys', 'cities', 'cityes'],
        answer: 'cities',
        explanation: '辅音+y 变 ies。'
      }
    ]
  },
  {
    title: '情态动词 can/must',
    level: 'intermediate',
    content: '情态动词后接动词原形，can 表能力/许可，must 表必须或推测。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'You ____ wear a helmet when riding a bike.',
        options: ['can', 'must', 'may'],
        answer: 'must',
        explanation: '表示必须。'
      },
      {
        type: 'fill_blank',
        prompt: 'She can ____ (swim) very fast.',
        options: [],
        answer: 'swim',
        explanation: '情态动词后用原形。'
      },
      {
        type: 'single_choice',
        prompt: '“Can I open the window?” asks for ____.',
        options: ['ability', 'permission', 'obligation'],
        answer: 'permission',
        explanation: 'can 可表示请求许可。'
      }
    ]
  },
  {
    title: '比较级与最高级',
    level: 'intermediate',
    content: '形容词比较级用于两者比较，最高级用于三者及以上比较。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'This book is ____ than that one.',
        options: ['interesting', 'more interesting', 'most interesting'],
        answer: 'more interesting',
        explanation: '两者比较用比较级。'
      },
      {
        type: 'fill_blank',
        prompt: 'He is the ____ (tall) student in class.',
        options: [],
        answer: 'tallest',
        explanation: '三者以上用最高级。'
      },
      {
        type: 'single_choice',
        prompt: 'Which sentence is correct?',
        options: ['She is best than me.', 'She is better than me.', 'She is more better than me.'],
        answer: 'She is better than me.',
        explanation: 'good 的比较级是 better。'
      }
    ]
  },
  {
    title: '被动语态',
    level: 'intermediate',
    content: '被动语态强调动作承受者，结构常为 be + 过去分词。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'English ____ in many countries.',
        options: ['speaks', 'is spoken', 'spoke'],
        answer: 'is spoken',
        explanation: '被动语态 be + done。'
      },
      {
        type: 'fill_blank',
        prompt: 'The room ____ (clean) every day.',
        options: [],
        answer: 'is cleaned',
        explanation: '主语是动作承受者。'
      },
      {
        type: 'single_choice',
        prompt: 'Passive voice example:',
        options: ['Tom writes a letter.', 'A letter is written by Tom.', 'Tom is write a letter.'],
        answer: 'A letter is written by Tom.',
        explanation: '被动语态完整结构。'
      }
    ]
  },
  {
    title: '现在完成时',
    level: 'intermediate',
    content: '现在完成时表示过去发生并对现在有影响的动作，结构为 have/has + 过去分词。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'I ____ finished my homework.',
        options: ['have', 'has', 'had'],
        answer: 'have',
        explanation: 'I 搭配 have。'
      },
      {
        type: 'fill_blank',
        prompt: 'She ____ (visit) London twice.',
        options: [],
        answer: 'has visited',
        explanation: '第三人称单数用 has。'
      },
      {
        type: 'single_choice',
        prompt: 'Signal word for present perfect:',
        options: ['yesterday', 'already', 'last year'],
        answer: 'already',
        explanation: 'already 常与现在完成时搭配。'
      }
    ]
  },
  {
    title: '条件句（第一类）',
    level: 'intermediate',
    content: '第一类条件句表示可能发生的真实条件，结构 if + 一般现在时，主句 will + 动词原形。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'If it rains, we ____ at home.',
        options: ['stay', 'will stay', 'stayed'],
        answer: 'will stay',
        explanation: '主句用 will。'
      },
      {
        type: 'fill_blank',
        prompt: 'If you ____ (study) hard, you will pass.',
        options: [],
        answer: 'study',
        explanation: 'if 从句用一般现在时。'
      },
      {
        type: 'single_choice',
        prompt: 'Correct first conditional:',
        options: ['If he will come, I will call.', 'If he comes, I will call.', 'If he came, I will call.'],
        answer: 'If he comes, I will call.',
        explanation: 'if 从句不用 will。'
      }
    ]
  },
  {
    title: '定语从句（关系代词）',
    level: 'advanced',
    content: '定语从句用于修饰先行词，常见关系代词有 who、which、that。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'The man ____ lives next door is a doctor.',
        options: ['which', 'who', 'where'],
        answer: 'who',
        explanation: '先行词是人。'
      },
      {
        type: 'fill_blank',
        prompt: 'This is the book ____ I bought yesterday.',
        options: [],
        answer: 'that',
        explanation: 'that 可指物。'
      },
      {
        type: 'single_choice',
        prompt: 'Choose the correct one:',
        options: ['The car who is red is mine.', 'The car which is red is mine.', 'The car where is red is mine.'],
        answer: 'The car which is red is mine.',
        explanation: '先行词是 car，使用 which。'
      }
    ]
  },
  {
    title: '虚拟语气（与现在事实相反）',
    level: 'advanced',
    content: '与现在事实相反的虚拟语气常用 if + 过去式，主句 would + 动词原形。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'If I ____ rich, I would travel the world.',
        options: ['am', 'was', 'were'],
        answer: 'were',
        explanation: '虚拟语气常用 were。'
      },
      {
        type: 'fill_blank',
        prompt: 'If she ____ (know) the answer, she would tell us.',
        options: [],
        answer: 'knew',
        explanation: 'if 从句用过去式。'
      },
      {
        type: 'single_choice',
        prompt: 'Correct subjunctive sentence:',
        options: ['If he is here, he would help.', 'If he were here, he would help.', 'If he was here, he will help.'],
        answer: 'If he were here, he would help.',
        explanation: '经典虚拟语气搭配。'
      }
    ]
  },
  {
    title: '非谓语动词（to do / doing / done）',
    level: 'advanced',
    content: '非谓语形式在句中可作主语、宾语、定语、状语等，常见有不定式、动名词、过去分词。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'I enjoy ____ English podcasts.',
        options: ['listen', 'listening', 'to listen'],
        answer: 'listening',
        explanation: 'enjoy 后接 doing。'
      },
      {
        type: 'fill_blank',
        prompt: 'It is important ____ (review) regularly.',
        options: [],
        answer: 'to review',
        explanation: 'It is + adj + to do。'
      },
      {
        type: 'single_choice',
        prompt: 'The book ____ by my friend is useful.',
        options: ['write', 'written', 'writing'],
        answer: 'written',
        explanation: '过去分词作后置定语。'
      }
    ]
  },
  {
    title: '强调句型 It is ... that ...',
    level: 'advanced',
    content: '强调句型用于突出句子中的某个成分，结构为 It is/was + 被强调部分 + that/who + 其他。',
    questions: [
      {
        type: 'single_choice',
        prompt: '____ I met yesterday was Tom.',
        options: ['It is', 'It was', 'There was'],
        answer: 'It was',
        explanation: '过去时间 yesterday 对应 was。'
      },
      {
        type: 'fill_blank',
        prompt: 'It is in this room ____ we study.',
        options: [],
        answer: 'that',
        explanation: '强调句结构固定。'
      },
      {
        type: 'single_choice',
        prompt: 'Correct emphatic structure:',
        options: ['It was she that solved it.', 'She was that solved it.', 'It she was that solved it.'],
        answer: 'It was she that solved it.',
        explanation: 'It is/was + 强调部分 + that。'
      }
    ]
  },
  {
    title: '倒装句基础',
    level: 'advanced',
    content: '倒装句通过调整语序实现强调或语法要求，如 never, hardly 放句首触发部分倒装。',
    questions: [
      {
        type: 'single_choice',
        prompt: 'Never ____ such a beautiful place.',
        options: ['I have seen', 'have I seen', 'I saw'],
        answer: 'have I seen',
        explanation: '否定副词置前，助动词提前。'
      },
      {
        type: 'fill_blank',
        prompt: 'Only then ____ (did/realize) the truth.',
        options: [],
        answer: 'did I realize',
        explanation: 'only+状语置前，主句部分倒装。'
      },
      {
        type: 'single_choice',
        prompt: 'Which is inversion?',
        options: ['I seldom go out.', 'Seldom do I go out.', 'I do seldom go out.'],
        answer: 'Seldom do I go out.',
        explanation: '部分倒装格式正确。'
      }
    ]
  }
] as const;

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function daysFromNow(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

async function seedTestUserData(userId: string) {
  // 清理该测试账号已有的学习数据，保证可重复执行
  await prisma.userWordReviewEvent.deleteMany({ where: { userId } });
  await prisma.wordNote.deleteMany({ where: { userId } });
  await prisma.grammarMistake.deleteMany({ where: { userId } });
  await prisma.grammarMistakeRetryEvent.deleteMany({ where: { userId } });
  await prisma.grammarAttempt.deleteMany({ where: { userId } });
  await prisma.searchHistory.deleteMany({ where: { userId } });
  await prisma.wordGroup.deleteMany({ where: { userId } });
  await prisma.userWordProgress.deleteMany({ where: { userId } });

  // 选取核心词库中的前 60 个单词作为该用户的学习记录
  const selectedWords = coreWords.slice(0, 60).map(([word]) => word);
  const entries = await prisma.wordEntry.findMany({
    where: { word: { in: selectedWords } }
  });

  const progresses: { id: string; index: number; word: string }[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const isKnown = i % 3 === 0;

    let nextReviewAt: Date;
    if (i % 4 === 0) {
      nextReviewAt = daysAgo((i % 3) + 1); // 已过期，待复习
    } else if (i % 4 === 1) {
      nextReviewAt = daysFromNow(0, 21); // 今天到期
    } else {
      nextReviewAt = daysFromNow((i % 7) + 1); // 未来几天
    }

    const progress = await prisma.userWordProgress.create({
      data: {
        userId,
        wordEntryId: entry.id,
        status: isKnown ? 'known' : 'learning',
        easeFactor: Number((2.5 + ((i % 5) - 2) * 0.1).toFixed(2)),
        intervalDays: isKnown ? (i % 10) + 5 : (i % 3) + 1,
        nextReviewAt,
        lastReviewedAt: daysAgo((i % 10) + 1),
        createdAt: daysAgo(25 - (i % 20))
      }
    });

    progresses.push({ id: progress.id, index: i, word: entry.word });
  }

  // 复习历史事件（用于统计连续打卡、复习曲线），覆盖最近 14 天
  const ratings = ['completely_forgot', 'fuzzy', 'recognized', 'mastered'] as const;
  let eventCounter = 0;
  for (let day = 14; day >= 0; day -= 1) {
    const reviewsToday = (day % 4) + 2; // 每天 2~5 条
    for (let r = 0; r < reviewsToday; r += 1) {
      const progress = progresses[(eventCounter * 7 + day) % progresses.length];
      if (!progress) continue;
      const known = (eventCounter + day) % 4 !== 0;
      await prisma.userWordReviewEvent.create({
        data: {
          userId,
          progressId: progress.id,
          clientEventId: newId(),
          known,
          rating: ratings[(eventCounter + r) % ratings.length],
          easeFactorAfter: Number((2.4 + ((eventCounter % 4) * 0.1)).toFixed(2)),
          intervalDaysAfter: (eventCounter % 8) + 1,
          reviewedAt: daysAgo(day, 9 + (r % 8)),
          createdAt: daysAgo(day, 9 + (r % 8))
        }
      });
      eventCounter += 1;
    }
  }

  // 单词分组
  const groupDefs = [
    { name: '考研核心词', color: '#6366f1' },
    { name: '高频动词', color: '#10b981' },
    { name: '易混淆词', color: '#f59e0b' }
  ];

  for (let g = 0; g < groupDefs.length; g += 1) {
    const def = groupDefs[g];
    const members = progresses
      .filter((_, idx) => idx % groupDefs.length === g)
      .slice(0, 12);

    await prisma.wordGroup.create({
      data: {
        userId,
        name: def.name,
        color: def.color,
        createdAt: daysAgo(20 - g),
        progresses: {
          connect: members.map((m) => ({ id: m.id }))
        }
      }
    });
  }

  // 单词笔记
  const noteTexts = [
    '**助记**：a- 表示否定，bandon 联想 band（乐队解散）。',
    '词根 habil = 能够，ability 即"能力"。',
    '近义词：reach / attain，注意搭配 *achieve a goal*。',
    '- 名词：方法\n- 动词：接近\n常考短语 *an approach to*。',
    '反义词：simple。complex 强调结构复杂。'
  ];
  for (let n = 0; n < noteTexts.length && n < progresses.length; n += 1) {
    await prisma.wordNote.create({
      data: {
        userId,
        progressId: progresses[n].id,
        content: noteTexts[n],
        version: 1,
        createdAt: daysAgo(10 - n),
        updatedAt: daysAgo(3 - (n % 3))
      }
    });
  }

  // 语法答题记录（覆盖多节课程、最近若干天）
  const lessonRecords = await prisma.grammarLesson.findMany({
    include: { questions: true },
    orderBy: { createdAt: 'asc' }
  });

  let attemptDay = 13;
  for (let l = 0; l < lessonRecords.length && l < 10; l += 1) {
    const lesson = lessonRecords[l];
    if (lesson.questions.length === 0) continue;

    const total = lesson.questions.length;
    const correctCount = Math.max(1, total - (l % 3));
    const isTimed = l % 2 === 0;

    const answers = lesson.questions.map((q, qi) => {
      const correct = qi < correctCount;
      return {
        questionId: q.id,
        answer: correct ? q.answer : '',
        correct,
        timedOut: false,
        timeTakenMs: 4000 + qi * 1200
      };
    });

    await prisma.grammarAttempt.create({
      data: {
        userId,
        lessonId: lesson.id,
        clientEventId: newId(),
        score: Math.round((correctCount / total) * 100),
        totalQuestions: total,
        correctCount,
        answers,
        isTimedMode: isTimed,
        timeLimitMode: isTimed ? 'per_quiz' : null,
        timeLimitSec: isTimed ? 300 : null,
        timeTakenMs: isTimed ? 120000 + l * 5000 : null,
        timeoutCount: 0,
        createdAt: daysAgo(Math.max(0, attemptDay))
      }
    });
    attemptDay -= 1;

    // 把答错的题记入错题本
    const wrongQuestions = lesson.questions.slice(correctCount);
    for (const q of wrongQuestions) {
      await prisma.grammarMistake.create({
        data: {
          userId,
          questionId: q.id,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          level: lesson.level,
          questionType: q.type,
          prompt: q.prompt,
          options: q.options as object,
          userAnswer: '',
          correctAnswer: q.answer,
          explanation: q.explanation,
          errorCount: (l % 3) + 1,
          lastAttemptAt: daysAgo(Math.max(0, attemptDay + 1)),
          createdAt: daysAgo(Math.max(0, attemptDay + 1))
        }
      });
    }
  }

  // 搜索历史
  const queries = ['achieve', 'benefit', 'context', 'strategy', 'review', 'structure', 'efficient'];
  for (let s = 0; s < queries.length; s += 1) {
    await prisma.searchHistory.create({
      data: {
        userId,
        query: queries[s],
        searchedAt: daysAgo(s, 14 + (s % 6))
      }
    });
  }

  const progressCount = progresses.length;
  console.log(
    `User data seeded: ${progressCount} word progresses, ${eventCounter} review events, ${groupDefs.length} groups, grammar attempts & mistakes, ${queries.length} searches`
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(TEST_ACCOUNT_PASSWORD, 10);
  const testUser = await prisma.user.upsert({
    where: { email: TEST_ACCOUNT_EMAIL },
    create: {
      email: TEST_ACCOUNT_EMAIL,
      passwordHash
    },
    update: {
      passwordHash
    }
  });

  for (const [word, definition, exampleSentence, phonetic] of words) {
    await prisma.wordEntry.upsert({
      where: { word },
      create: { word, definition, exampleSentence, phonetic },
      update: { definition, exampleSentence, phonetic }
    });
  }

  for (const lesson of lessons) {
    const savedLesson = await prisma.grammarLesson.upsert({
      where: { title: lesson.title },
      create: {
        title: lesson.title,
        level: lesson.level,
        content: lesson.content
      },
      update: {
        level: lesson.level,
        content: lesson.content
      }
    });

    await prisma.grammarQuestion.deleteMany({
      where: { lessonId: savedLesson.id }
    });

    for (const q of lesson.questions) {
      await prisma.grammarQuestion.create({
        data: {
          lessonId: savedLesson.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation
        }
      });
    }
  }

  await seedTestUserData(testUser.id);

  console.log(
    `Seed complete: test account ${TEST_ACCOUNT_EMAIL} / ${TEST_ACCOUNT_PASSWORD}, ${words.length} words, ${lessons.length} lessons`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
